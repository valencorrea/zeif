"""
Real-time shoplifting detection – MacBook Pro M4
================================================
Pipeline per frame
  1. Capture frame from webcam at ~5 FPS
  2. YOLOv8-pose + ByteTrack → person detections with track IDs
  3. Extract 17 COCO keypoints → map to 15-kp schema
  4. Push to per-PID sliding window (25 frames)
  5. When window is full: QC filter → feature extraction → LSTM inference
  6. Aggregate probability per PID; overlay bbox + label

Usage:
    python main.py [--weights path/to/weights.pt] [--source 0] [--conf 0.4]
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import torch

from inference import run_inference
from model import load_model
from overlay import draw_fps, draw_person
from pose_schema import build_15kp_from_coco
from qc_filter import preprocess_window
from tracker import PersonTracker

TARGET_FPS   = 5          # webcam capture rate
FRAME_MS     = int(1000 / TARGET_FPS)
YOLO_MODEL   = "yolov8n-pose.pt"   # nano pose model – fastest on MPS
CONF_THRESH  = 0.4
SHOPLIFTER_CLASS = 1      # index in [normal=0, shoplifter=1]


def select_device() -> torch.device:
    if torch.backends.mps.is_available():
        print("[device] Using MPS (Apple Silicon GPU)")
        return torch.device("mps")
    if torch.cuda.is_available():
        print("[device] Using CUDA")
        return torch.device("cuda")
    print("[device] Falling back to CPU")
    return torch.device("cpu")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Real-time shoplifting detection")
    p.add_argument("--weights", type=str, default=None,
                   help="Path to TrajectoryModel weights (.pt). Omit for demo mode.")
    p.add_argument("--source",  type=int, default=0,
                   help="Webcam index (default: 0)")
    p.add_argument("--conf",    type=float, default=CONF_THRESH,
                   help="YOLO detection confidence threshold")
    p.add_argument("--no-skeleton", action="store_true",
                   help="Disable skeleton overlay (faster rendering)")
    return p.parse_args()


def main() -> None:
    args   = parse_args()
    device = select_device()

    # ── Load YOLO pose model ───────────────────────────────────────────────────
    # ultralytics handles download on first run
    from ultralytics import YOLO  # local import to keep startup fast
    yolo = YOLO(YOLO_MODEL)
    print(f"[yolo] Loaded {YOLO_MODEL}")

    # ── Load classification model ──────────────────────────────────────────────
    traj_model = load_model(args.weights, device)

    # ── Per-person state ───────────────────────────────────────────────────────
    tracker = PersonTracker()

    # ── Webcam ─────────────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(args.source)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open camera source {args.source}")

    cap.set(cv2.CAP_PROP_FPS, TARGET_FPS)

    print(f"[main] Streaming from camera {args.source} at {TARGET_FPS} FPS. Press 'q' to quit.")

    fps_counter = 0
    fps_display = 0.0
    t_fps_start = time.time()

    while True:
        t_frame = time.time()

        ret, frame = cap.read()
        if not ret:
            print("[main] Frame capture failed – retrying…")
            time.sleep(0.05)
            continue

        # ── YOLO inference with ByteTrack ──────────────────────────────────────
        results = yolo.track(
            frame,
            persist=True,           # ByteTrack: keep track state between calls
            conf=args.conf,
            classes=[0],            # COCO class 0 = person
            verbose=False,
            tracker="bytetrack.yaml",
        )

        active_pids: list[int] = []

        if results and results[0].keypoints is not None:
            result = results[0]
            boxes     = result.boxes       # Boxes object
            keypoints = result.keypoints   # Keypoints object

            num_persons = len(boxes)

            for idx in range(num_persons):
                # ── Track ID ──────────────────────────────────────────────────
                if boxes.id is None:
                    pid = idx          # fallback if tracker lost id
                else:
                    pid = int(boxes.id[idx].item())

                active_pids.append(pid)
                state = tracker.get_or_create(pid)

                # ── Bounding box (x1,y1,x2,y2) ────────────────────────────────
                xyxy = boxes.xyxy[idx].cpu().numpy().astype(int)
                state.last_bbox = (xyxy[0], xyxy[1], xyxy[2], xyxy[3])

                # ── Keypoints → 15-kp schema ───────────────────────────────────
                kp_raw = keypoints.data[idx].cpu().numpy()   # (17, 3) [x,y,conf]
                if kp_raw.shape[0] != 17:
                    continue

                kp15 = build_15kp_from_coco(kp_raw)          # (15, 3)
                state.push_keypoints(kp15)

                # ── Inference when window is full ──────────────────────────────
                window = state.get_window()   # (25, 15, 3) or None
                if window is not None:
                    clean = preprocess_window(window)
                    if clean is not None:
                        p_shoplifter = run_inference(traj_model, clean, device)
                        state.record_prob(p_shoplifter)

                # ── Draw overlay ───────────────────────────────────────────────
                latest_kps = None if args.no_skeleton else kp15
                draw_person(frame, state, latest_kps)

        # ── Prune stale PIDs ───────────────────────────────────────────────────
        tracker.prune_stale(active_pids)

        # ── FPS display ────────────────────────────────────────────────────────
        fps_counter += 1
        elapsed = time.time() - t_fps_start
        if elapsed >= 1.0:
            fps_display   = fps_counter / elapsed
            fps_counter   = 0
            t_fps_start   = time.time()

        draw_fps(frame, fps_display)

        cv2.imshow("Zeif – Shoplifting Detection", frame)

        # Cap at TARGET_FPS
        elapsed_ms = int((time.time() - t_frame) * 1000)
        wait_ms    = max(1, FRAME_MS - elapsed_ms)
        if cv2.waitKey(wait_ms) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[main] Exited cleanly.")


if __name__ == "__main__":
    main()
