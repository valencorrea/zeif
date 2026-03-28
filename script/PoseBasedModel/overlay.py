"""
OpenCV overlay helpers: draws bounding boxes and skeleton on a frame.
"""

from __future__ import annotations
from typing import Optional, Tuple

import cv2
import numpy as np

from pose_schema import KEYPOINT_NAMES, LIMB_PAIRS
from tracker import PersonState

# Colours (BGR)
COLOR_NORMAL     = (0, 200, 0)    # green
COLOR_SUSPICIOUS = (0, 0, 220)    # red
COLOR_JOINT      = (255, 200, 0)  # cyan-ish
COLOR_LIMB       = (180, 180, 0)  # teal

FONT             = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE       = 0.55
FONT_THICKNESS   = 2
BOX_THICKNESS    = 2
JOINT_RADIUS     = 4


def draw_person(
    frame: np.ndarray,
    state: PersonState,
    kps: Optional[np.ndarray] = None,  # (15, 3) latest keypoints, optional
) -> None:
    """
    Draw bounding box, label, probability, and skeleton for one person.
    Modifies `frame` in-place.
    """
    if state.last_bbox is None:
        return

    x1, y1, x2, y2 = state.last_bbox
    color = COLOR_SUSPICIOUS if state.is_suspicious else COLOR_NORMAL
    label = "Suspicious Action" if state.is_suspicious else "Normal"
    prob  = state.aggregated_prob

    # Bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, BOX_THICKNESS)

    # Label background
    text   = f"[{state.pid}] {label} ({prob:.2f})"
    (tw, th), baseline = cv2.getTextSize(text, FONT, FONT_SCALE, FONT_THICKNESS)
    cv2.rectangle(frame, (x1, y1 - th - baseline - 4), (x1 + tw, y1), color, -1)
    cv2.putText(frame, text, (x1, y1 - baseline - 2), FONT, FONT_SCALE,
                (255, 255, 255), FONT_THICKNESS, cv2.LINE_AA)

    # Skeleton
    if kps is not None:
        _draw_skeleton(frame, kps)


def _draw_skeleton(frame: np.ndarray, kps: np.ndarray) -> None:
    """Draw joints and limbs for a (15, 3) keypoint array."""
    h, w = frame.shape[:2]

    # Draw limbs
    for (i, j) in LIMB_PAIRS:
        xi, yi, ci = kps[i]
        xj, yj, cj = kps[j]
        if ci < 0.2 or cj < 0.2:
            continue
        pt1 = (int(np.clip(xi, 0, w - 1)), int(np.clip(yi, 0, h - 1)))
        pt2 = (int(np.clip(xj, 0, w - 1)), int(np.clip(yj, 0, h - 1)))
        cv2.line(frame, pt1, pt2, COLOR_LIMB, 2, cv2.LINE_AA)

    # Draw joints
    for idx in range(len(kps)):
        x, y, c = kps[idx]
        if c < 0.2:
            continue
        cx = int(np.clip(x, 0, w - 1))
        cy = int(np.clip(y, 0, h - 1))
        cv2.circle(frame, (cx, cy), JOINT_RADIUS, COLOR_JOINT, -1, cv2.LINE_AA)


def draw_fps(frame: np.ndarray, fps: float) -> None:
    """Render FPS counter in top-left corner."""
    cv2.putText(
        frame, f"FPS: {fps:.1f}", (10, 26),
        FONT, 0.65, (220, 220, 220), 2, cv2.LINE_AA,
    )
