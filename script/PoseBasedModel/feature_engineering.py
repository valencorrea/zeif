"""
Feature engineering: converts a (T, 15, 3) pose window into a
(T, 75) feature tensor.

Feature layout per frame (75 dims):
  [0:30]  – Normalized positions  (15 joints × 2 coords)
  [30:60] – Velocities            (15 joints × 2 coords, temporal diff)
  [60:75] – Orientation angles    (15 joints × 1, arctan2 of velocity)
"""

from __future__ import annotations
import numpy as np

from pose_schema import NUM_KEYPOINTS

FEATURE_DIM = NUM_KEYPOINTS * 5  # 75

# Anchor joint indices for normalisation
MID_HIP_IDX    = 10  # used as origin
L_SHOULDER_IDX = 2
R_SHOULDER_IDX = 3
L_HIP_IDX      = 8
R_HIP_IDX      = 9


def _torso_length(positions: np.ndarray) -> float:
    """
    Median torso length across frames.

    positions: (T, 15, 2) – x/y coords
    Torso = distance from Neck (0) to Mid-Hip (10).
    """
    neck    = positions[:, 0, :]   # (T, 2)
    mid_hip = positions[:, MID_HIP_IDX, :]  # (T, 2)
    lengths = np.linalg.norm(neck - mid_hip, axis=1)  # (T,)
    median  = float(np.median(lengths))
    return median if median > 1e-6 else 1.0


def extract_features(window: np.ndarray) -> np.ndarray:
    """
    Args:
        window: (T, 15, 3) – preprocessed keypoints [x, y, conf]

    Returns:
        features: (T, 75) float32 array
    """
    T = window.shape[0]
    xy   = window[:, :, :2].copy()   # (T, 15, 2)
    # ── Normalised positions ───────────────────────────────────────────────────
    origin = xy[:, MID_HIP_IDX:MID_HIP_IDX+1, :]  # (T, 1, 2)  – broadcast anchor
    scale  = _torso_length(xy)

    norm_xy = (xy - origin) / scale   # (T, 15, 2)
    norm_pos = norm_xy.reshape(T, -1)  # (T, 30)

    # ── Velocities ─────────────────────────────────────────────────────────────
    # Frame 0 velocity = 0 (no previous frame)
    vel = np.zeros_like(norm_xy)       # (T, 15, 2)
    vel[1:] = norm_xy[1:] - norm_xy[:-1]
    velocities = vel.reshape(T, -1)    # (T, 30)

    # ── Orientation angles ──────────────────────────────────────────────────────
    # arctan2(vy, vx) – direction of motion for each joint
    angles = np.arctan2(vel[:, :, 1], vel[:, :, 0])  # (T, 15)  – in [-pi, pi]

    # ── Concatenate ────────────────────────────────────────────────────────────
    features = np.concatenate([norm_pos, velocities, angles], axis=1)  # (T, 75)
    return features.astype(np.float32)
