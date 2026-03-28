"""
Skeleton graph adjacency matrices for the 15-keypoint schema.

Two adjacency strategies are provided:
  - binary:     A[i,j] = 1 if (i,j) is a skeleton edge (self-loops included)
  - normalised: D^{-1/2} A D^{-1/2}  (symmetric normalisation)

Both return NumPy arrays of shape (V, V).
"""
from __future__ import annotations
import numpy as np
import torch

from dataset.pose_schema import NUM_KEYPOINTS, SKELETON_EDGES


def build_adjacency(
    strategy: str = "normalised",
    add_self_loops: bool = True,
) -> np.ndarray:
    """
    Build (V, V) adjacency matrix.

    Args:
        strategy:        'binary' | 'normalised'
        add_self_loops:  add identity to A before normalisation
    Returns:
        A: (V, V) float32
    """
    V = NUM_KEYPOINTS
    A = np.zeros((V, V), dtype=np.float32)

    for (i, j) in SKELETON_EDGES:
        A[i, j] = 1.0
        A[j, i] = 1.0  # undirected

    if add_self_loops:
        A += np.eye(V, dtype=np.float32)

    if strategy == "binary":
        return A

    if strategy == "normalised":
        # D^{-1/2} A D^{-1/2}
        d   = A.sum(axis=1)
        d_inv_sqrt = np.where(d > 0, 1.0 / np.sqrt(d), 0.0)
        D_inv_sqrt = np.diag(d_inv_sqrt)
        return (D_inv_sqrt @ A @ D_inv_sqrt).astype(np.float32)

    raise ValueError(f"Unknown adjacency strategy: {strategy}")


def adjacency_tensor(strategy: str = "normalised") -> torch.Tensor:
    """Return the adjacency matrix as a float32 torch.Tensor (V, V)."""
    return torch.from_numpy(build_adjacency(strategy))
