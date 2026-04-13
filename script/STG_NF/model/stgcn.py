"""
Spatio-Temporal Graph Convolution Network building blocks.

These act as the *coupling network* inside each affine coupling layer of the
STG-NF flow: they take a subset of joints as input and produce per-joint
scale (s) and shift (t) tensors for the complementary joint subset.

Shapes throughout:  (B, C, T, V)
  B – batch
  C – channels (starts at COORDS=2, projected to HIDDEN_CHANNELS)
  T – time steps (WINDOW_T = 24)
  V – joints (NUM_KEYPOINTS = 15, or a subset)
"""
from __future__ import annotations
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F

from model.graph import adjacency_tensor
from dataset.pose_schema import NUM_KEYPOINTS


class SpatialGraphConv(nn.Module):
    """
    Single-partition spatial graph convolution:
        Y = σ( W  * (A_hat ⊗ X) )

    A_hat is registered as a non-trainable buffer so it moves with the module
    to whatever device the model lives on.
    """

    def __init__(self, in_channels: int, out_channels: int, V: int = NUM_KEYPOINTS) -> None:
        super().__init__()
        A = adjacency_tensor("normalised")          # (V, V) – full skeleton
        # Subgraph: take the top-left V×V block if V < NUM_KEYPOINTS
        self.register_buffer("A", A[:V, :V])
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, C, T, V)
        # A: (V, V)
        # out: (B, C_out, T, V)
        support = torch.einsum("bctn,nm->bctm", x, self.A)
        return self.conv(support)


class TemporalConv(nn.Module):
    """
    Temporal (1-D) convolution over the time axis with optional dilation.
    Kernel is applied per-joint independently (grouped conv = depthwise along V).
    """

    def __init__(
        self,
        channels: int,
        kernel_size: int = 3,
        dilation: int = 1,
    ) -> None:
        super().__init__()
        pad = (kernel_size - 1) * dilation // 2
        self.conv = nn.Conv2d(
            channels, channels,
            kernel_size=(kernel_size, 1),
            padding=(pad, 0),
            dilation=(dilation, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.conv(x)


class STGCNBlock(nn.Module):
    """
    One ST-GCN block: SpatialGraphConv → BN → ReLU → TemporalConv → BN → ReLU
    with an optional residual projection.
    """

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        V: int = NUM_KEYPOINTS,
        temporal_kernel: int = 3,
        dilation: int = 1,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        self.spatial = SpatialGraphConv(in_channels, out_channels, V)
        self.bn_s    = nn.BatchNorm2d(out_channels)
        self.temporal = TemporalConv(out_channels, temporal_kernel, dilation)
        self.bn_t    = nn.BatchNorm2d(out_channels)
        self.drop    = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

        self.residual = (
            nn.Conv2d(in_channels, out_channels, kernel_size=1)
            if in_channels != out_channels
            else nn.Identity()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        res = self.residual(x)
        out = F.relu(self.bn_s(self.spatial(x)))
        out = F.relu(self.bn_t(self.temporal(out)))
        return self.drop(out + res)


class CouplingNetwork(nn.Module):
    """
    Coupling network used inside each affine coupling layer.

    Takes a (B, C_in, T, V_in) input (the 'conditioner' joint group) and
    produces (s, t) each of shape (B, C_out, T, V_out) for the 'target' group.

    Two ST-GCN blocks followed by a 1×1 conv to output 2×C_out channels
    (first half = log-scale s, second half = shift t).

    The tanh on s keeps log-scale bounded, preventing exploding determinants.
    """

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        hidden: int,
        V_in: int,
        V_out: int,
    ) -> None:
        super().__init__()
        self.V_out = V_out
        self.C_out = out_channels

        self.net = nn.Sequential(
            STGCNBlock(in_channels, hidden, V=V_in),
            STGCNBlock(hidden,      hidden, V=V_in),
        )
        # Project from V_in joints to V_out joints via MLP on last dim
        self.joint_proj = nn.Linear(V_in, V_out)
        # Output: 2 * out_channels (s and t interleaved)
        self.out_conv = nn.Conv2d(hidden, 2 * out_channels, kernel_size=1)

        # Initialise output to zero so the flow starts as identity
        nn.init.zeros_(self.out_conv.weight)
        nn.init.zeros_(self.out_conv.bias)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (B, C_in, T, V_in)
        Returns:
            s: (B, C_out, T, V_out)  log-scale
            t: (B, C_out, T, V_out)  shift
        """
        h = self.net(x)                             # (B, hidden, T, V_in)
        h = self.joint_proj(h)                      # (B, hidden, T, V_out)
        st = self.out_conv(h)                       # (B, 2*C_out, T, V_out)
        s_raw, t = st.chunk(2, dim=1)               # each (B, C_out, T, V_out)
        s = torch.tanh(s_raw)                       # bounded log-scale
        return s, t
