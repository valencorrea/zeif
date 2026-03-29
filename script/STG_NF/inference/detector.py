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
  8. On green→red transition: save 5s-before + 5s-after clip to clips/
"""
from __future__ import annotations

import datetime
import threading
import time
from collections import deque
from pathlib import Path
from typing import Deque, Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch

from config import (
    CLIPS_DIR, CONF_THRESH, STRIDE, TARGET_FPS, WINDOW_T,
)
from dataset.pose_schema import (
    MID_HIP_IDX, NUM_KEYPOINTS, NECK_IDX,
    build_15kp_from_coco, normalize_pose,
)
from model.stg_nf import STGNF
from inference.overlay import draw_global_alert, draw_hud, draw_person

_FRAME_MS     = int(1000 / TARGET_FPS)
_YOLO_MODEL   = "yolov8n-pose.pt"
_CLIP_PRE_S   = 5                          # seconds of pre-event footage
_CLIP_POST_S  = 5                          # seconds of post-event footage
_CLIP_PRE_N   = _CLIP_PRE_S  * TARGET_FPS  # frames: 25
_CLIP_POST_N  = _CLIP_POST_S * TARGET_FPS  # frames: 25

# Session-relative anomaly detection.
# Because normalizing flows produce absolute log-prob values that depend
# heavily on model scale and domain shift, we cannot use a fixed normality
# threshold (e.g. n_score < 0.5).  Instead we maintain a rolling baseline
# of ALL anomaly scores seen in the current session and flag anyone whose
# recent mean score is Z_THRESH standard deviations above that baseline.
_SESSION_BUF  = 300   # collect last ~60s of cross-person scores (300 / 5fps / ~1 person)
_WARMUP_N     = 30    # minimum baseline samples before flagging (≈30 inferences ≈ 36s)
_Z_THRESH     = 2.0   # z-score above session mean → suspicious


# ── Per-person state ───────────────────────────────────────────────────────────

class _PersonState:
    def __init__(self, pid: int) -> None:
        self.pid          = pid
        self.kp_buffer:   deque[np.ndarray]  = deque(maxlen=WINDOW_T)
        self.frame_count  = 0                # frames pushed since last inference
        self.a_scores:    deque[float]       = deque(maxlen=5)  # raw anomaly scores
        self.suspicious   = False
        self._was_suspicious = False         # previous tick – used for edge detection
        self._last_z:     float              = 0.0  # most recent z-score (for display)
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

    def record_anomaly(
        self,
        a_score: float,
        session_mean: float,
        session_std: float,
        warmup_done: bool,
    ) -> None:
        """Update suspicion using z-score relative to the session baseline."""
        self._was_suspicious = self.suspicious
        self.a_scores.append(a_score)

        if not warmup_done or session_std < 1e-8:
            # Still warming up — never flag during warmup
            self.suspicious   = False
            self._last_z      = 0.0
            return

        z = (float(np.mean(self.a_scores)) - session_mean) / session_std
        self._last_z   = z
        self.suspicious = z > _Z_THRESH

    @property
    def just_triggered(self) -> bool:
        """True on the first tick that flips green → red."""
        return self.suspicious and not self._was_suspicious

    @property
    def normality(self) -> float:
        """Returns a [0,1] display value: 1.0 = clearly normal, 0.0 = highly anomalous.
        Derived from the z-score; clamped so the overlay colour ramp works correctly."""
        # z=0 → 0.5, z=+_Z_THRESH → 0.0, z=-_Z_THRESH → 1.0
        z_norm = max(0.0, min(1.0, 0.5 - self._last_z / (2 * _Z_THRESH + 1e-8)))
        return z_norm


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

        # ── Session-relative baseline ─────────────────────────────────────────
        # Collects anomaly scores from ALL persons across ALL inferences this
        # session.  Used to compute a running mean/std for z-score detection.
        self._session_scores: Deque[float] = deque(maxlen=_SESSION_BUF)

        # ── Clip recording ────────────────────────────────────────────────────
        # Rolling ring of the last _CLIP_PRE_N raw frames (pre-event buffer)
        self._pre_buf: Deque[np.ndarray] = deque(maxlen=_CLIP_PRE_N)
        # Active post-event captures: list of (pre_frames, post_frames, pid, timestamp)
        self._post_captures: List[Tuple[List[np.ndarray], List[np.ndarray], int, str]] = []

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

            warmup_remaining = max(0, _WARMUP_N - len(self._session_scores))
            draw_hud(annotated, self._fps, self.tau,
                     len(self._states), adapt_h,
                     warmup_remaining=warmup_remaining)

            # Global alert banner if anyone is suspicious (never during warmup)
            if any(s.suspicious for s in self._states.values()):
                draw_global_alert(annotated)

            # Store fully-annotated frame in pre-buffer and post-captures
            self._pre_buf.append(annotated.copy())
            self._tick_post_captures(annotated)

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
                        a_score = self._score(window)

                        # Update session baseline then evaluate per-person z-score
                        self._session_scores.append(a_score)
                        s_mean = float(np.mean(self._session_scores))
                        s_std  = float(np.std(self._session_scores)) + 1e-8
                        warmup = len(self._session_scores) >= _WARMUP_N

                        state.record_anomaly(a_score, s_mean, s_std, warmup)

                        # Trigger clip on green → red transition only
                        if state.just_triggered:
                            self._start_clip(pid)

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

    def _score(self, window: np.ndarray) -> float:
        """
        Run STG-NF on a (T, 15, 3) window.
        Returns raw anomaly_score (higher = more anomalous).
        Suspicious/normal judgement is made by z-scoring against the session
        baseline in the caller — NOT here.
        """
        xy = window[:, :, :2]                       # (T, 15, 2)
        norm_xy, _ = normalize_pose(xy)
        x = torch.from_numpy(norm_xy).permute(2, 0, 1).unsqueeze(0)  # (1,2,T,V)
        x = x.to(self.device)

        with torch.no_grad():
            a_score = float(self.model.anomaly_score(x)[0].cpu())

        return a_score

    # ── clip recording ────────────────────────────────────────────────────────

    def _start_clip(self, pid: int) -> None:
        """Snapshot pre-buffer and start collecting post-event frames."""
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        pre_frames = list(self._pre_buf)          # up to 25 fully-annotated frames
        print(f"[clip] Shoplifter detected (pid={pid}) – recording clip {ts}")
        # post_buf starts empty; _tick_post_captures will fill it
        self._post_captures.append((pre_frames, [], pid, ts))

    def _tick_post_captures(self, frame: np.ndarray) -> None:
        """Append current frame to every active post-capture; write when full."""
        done = []
        for entry in self._post_captures:
            pre, post, pid, ts = entry
            post.append(frame.copy())
            if len(post) >= _CLIP_POST_N:
                done.append(entry)

        for entry in done:
            self._post_captures.remove(entry)
            pre, post, pid, ts = entry
            threading.Thread(
                target=self._write_clip,
                args=(pre, post, pid, ts),
                daemon=True,
            ).start()

    def _write_clip(
        self,
        pre: List[np.ndarray],
        post: List[np.ndarray],
        pid: int,
        ts: str,
    ) -> None:
        frames = pre + post
        if not frames:
            return

        h, w = frames[0].shape[:2]
        path = CLIPS_DIR / f"{ts}_pid{pid}.mp4"

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(path), fourcc, TARGET_FPS, (w, h))
        for f in frames:
            writer.write(f)
        writer.release()
        print(f"[clip] Saved → {path}  ({len(frames)} frames, "
              f"{len(pre)/TARGET_FPS:.1f}s pre + {len(post)/TARGET_FPS:.1f}s post)")

    def _get_state(self, pid: int) -> _PersonState:
        if pid not in self._states:
            self._states[pid] = _PersonState(pid)
        return self._states[pid]
