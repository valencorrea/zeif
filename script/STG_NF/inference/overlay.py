"""
OpenCV overlay helpers for real-time display.

Draws:
  - Bounding box (green = normal, red = suspicious)
  - 'Normality Score' bar
  - 'Suspicious Activity' alert banner
  - Skeleton (joints + limbs)
  - FPS counter
"""
from __future__ import annotations
from typing import Optional, Tuple

import cv2
import numpy as np

from dataset.pose_schema import KEYPOINT_NAMES, LIMB_PAIRS, NUM_KEYPOINTS

# BGR colours
_GREEN  = (0, 210, 0)
_RED    = (0, 0, 220)
_YELLOW = (0, 200, 220)
_WHITE  = (255, 255, 255)
_DARK   = (30, 30, 30)
_CYAN   = (220, 200, 0)
_TEAL   = (160, 160, 0)

FONT  = cv2.FONT_HERSHEY_SIMPLEX
BOLD  = cv2.FONT_HERSHEY_DUPLEX


def draw_person(
    frame:          np.ndarray,
    pid:            int,
    bbox:           Tuple[int, int, int, int],
    normality:      float,        # 0..1  (1 = perfectly normal)
    suspicious:     bool,
    kps:            Optional[np.ndarray] = None,  # (15, 3)
    show_score_bar: bool = True,
) -> None:
    """
    Draw all per-person overlays.  Modifies `frame` in-place.

    Args:
        normality:  current aggregated normality score (0..1)
        suspicious: True → red box + alert banner
    """
    x1, y1, x2, y2 = bbox
    color = _RED if suspicious else _GREEN

    # Bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    # Label string
    label = f"[{pid}] {'⚠ Suspicious Activity' if suspicious else 'Normal'}"
    (tw, th), bl = cv2.getTextSize(label, FONT, 0.55, 2)
    cv2.rectangle(frame, (x1, y1 - th - bl - 6), (x1 + tw + 4, y1), color, -1)
    cv2.putText(frame, label, (x1 + 2, y1 - bl - 2), FONT, 0.55, _WHITE, 2, cv2.LINE_AA)

    # Normality score bar
    if show_score_bar:
        _draw_score_bar(frame, x1, y2 + 4, x2 - x1, normality, suspicious)

    # Skeleton
    if kps is not None:
        _draw_skeleton(frame, kps)


def _draw_score_bar(
    frame:      np.ndarray,
    x:          int,
    y:          int,
    width:      int,
    normality:  float,
    suspicious: bool,
) -> None:
    """Horizontal bar showing normality score below the bounding box."""
    bar_h = 8
    fill  = int(np.clip(normality, 0, 1) * width)
    bg    = _DARK
    fg    = _RED if suspicious else _GREEN

    cv2.rectangle(frame, (x, y), (x + width, y + bar_h), bg, -1)
    if fill > 0:
        cv2.rectangle(frame, (x, y), (x + fill, y + bar_h), fg, -1)

    # Score text
    txt = f"Normality: {normality:.2f}"
    cv2.putText(frame, txt, (x, y + bar_h + 14), FONT, 0.45, _WHITE, 1, cv2.LINE_AA)


def _draw_skeleton(frame: np.ndarray, kps: np.ndarray) -> None:
    """Draw joints and limbs for a (15, 3) keypoint array."""
    h, w = frame.shape[:2]

    for (i, j) in LIMB_PAIRS:
        if kps[i, 2] < 0.2 or kps[j, 2] < 0.2:
            continue
        p1 = (int(np.clip(kps[i, 0], 0, w-1)), int(np.clip(kps[i, 1], 0, h-1)))
        p2 = (int(np.clip(kps[j, 0], 0, w-1)), int(np.clip(kps[j, 1], 0, h-1)))
        cv2.line(frame, p1, p2, _TEAL, 2, cv2.LINE_AA)

    for idx in range(NUM_KEYPOINTS):
        x, y, c = kps[idx]
        if c < 0.2:
            continue
        cx, cy = int(np.clip(x, 0, w-1)), int(np.clip(y, 0, h-1))
        cv2.circle(frame, (cx, cy), 4, _CYAN, -1, cv2.LINE_AA)


def draw_global_alert(frame: np.ndarray) -> None:
    """Full-width red banner at the top when any PID is suspicious."""
    h, w = frame.shape[:2]
    banner_h = 36
    overlay  = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, banner_h), (0, 0, 180), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    cv2.putText(
        frame, "⚠  SUSPICIOUS ACTIVITY DETECTED  ⚠",
        (w // 2 - 230, banner_h - 8), BOLD, 0.65, _WHITE, 2, cv2.LINE_AA,
    )


def draw_hud(
    frame:         np.ndarray,
    fps:           float,
    tau:           float,
    n_tracked:     int,
    adapt_next_h:  Optional[float] = None,
) -> None:
    """Heads-up display: FPS, threshold, tracked persons, next adaptation."""
    lines = [
        f"FPS: {fps:.1f}",
        f"tau: {tau:.4f}",
        f"Tracked: {n_tracked}",
    ]
    if adapt_next_h is not None:
        lines.append(f"Adapt in: {adapt_next_h:.1f}h")

    for i, txt in enumerate(lines):
        cv2.putText(
            frame, txt, (10, 22 + i * 20), FONT, 0.5, _WHITE, 1, cv2.LINE_AA
        )
