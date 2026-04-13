"""
Single inference pass: converts a preprocessed (T, 15, 3) window
into a shoplifter probability using the TrajectoryModel.
"""

from __future__ import annotations

import numpy as np
import torch

from feature_engineering import extract_features
from model import TrajectoryModel


def run_inference(
    model: TrajectoryModel,
    window: np.ndarray,
    device: torch.device,
) -> float:
    """
    Args:
        model:   trained TrajectoryModel (eval mode)
        window:  (T, 15, 3) preprocessed keypoints
        device:  torch device (mps / cpu / cuda)

    Returns:
        p_shoplifter: float in [0, 1]
    """
    features = extract_features(window)              # (T, 75)
    x = torch.from_numpy(features).unsqueeze(0).to(device)  # (1, T, 75)

    with torch.no_grad():
        probs, _ = model(x)   # (1, 2)

    return float(probs[0, 1].cpu())  # P(shoplifter)
