"""
STG-NF: Spatio-Temporal Graph Normalizing Flow for unsupervised anomaly detection.

The model learns a bijective mapping from normal pose trajectories to a standard
Gaussian distribution by training on normal data only.

Architecture (one "step" repeated FLOW_DEPTH times):
  ActNorm  →  InvertibleLinear  →  SpatialCoupling

Training objective:
  min  -log p(z)  -  log|det J|
  = min  0.5 * ||z||^2  -  log_det_sum
         ^^^^^^^^^^^       ^^^^^^^^^^^
         Gaussian NLL       flow log-det

Anomaly score at inference:
  score(x) = -log p(x)   (higher = more anomalous)
  normality_score = exp(-score / D)  ∈ (0, 1]  (higher = more normal)
  where D = total input dimensionality (C * T * V)
"""
from __future__ import annotations
from typing import Optional

import torch
import torch.nn as nn
import numpy as np

from config import FLOW_DEPTH, HIDDEN_CHANNELS, COORDS, WINDOW_T, NUM_JOINTS
from model.flows import ActNorm, InvertibleLinear, SpatialCoupling

LOG_2PI = float(np.log(2 * np.pi))
INPUT_DIM = COORDS * WINDOW_T * NUM_JOINTS  # 2 * 24 * 15 = 720


class FlowStep(nn.Module):
    """ActNorm → InvertibleLinear → SpatialCoupling (one step of the flow)."""

    def __init__(self, channels: int, hidden: int, step_idx: int) -> None:
        super().__init__()
        self.actnorm = ActNorm(channels)
        self.inv_lin = InvertibleLinear(channels)
        self.coupling = SpatialCoupling(channels, hidden, layer_idx=step_idx)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        z, ld1 = self.actnorm(x)
        z, ld2 = self.inv_lin(z)
        z, ld3 = self.coupling(z)
        return z, ld1 + ld2 + ld3

    def inverse(self, z: torch.Tensor) -> torch.Tensor:
        x = self.coupling.inverse(z)
        x = self.inv_lin.inverse(x)
        x = self.actnorm.inverse(x)
        return x


class STGNF(nn.Module):
    """
    Spatio-Temporal Graph Normalizing Flow model.

    Input/output shape:  (B, C, T, V) = (B, 2, 24, 15)
    """

    def __init__(
        self,
        flow_depth: int   = FLOW_DEPTH,
        hidden:     int   = HIDDEN_CHANNELS,
        channels:   int   = COORDS,
    ) -> None:
        super().__init__()
        self.input_dim = INPUT_DIM

        self.steps = nn.ModuleList([
            FlowStep(channels, hidden, i) for i in range(flow_depth)
        ])

    # ── density estimation ────────────────────────────────────────────────────

    def forward(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (B, C, T, V)  normalised pose trajectory

        Returns:
            z:       (B, C, T, V)  Gaussian-distributed latent
            log_det: (B,)         sum of log|det J| across all steps
        """
        log_det = torch.zeros(x.shape[0], device=x.device)
        z = x
        for step in self.steps:
            z, ld = step(z)
            log_det = log_det + ld
        return z, log_det

    def log_prob(self, x: torch.Tensor) -> torch.Tensor:
        """
        Returns log p(x) per sample.  Shape: (B,)

        log p(x) = log p_z(z) + log|det J|
                 = -0.5*(||z||^2 + D*log(2π)) + log_det
        """
        z, log_det = self.forward(x)
        z_flat   = z.reshape(z.shape[0], -1)              # (B, D)
        log_pz   = -0.5 * (z_flat.pow(2).sum(dim=1) + self.input_dim * LOG_2PI)
        return log_pz + log_det

    def nll_loss(self, x: torch.Tensor) -> torch.Tensor:
        """
        Mean negative log-likelihood over the batch.
        Normalised by input dimensionality for stable magnitude across configs.
        """
        return -self.log_prob(x).mean() / self.input_dim

    # ── scoring ───────────────────────────────────────────────────────────────

    @torch.no_grad()
    def anomaly_score(self, x: torch.Tensor) -> torch.Tensor:
        """
        Unnormalised anomaly score: -log p(x).  Shape: (B,)
        Higher value → more anomalous.
        """
        return -self.log_prob(x)

    @torch.no_grad()
    def normality_score(self, x: torch.Tensor) -> torch.Tensor:
        """
        Normality score ∈ (0, 1].  Shape: (B,)
        Higher → more normal.  Suitable for real-time overlay.
        """
        neg_ll = self.anomaly_score(x) / self.input_dim
        return torch.exp(-neg_ll.clamp(min=0))

    # ── generation (inverse, for debugging) ──────────────────────────────────

    @torch.no_grad()
    def sample(self, n: int, device: torch.device) -> torch.Tensor:
        """Generate `n` random pose trajectories from the learnt distribution."""
        z = torch.randn(n, COORDS, WINDOW_T, NUM_JOINTS, device=device)
        x = z
        for step in reversed(self.steps):
            x = step.inverse(x)
        return x


def build_model(
    flow_depth: int = FLOW_DEPTH,
    hidden:     int = HIDDEN_CHANNELS,
    device: Optional[torch.device] = None,
) -> STGNF:
    """Convenience factory. Places model on `device`."""
    model = STGNF(flow_depth=flow_depth, hidden=hidden)
    if device is not None:
        model = model.to(device)
    return model
