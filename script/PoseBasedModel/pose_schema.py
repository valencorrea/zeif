"""
Keypoint schema definition.

COCO 17-keypoint raw indices:
  0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear
  5: left_shoulder, 6: right_shoulder, 7: left_elbow, 8: right_elbow
  9: left_wrist, 10: right_wrist, 11: left_hip, 12: right_hip
  13: left_knee, 14: right_knee, 15: left_ankle, 16: right_ankle

Derived 15-keypoint schema (facial landmarks dropped, Neck + Chest added):
  0: Neck          – midpoint(left_shoulder, right_shoulder)
  1: Chest         – midpoint(Neck, Mid-Hip)
  2: left_shoulder
  3: right_shoulder
  4: left_elbow
  5: right_elbow
  6: left_wrist
  7: right_wrist
  8: left_hip
  9: right_hip
  10: Mid-Hip      – midpoint(left_hip, right_hip)
  11: left_knee
  12: right_knee
  13: left_ankle
  14: right_ankle
"""

from __future__ import annotations
import numpy as np

NUM_KEYPOINTS = 15

# Human-readable names for each keypoint in our 15-pt schema
KEYPOINT_NAMES = [
    "Neck",          # 0
    "Chest",         # 1
    "LShoulder",     # 2
    "RShoulder",     # 3
    "LElbow",        # 4
    "RElbow",        # 5
    "LWrist",        # 6
    "RWrist",        # 7
    "LHip",          # 8
    "RHip",          # 9
    "MidHip",        # 10
    "LKnee",         # 11
    "RKnee",         # 12
    "LAnkle",        # 13
    "RAnkle",        # 14
]

# Limb pairs (index into our 15-pt schema) used for QC limb-length checks
LIMB_PAIRS = [
    (0, 2),   # Neck -> LShoulder
    (0, 3),   # Neck -> RShoulder
    (2, 4),   # LShoulder -> LElbow
    (3, 5),   # RShoulder -> RElbow
    (4, 6),   # LElbow -> LWrist
    (5, 7),   # RElbow -> RWrist
    (0, 1),   # Neck -> Chest
    (1, 10),  # Chest -> MidHip
    (10, 8),  # MidHip -> LHip
    (10, 9),  # MidHip -> RHip
    (8, 11),  # LHip -> LKnee
    (9, 12),  # RHip -> RKnee
    (11, 13), # LKnee -> LAnkle
    (12, 14), # RKnee -> RAnkle
]


def build_15kp_from_coco(raw_kps: np.ndarray) -> np.ndarray:
    """
    Convert COCO 17-keypoint array to our 15-keypoint schema.

    Args:
        raw_kps: shape (17, 3) with columns [x, y, confidence]

    Returns:
        kps: shape (15, 3) – our derived schema
    """
    assert raw_kps.shape == (17, 3), f"Expected (17,3), got {raw_kps.shape}"

    l_shoulder = raw_kps[5]   # (x, y, conf)
    r_shoulder = raw_kps[6]
    l_hip      = raw_kps[11]
    r_hip      = raw_kps[12]

    def midpoint(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        xy   = (a[:2] + b[:2]) / 2.0
        conf = (a[2]  + b[2])  / 2.0
        return np.array([xy[0], xy[1], conf], dtype=np.float32)

    neck    = midpoint(l_shoulder, r_shoulder)
    mid_hip = midpoint(l_hip, r_hip)
    chest   = midpoint(neck, mid_hip)

    kps = np.stack([
        neck,           # 0
        chest,          # 1
        l_shoulder,     # 2
        r_shoulder,     # 3
        raw_kps[7],     # 4 LElbow
        raw_kps[8],     # 5 RElbow
        raw_kps[9],     # 6 LWrist
        raw_kps[10],    # 7 RWrist
        l_hip,          # 8
        r_hip,          # 9
        mid_hip,        # 10
        raw_kps[13],    # 11 LKnee
        raw_kps[14],    # 12 RKnee
        raw_kps[15],    # 13 LAnkle
        raw_kps[16],    # 14 RAnkle
    ], axis=0)  # (15, 3)

    return kps.astype(np.float32)
