"""
Training and fine-tuning loop for the STG-NF model.

Responsibilities:
  - Standard training epoch on normal data (NLL minimisation)
  - Periodic adaptation training using 9:1 mixed data
  - Checkpoint save / load
  - MPS / CUDA / CPU device routing
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Optional

import torch
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

from config import (
    BATCH_SIZE, CHECKPOINT_DIR, GRAD_CLIP, LR, MAX_EPOCHS,
    WEIGHT_DECAY, ADAPT_BATCH, ADAPT_EPOCHS,
)
from model.stg_nf import STGNF


def _select_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


# ── helpers ────────────────────────────────────────────────────────────────────

def save_checkpoint(
    model: STGNF,
    optimizer: optim.Optimizer,
    epoch: int,
    best_loss: float,
    path: Path,
) -> None:
    torch.save(
        {
            "epoch":     epoch,
            "best_loss": best_loss,
            "model":     model.state_dict(),
            "optimizer": optimizer.state_dict(),
        },
        path,
    )


def load_checkpoint(
    model: STGNF,
    path: Path,
    optimizer: Optional[optim.Optimizer] = None,
    device: Optional[torch.device] = None,
) -> tuple[int, float]:
    """
    Load weights (and optionally optimizer state) from a checkpoint.
    Returns (epoch, best_loss).
    """
    ckpt = torch.load(path, map_location=device or "cpu")
    model.load_state_dict(ckpt["model"])
    if optimizer and "optimizer" in ckpt:
        optimizer.load_state_dict(ckpt["optimizer"])
    return ckpt.get("epoch", 0), ckpt.get("best_loss", float("inf"))


# ── training loop ─────────────────────────────────────────────────────────────

class Trainer:
    """
    Handles one full training run: initial training on normal-only data,
    or a shorter adaptation round on mixed data.
    """

    def __init__(
        self,
        model:       STGNF,
        device:      Optional[torch.device] = None,
        lr:          float = LR,
        weight_decay: float = WEIGHT_DECAY,
        max_epochs:  int   = MAX_EPOCHS,
        ckpt_dir:    Path  = CHECKPOINT_DIR,
        run_name:    str   = "stgnf",
    ) -> None:
        self.model       = model
        self.device      = device or _select_device()
        self.max_epochs  = max_epochs
        self.ckpt_dir    = Path(ckpt_dir)
        self.run_name    = run_name

        self.model.to(self.device)

        self.optimizer = optim.AdamW(
            model.parameters(), lr=lr, weight_decay=weight_decay
        )
        self.scheduler = optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=max_epochs, eta_min=lr * 0.01
        )

        self.best_loss   = float("inf")
        self.start_epoch = 0
        self._metrics: list[dict] = []

    # ── public API ─────────────────────────────────────────────────────────────

    def fit(
        self,
        train_loader: DataLoader,
        val_loader:   Optional[DataLoader] = None,
        resume_from:  Optional[Path]       = None,
    ) -> None:
        """Full training run."""
        if resume_from and resume_from.exists():
            self.start_epoch, self.best_loss = load_checkpoint(
                self.model, resume_from, self.optimizer, self.device
            )
            print(f"[trainer] Resumed from {resume_from} (epoch {self.start_epoch})")

        for epoch in range(self.start_epoch, self.max_epochs):
            t0       = time.time()
            train_loss = self._epoch(train_loader, training=True)
            val_loss   = self._epoch(val_loader,   training=False) if val_loader else None
            self.scheduler.step()

            elapsed = time.time() - t0
            record  = {
                "epoch": epoch,
                "train_nll": train_loss,
                "val_nll":   val_loss,
                "lr":        self.scheduler.get_last_lr()[0],
                "elapsed_s": elapsed,
            }
            self._metrics.append(record)
            self._log(record)

            # Save best checkpoint
            metric = val_loss if val_loss is not None else train_loss
            if metric < self.best_loss:
                self.best_loss = metric
                self._save("best.pt", epoch)

            # Periodic checkpoint every 10 epochs
            if (epoch + 1) % 10 == 0:
                self._save(f"epoch_{epoch+1:04d}.pt", epoch)

        self._save("last.pt", self.max_epochs - 1)
        self._dump_metrics()

    def adapt(
        self,
        mixed_loader: DataLoader,
        epochs: int = ADAPT_EPOCHS,
        out_path: Optional[Path] = None,
    ) -> Path:
        """
        Short fine-tuning pass for the Periodic Adaptation Pipeline.
        Saves weights to `out_path` (default: ckpt_dir/adapted_candidate.pt).
        Returns the path so the caller can perform an atomic swap.
        """
        if out_path is None:
            out_path = self.ckpt_dir / "adapted_candidate.pt"

        for epoch in range(epochs):
            loss = self._epoch(mixed_loader, training=True)
            print(f"[adapt] epoch {epoch+1}/{epochs}  NLL={loss:.6f}")

        torch.save(self.model.state_dict(), out_path)
        print(f"[adapt] Candidate weights saved to {out_path}")
        return out_path

    # ── internals ──────────────────────────────────────────────────────────────

    def _epoch(
        self,
        loader: Optional[DataLoader],
        training: bool,
    ) -> float:
        if loader is None:
            return float("nan")

        self.model.train(training)
        total_loss = 0.0
        n_batches  = 0

        ctx = torch.enable_grad() if training else torch.no_grad()
        with ctx:
            pbar = tqdm(loader, desc="train" if training else "val ", leave=False)
            for batch in pbar:
                # Accept plain tensors or (tensor, *) tuples from labelled datasets
                x = batch[0] if isinstance(batch, (list, tuple)) else batch
                x = x.to(self.device, non_blocking=True)
                loss = self.model.nll_loss(x)

                if training:
                    self.optimizer.zero_grad(set_to_none=True)
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(), GRAD_CLIP
                    )
                    self.optimizer.step()

                total_loss += float(loss.detach())
                n_batches  += 1
                pbar.set_postfix(nll=f"{float(loss.detach()):.4f}")

        return total_loss / max(n_batches, 1)

    def _save(self, name: str, epoch: int) -> None:
        path = self.ckpt_dir / f"{self.run_name}_{name}"
        save_checkpoint(self.model, self.optimizer, epoch, self.best_loss, path)

    @staticmethod
    def _log(record: dict) -> None:
        parts = [f"epoch={record['epoch']}",
                 f"train={record['train_nll']:.6f}"]
        if record["val_nll"] is not None:
            parts.append(f"val={record['val_nll']:.6f}")
        parts.append(f"lr={record['lr']:.2e}")
        parts.append(f"t={record['elapsed_s']:.1f}s")
        print("[trainer] " + "  ".join(parts))

    def _dump_metrics(self) -> None:
        out = self.ckpt_dir / f"{self.run_name}_metrics.json"
        with open(out, "w") as f:
            json.dump(self._metrics, f, indent=2)
        print(f"[trainer] Metrics saved to {out}")
