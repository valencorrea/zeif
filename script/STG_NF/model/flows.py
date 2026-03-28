"""
Normalizing Flow building blocks for the STG-NF model.

Three primitives:
  ActNorm          – data-dependent scale/shift initialisation (per-channel)
  InvertibleLinear – LU-decomposed 1×1 invertible convolution (spatial mixing)
  SpatialCoupling  – affine coupling with spatial body-part split + ST-GCN net

All modules expose:
  forward(x)  → (z, log_det)    [density estimation direction]
  inverse(z)  → x               [generation direction, unused at inference]
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from dataset.pose_schema import GROUP_A, GROUP_B
from model.stgcn import CouplingNetwork


# ── helpers ────────────────────────────────────────────────────────────────────

def _sum_except_batch(t: torch.Tensor) -> torch.Tensor:
    """Sum over all dimensions except batch (dim 0)."""
    return t.reshape(t.shape[0], -1).sum(dim=1)


# ── ActNorm ────────────────────────────────────────────────────────────────────

class ActNorm(nn.Module):
    """
    Activation normalisation (Glow §3.1).

    Learnable per-channel scale and bias initialised so that the first batch
    has zero mean and unit variance (data-dependent init).

    Input/output: (B, C, T, V)
    log_det contribution: T*V * sum(log |scale|)
    """

    def __init__(self, num_channels: int) -> None:
        super().__init__()
        self.num_channels = num_channels
        self.register_parameter("log_scale", nn.Parameter(torch.zeros(1, num_channels, 1, 1)))
        self.register_parameter("bias",      nn.Parameter(torch.zeros(1, num_channels, 1, 1)))
        self._initialised = False

    @torch.no_grad()
    def _data_init(self, x: torch.Tensor) -> None:
        # x: (B, C, T, V)
        mean = x.mean(dim=(0, 2, 3), keepdim=True)          # (1, C, 1, 1)
        std  = x.std(dim=(0, 2, 3), keepdim=True).clamp(min=1e-6)
        self.bias.data      = -mean
        self.log_scale.data = -std.log()
        self._initialised   = True

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        if not self._initialised:
            self._data_init(x)

        z = (x + self.bias) * self.log_scale.exp()

        # log|det J| = T*V * sum(log|scale|)
        _, _, T, V = x.shape
        log_det = _sum_except_batch(self.log_scale).expand(x.shape[0]) * T * V
        return z, log_det

    def inverse(self, z: torch.Tensor) -> torch.Tensor:
        return z * (-self.log_scale).exp() - self.bias


# ── InvertibleLinear ──────────────────────────────────────────────────────────

class InvertibleLinear(nn.Module):
    """
    Learnable 1×1 invertible convolution via LU decomposition (Glow §3.2).

    Mixes channels at every spatial/temporal position.
    Input/output: (B, C, T, V)
    log_det: T*V * log|det(W)|
    """

    def __init__(self, num_channels: int) -> None:
        super().__init__()
        # Initialise with a random orthogonal matrix (stable determinant = ±1)
        W_init, _ = torch.linalg.qr(torch.randn(num_channels, num_channels))
        self.register_parameter("W_raw", nn.Parameter(W_init))

    @property
    def W(self) -> torch.Tensor:
        return self.W_raw

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        # x: (B, C, T, V)
        W = self.W                                        # (C, C)
        z = F.conv2d(x, W.unsqueeze(-1).unsqueeze(-1))   # 1×1 conv

        _, _, T, V = x.shape
        # slogdet must run on CPU (MPS has no float64 support)
        log_det = (torch.slogdet(W.cpu().float())[1]
                   .to(x.device)
                   .expand(x.shape[0]) * T * V)
        return z, log_det

    def inverse(self, z: torch.Tensor) -> torch.Tensor:
        W_inv = torch.linalg.inv(self.W)
        return F.conv2d(z, W_inv.unsqueeze(-1).unsqueeze(-1))


# ── SpatialCoupling ─────────────────────────────────────────────────────────

class SpatialCoupling(nn.Module):
    """
    Affine coupling layer that splits along the *spatial joint* dimension.

    Alternating layers use GROUP_A→B and GROUP_B→A partitions:
      - Even layers: condition on GROUP_A joints, transform GROUP_B joints
      - Odd  layers: condition on GROUP_B joints, transform GROUP_A joints

    For a window of shape (B, C, T, V):
      x_a = x[..., group_cond]   # conditioning joints
      x_b = x[..., group_tgt]    # target joints
      s, t = coupling_net(x_a)
      z_b  = x_b * exp(s) + t
      log_det = sum(s)

    The full output z is reconstructed by re-inserting z_b at group_tgt indices.
    """

    def __init__(
        self,
        channels: int,
        hidden: int,
        layer_idx: int,
    ) -> None:
        super().__init__()
        # Alternating groups
        if layer_idx % 2 == 0:
            self.cond_idx = torch.tensor(GROUP_A, dtype=torch.long)  # 8 joints
            self.tgt_idx  = torch.tensor(GROUP_B, dtype=torch.long)  # 7 joints
        else:
            self.cond_idx = torch.tensor(GROUP_B, dtype=torch.long)
            self.tgt_idx  = torch.tensor(GROUP_A, dtype=torch.long)

        self.coupling = CouplingNetwork(
            in_channels  = channels,
            out_channels = channels,
            hidden       = hidden,
            V_in         = len(self.cond_idx),
            V_out        = len(self.tgt_idx),
        )

    def _move_indices(self, device: torch.device) -> None:
        """Move index tensors to the right device (lazy, once)."""
        if self.cond_idx.device != device:
            self.cond_idx = self.cond_idx.to(device)
            self.tgt_idx  = self.tgt_idx.to(device)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        self._move_indices(x.device)
        x_a = x.index_select(-1, self.cond_idx)    # (B, C, T, V_cond)
        x_b = x.index_select(-1, self.tgt_idx)     # (B, C, T, V_tgt)

        s, t = self.coupling(x_a)                   # each (B, C, T, V_tgt)
        z_b  = x_b * s.exp() + t

        log_det = _sum_except_batch(s)

        # Reconstruct full tensor preserving joint order
        z = x.clone()
        z.index_copy_(-1, self.tgt_idx, z_b)
        return z, log_det

    def inverse(self, z: torch.Tensor) -> torch.Tensor:
        self._move_indices(z.device)
        x_a = z.index_select(-1, self.cond_idx)
        z_b = z.index_select(-1, self.tgt_idx)

        s, t = self.coupling(x_a)
        x_b  = (z_b - t) * (-s).exp()

        x = z.clone()
        x.index_copy_(-1, self.tgt_idx, x_b)
        return x
