"""
Quality Control filtering and temporal smoothing for pose sequences.
"""

from __future__ import annotations
from typing import List, Optional

import numpy as np
from scipy.signal import savgol_filter

from pose_schema import LIMB_PAIRS, NUM_KEYPOINTS

# ── QC thresholds ──────────────────────────────────────────────────────────────
MAX_KEYPOINT_DISPLACEMENT_PX = 100.0
MAX_LIMB_LENGTH_CHANGE_PX    = 20.0
MIN_MEAN_CONFIDENCE          = 0.3

# ── Smoothing params ───────────────────────────────────────────────────────────
INTERP_MAX_GAP   = 3   # interpolate gaps up to this many frames
SG_WINDOW_LENGTH = 5   # Savitzky-Golay window (must be odd, >= poly_order+1)
SG_POLY_ORDER    = 2


def _limb_length(kps: np.ndarray, i: int, j: int) -> float:
    """Euclidean distance between keypoints i and j in a (15,3) array."""
    return float(np.linalg.norm(kps[i, :2] - kps[j, :2]))


def window_passes_qc(window: np.ndarray) -> bool:
    """
    Return True if a (T, 15, 3) keypoint window passes all QC gates.

    Gates (any failure -> reject):
      1. Max keypoint displacement between consecutive frames <= 100 px
      2. Max limb-length change between consecutive frames <= 20 px
      3. Mean joint confidence across all frames >= 0.3
    """
    T = window.shape[0]

    # Gate 3: mean confidence
    mean_conf = float(np.mean(window[:, :, 2]))
    if mean_conf < MIN_MEAN_CONFIDENCE:
        return False

    for t in range(1, T):
        prev = window[t - 1]  # (15, 3)
        curr = window[t]      # (15, 3)

        # Gate 1: keypoint displacement
        displacements = np.linalg.norm(curr[:, :2] - prev[:, :2], axis=1)  # (15,)
        if float(np.max(displacements)) > MAX_KEYPOINT_DISPLACEMENT_PX:
            return False

        # Gate 2: limb-length change
        for (i, j) in LIMB_PAIRS:
            delta = abs(_limb_length(curr, i, j) - _limb_length(prev, i, j))
            if delta > MAX_LIMB_LENGTH_CHANGE_PX:
                return False

    return True


def interpolate_gaps(window: np.ndarray) -> np.ndarray:
    """
    Linear interpolation for low-confidence keypoints over gaps <= INTERP_MAX_GAP.

    window: (T, 15, 3)  – xy coords + confidence
    Returns a copy with gaps filled.
    """
    T, K, _ = window.shape
    result = window.copy()

    for k in range(K):
        # Treat conf < MIN_MEAN_CONFIDENCE as "missing"
        missing = result[:, k, 2] < MIN_MEAN_CONFIDENCE

        if not missing.any():
            continue

        # Walk through runs of missing frames
        t = 0
        while t < T:
            if missing[t]:
                # Find gap boundaries
                start = t - 1  # last good frame before gap
                end   = t
                while end < T and missing[end]:
                    end += 1
                gap_len = end - (start + 1)

                if gap_len <= INTERP_MAX_GAP and start >= 0 and end < T:
                    # Interpolate x and y
                    for dim in range(2):
                        v0 = result[start, k, dim]
                        v1 = result[end,   k, dim]
                        for i, frame in enumerate(range(start + 1, end)):
                            alpha = (i + 1) / (gap_len + 1)
                            result[frame, k, dim] = v0 + alpha * (v1 - v0)
                    # Restore confidence to average of boundaries
                    avg_conf = (result[start, k, 2] + result[end, k, 2]) / 2.0
                    for frame in range(start + 1, end):
                        result[frame, k, 2] = avg_conf

                t = end
            else:
                t += 1

    return result


def smooth_window(window: np.ndarray) -> np.ndarray:
    """
    Apply Savitzky-Golay filter along the time axis to x and y coordinates.

    window: (T, 15, 3)
    Returns smoothed copy (confidence values unchanged).
    """
    T, K, _ = window.shape
    result = window.copy()

    if T < SG_WINDOW_LENGTH:
        return result  # not enough frames to filter

    for k in range(K):
        for dim in range(2):  # x, y only
            result[:, k, dim] = savgol_filter(
                result[:, k, dim],
                window_length=SG_WINDOW_LENGTH,
                polyorder=SG_POLY_ORDER,
            )

    return result


def preprocess_window(window: np.ndarray) -> Optional[np.ndarray]:
    """
    Full preprocessing pipeline: interpolate -> smooth -> QC check.

    Args:
        window: (T, 15, 3) raw keypoint window

    Returns:
        Preprocessed (T, 15, 3) if QC passes, else None.
    """
    w = interpolate_gaps(window)
    w = smooth_window(w)
    if not window_passes_qc(w):
        return None
    return w
