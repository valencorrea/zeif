"""
Real-time shoplifting detector using the STG-NF model.

Pipeline per frame:
  1. Capture webcam frame (5 FPS)
  2. YOLOv8-pose + ByteTrack → person detections
  3. COCO-17 keypoints → 15-kp schema
  4. Per-PID sliding window (24 frames, stride 6)
  5. STG-NF anomaly score → normality score
  6. HPRS-calibrated threshold → alert
  7. Pass (window, score) to AdaptationPipeline.filter_and_collect
"""
from __future__ import annotations

import time
from collections import deque
from pathlib import Path
from typing import Dict, Optional, Tuple

import cv2
import numpy as np
import torch

from config import (
    CONF_THRESH, STRIDE, TARGET_FPS, WINDOW_T,
)
from dataset.pose_schema import (
    MID_HIP_IDX, NUM_KEYPOINTS, NECK_IDX,
    build_15kp_from_coco, normalize_pose,
)
from model.stg_nf import STGNF
from inference.overlay import draw_global_alert, draw_hud, draw_person

_FRAME_MS = int(1000 / TARGET_FPS)
_YOLO_MODEL = "yolov8n-pose.pt"


# ── Per-person state ───────────────────────────────────────────────────────────

class _PersonState:
    def __init__(self, pid: int) -> None:
        self.pid          = pid
        self.kp_buffer:   deque[np.ndarray]  = deque(maxlen=WINDOW_T)
        self.frame_count  = 0                # frames pushed since last inference
        self.norm_scores: deque[float]       = deque(maxlen=30)
        self.suspicious   = False
        self.last_kps:    Optional[np.ndarray] = None   # (15,3) for overlay
        self.last_bbox:   Optional[Tuple[int,int,int,int]] = None

    def push(self, kps: np.ndarray) -> None:
        self.kp_buffer.append(kps.astype(np.float32))
        self.frame_count += 1
        self.last_kps = kps

    def ready_for_inference(self) -> bool:
        """Return True every STRIDE frames once the window is warm."""
        return (
            len(self.kp_buffer) == WINDOW_T and
            self.frame_count % STRIDE == 0
        )

    def get_window(self) -> Optional[np.ndarray]:
        if len(self.kp_buffer) < WINDOW_T:
            return None
        return np.stack(list(self.kp_buffer), axis=0)  # (T, 15, 3)

    def record_normality(self, score: float) -> None:
        self.norm_scores.append(score)
        self.suspicious = float(np.mean(self.norm_scores)) < 0.5

    @property
    def normality(self) -> float:
        return float(np.mean(self.norm_scores)) if self.norm_scores else 1.0


# ── Detector ──────────────────────────────────────────────────────────────────

