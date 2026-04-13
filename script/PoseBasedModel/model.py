"""
TrajectoryModel – Pose-Based LSTM for shoplifting detection.

Architecture:
  Input  : (B, T, 75)
  Encoder: 2-layer unidirectional LSTM (hidden=128)
  Attn   : Bahdanau-style additive attention over time steps
  Head   : Dropout(0.5) -> Linear(128, 2) -> Softmax
  Output : (B, 2)  class probabilities [P_normal, P_shoplifter]
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class BahdanauAttention(nn.Module):
    """
    Additive attention that learns to focus on discriminative frames
    (e.g. concealment moments).

        score(h_t) = v^T * tanh(W * h_t + b)
        alpha       = softmax(score)
        context     = sum_t alpha_t * h_t
    """

    def __init__(self, hidden_size: int) -> None:
        super().__init__()
        self.W = nn.Linear(hidden_size, hidden_size, bias=True)
        self.v = nn.Linear(hidden_size, 1, bias=False)

    def forward(self, encoder_outputs: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            encoder_outputs: (B, T, H)

        Returns:
            context: (B, H)  – weighted sum of hidden states
            alpha:   (B, T)  – attention weights (for visualisation)
        """
        # score : (B, T, 1)
        score = self.v(torch.tanh(self.W(encoder_outputs)))
        alpha = F.softmax(score, dim=1)          # (B, T, 1)
        context = (alpha * encoder_outputs).sum(dim=1)  # (B, H)
        return context, alpha.squeeze(-1)


class TrajectoryModel(nn.Module):
    """
    Binary classifier: Normal (0) vs. Shoplifter (1).
    """

    INPUT_DIM  = 75
    HIDDEN_DIM = 128
    NUM_LAYERS = 2
    NUM_CLASSES = 2
    DROPOUT = 0.5

    def __init__(self) -> None:
        super().__init__()

        self.lstm = nn.LSTM(
            input_size=self.INPUT_DIM,
            hidden_size=self.HIDDEN_DIM,
            num_layers=self.NUM_LAYERS,
            batch_first=True,
            dropout=self.DROPOUT if self.NUM_LAYERS > 1 else 0.0,
            bidirectional=False,
        )

        self.attention = BahdanauAttention(self.HIDDEN_DIM)

        self.classifier = nn.Sequential(
            nn.Dropout(p=self.DROPOUT),
            nn.Linear(self.HIDDEN_DIM, self.NUM_CLASSES),
        )

    def forward(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (B, T, 75) feature tensor

        Returns:
            probs:  (B, 2)  – class probabilities after softmax
            alphas: (B, T)  – attention weights
        """
        # LSTM: all hidden states
        enc_out, _ = self.lstm(x)            # (B, T, H)

        # Attention pooling
        context, alphas = self.attention(enc_out)  # (B, H), (B, T)

        # Classification head
        logits = self.classifier(context)    # (B, 2)
        probs  = F.softmax(logits, dim=-1)   # (B, 2)

        return probs, alphas


def load_model(weights_path: str | None, device: torch.device) -> TrajectoryModel:
    """
    Instantiate TrajectoryModel, optionally loading pre-trained weights.
    Model is placed on `device` and set to eval mode.
    """
    model = TrajectoryModel().to(device)

    if weights_path is not None:
        state = torch.load(weights_path, map_location=device)
        model.load_state_dict(state)
        print(f"[model] Loaded weights from {weights_path}")
    else:
        print("[model] No weights provided – running with random initialisation (demo mode)")

    model.eval()
    return model
