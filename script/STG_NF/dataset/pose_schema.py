"""
15-keypoint schema shared across the entire STG-NF pipeline.

COCO 17-pt raw indices
  0:nose 1:L-eye 2:R-eye 3:L-ear 4:R-ear
  5:L-shoulder 6:R-shoulder 7:L-elbow 8:R-elbow
  9:L-wrist 10:R-wrist 11:L-hip 12:R-hip
  13:L-knee 14:R-knee 15:L-ankle 16:R-ankle

Derived 15-pt schema (facial landmarks removed, Neck / Chest derived)
  0: Neck      = midpoint(L-shoulder, R-shoulder)
  1: Chest     = midpoint(Neck, Mid-Hip)
  2: LShoulder
  3: RShoulder
  4: LElbow
  5: RElbow
  6: LWrist
  7: RWrist
  8: LHip
  9: RHip
 10: MidHip    = midpoint(L-hip, R-hip)
 11: LKnee
 12: RKnee
 13: LAnkle
 14: RAnkle

Spatial groups for alternating coupling masks
  GROUP_A (upper body, 8 joints): 0-7
  GROUP_B (lower body, 7 joints): 8-14
"""
from __future__ import annotations
import numpy as np

NUM_KEYPOINTS = 15

KEYPOINT_NAMES = [
    "Neck", "Chest",
    "LShoulder", "RShoulder",
    "LElbow", "RElbow",
    "LWrist", "RWrist",
    "LHip", "RHip", "MidHip",
    "LKnee", "RKnee",
    "LAnkle", "RAnkle",
]

# Joint indices for normalisation
NECK_IDX    = 0
MID_HIP_IDX = 10

GROUP_A = list(range(0, 8))    # upper body (8 joints)
GROUP_B = list(range(8, 15))   # lower body (7 joints)

# Skeleton edges (undirected) used for graph adjacency
SKELETON_EDGES = [
    (0, 1), (0, 2), (0, 3),   # Neck connections
    (2, 4), (3, 5),            # shoulder→elbow
    (4, 6), (5, 7),            # elbow→wrist
    (1, 10),                   # Chest→MidHip
    (10, 8), (10, 9),          # MidHip→hips
    (8, 11), (9, 12),          # hip→knee
    (11, 13), (12, 14),        # knee→ankle
]

# Limb pairs for QC (same set as edges)
LIMB_PAIRS = SKELETON_EDGES


def build_15kp_from_coco(raw: np.ndarray) -> np.ndarray:
    """
    Convert COCO-17 keypoints to our 15-kp schema.

    Args:
        raw: (17, 3)  [x, y, confidence]
    Returns:
        kps: (15, 3)
    """
    assert raw.shape == (17, 3), raw.shape

    def mid(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.array([(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2],
                        dtype=np.float32)

    ls, rs  = raw[5],  raw[6]
    lh, rh  = raw[11], raw[12]
    neck    = mid(ls, rs)
    mid_hip = mid(lh, rh)
    chest   = mid(neck, mid_hip)

    return np.stack([
        neck, chest,
        ls, rs,
        raw[7], raw[8],   # elbows
        raw[9], raw[10],  # wrists
        lh, rh, mid_hip,
        raw[13], raw[14], # knees
        raw[15], raw[16], # ankles
    ]).astype(np.float32)


def normalize_pose(kps: np.ndarray, torso_scale: float | None = None) -> np.ndarray:
    """
    Center on MidHip; scale by median torso length (Neck–MidHip distance).

    Args:
        kps:         (T, 15, 2) – x/y only, already stripped of confidence
        torso_scale: if provided, use this fixed scale (for test-time consistency)
    Returns:
        norm_kps:    (T, 15, 2)
        scale:       float – torso scale used (useful to cache at test time)
    """
    origin = kps[:, MID_HIP_IDX:MID_HIP_IDX+1, :]   # (T, 1, 2)
    centred = kps - origin

    if torso_scale is None:
        neck    = centred[:, NECK_IDX, :]             # (T, 2)
        lengths = np.linalg.norm(neck, axis=1)        # (T,)
        torso_scale = float(np.median(lengths)) or 1.0

    return (centred / torso_scale).astype(np.float32), torso_scale