class RealTimeDetector:
    """
    Wraps webcam capture, pose estimation, STG-NF scoring, and overlay.

    Args:
        model:      trained STGNF in eval mode
        tau:        HPRS-calibrated anomaly score threshold
        device:     torch device
        source:     webcam index or video file path
        pipeline:   optional AdaptationPipeline (for D_low collection)
    """

    def __init__(
        self,
        model:    STGNF,
        tau:      float,
        device:   torch.device,
        source:   int | str = 0,
        pipeline  = None,        # AdaptationPipeline or None
    ) -> None:
        self.model    = model
        self.tau      = tau
        self.device   = device
        self.source   = source
        self.pipeline = pipeline

        self._states: Dict[int, _PersonState] = {}

        # Import YOLO lazily to keep module loading fast
        from ultralytics import YOLO
        self._yolo = YOLO(_YOLO_MODEL)

        self._fps         = 0.0
        self._fps_counter = 0
        self._fps_t       = time.time()

    # ── public entry point ────────────────────────────────────────────────────

    def run(self) -> None:
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open camera/video: {self.source}")
        cap.set(cv2.CAP_PROP_FPS, TARGET_FPS)

        print(f"[detector] Running on {self.source}. Press 'q' to quit.")

        while True:
            t0 = time.time()

            ok, frame = cap.read()
            if not ok:
                print("[detector] Frame read failed – retrying")
                time.sleep(0.05)
                continue

            annotated = self._process_frame(frame)

            # ── FPS ──────────────────────────────────────────────────────────
            self._fps_counter += 1
            elapsed = time.time() - self._fps_t
            if elapsed >= 1.0:
                self._fps   = self._fps_counter / elapsed
                self._fps_counter = 0
                self._fps_t = time.time()

            # ── HUD ──────────────────────────────────────────────────────────
            adapt_h = None
            if self.pipeline:
                remaining = self.pipeline.interval_s - (
                    time.time() - self.pipeline._last_adapt
                )
                adapt_h = max(0.0, remaining / 3600)

            draw_hud(annotated, self._fps, self.tau,
                     len(self._states), adapt_h)

            # Global alert banner if anyone is suspicious
            if any(s.suspicious for s in self._states.values()):
                draw_global_alert(annotated)

            cv2.imshow("Zeif STG-NF – Shoplifting Detection", annotated)

            wait = max(1, _FRAME_MS - int((time.time() - t0) * 1000))
            if cv2.waitKey(wait) & 0xFF == ord("q"):
                break

        cap.release()
        cv2.destroyAllWindows()
        if self.pipeline:
            self.pipeline.stop()
        print("[detector] Exited cleanly.")

    # ── per-frame processing ──────────────────────────────────────────────────

    def _process_frame(self, frame: np.ndarray) -> np.ndarray:
        results = self._yolo.track(
            frame,
            persist  = True,
            conf     = CONF_THRESH,
            classes  = [0],          # person only
            verbose  = False,
            tracker  = "bytetrack.yaml",
        )

        active_pids = []

        if results and results[0].keypoints is not None:
            res  = results[0]
            boxes = res.boxes
            kps   = res.keypoints

            for i in range(len(boxes)):
                pid = int(boxes.id[i].item()) if boxes.id is not None else i
                active_pids.append(pid)

                # Bounding box
                xyxy = boxes.xyxy[i].cpu().numpy().astype(int)
                bbox = (xyxy[0], xyxy[1], xyxy[2], xyxy[3])

                # Keypoints
                kp_raw = kps.data[i].cpu().numpy()   # (17, 3)
                if kp_raw.shape[0] != 17:
                    continue
                kp15 = build_15kp_from_coco(kp_raw)  # (15, 3)

                state = self._get_state(pid)
                state.last_bbox = bbox
                state.push(kp15)

                # Inference on completed windows (every STRIDE frames)
                if state.ready_for_inference():
                    window = state.get_window()  # (T, 15, 3)
                    if window is not None:
                        a_score, n_score = self._score(window)
                        state.record_normality(n_score)

                        # Feed adaptation pipeline
                        if self.pipeline:
                            xy = window[:, :, :2]
                            norm_xy, _ = normalize_pose(xy)
                            self.pipeline.filter_and_collect(norm_xy, a_score)

                draw_person(
                    frame     = frame,
                    pid       = pid,
                    bbox      = bbox,
                    normality = state.normality,
                    suspicious= state.suspicious,
                    kps       = kp15,
                )

        # Prune stale PIDs
        for dead_pid in [p for p in self._states if p not in active_pids]:
            del self._states[dead_pid]

        return frame

    def _score(self, window: np.ndarray) -> Tuple[float, float]:
        """
        Run STG-NF on a (T, 15, 3) window.
        Returns (anomaly_score, normality_score).
        """
        xy = window[:, :, :2]                       # (T, 15, 2)
        norm_xy, _ = normalize_pose(xy)
        x = torch.from_numpy(norm_xy).permute(2, 0, 1).unsqueeze(0)  # (1,2,T,V)
        x = x.to(self.device)

        with torch.no_grad():
            a_score = float(self.model.anomaly_score(x)[0].cpu())
            n_score = float(self.model.normality_score(x)[0].cpu())

        return a_score, n_score

    def _get_state(self, pid: int) -> _PersonState:
        if pid not in self._states:
            self._states[pid] = _PersonState(pid)
        return self._states[pid]
