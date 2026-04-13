"""
Periodic Adaptation Pipeline – Algorithm 1.

Three-stage loop running in a background thread:

  ┌─────────────────────────────────────────────────────────┐
  │  Continuously (webcam loop in main thread)              │
  │    Stage 1 – FILTER:  score = model(window)             │
  │               if score < τ → add to D_low               │
  │    Stage 2 – COLLECT: D_low accumulates until interval  │
  │                                                         │
  │  Every ADAPT_INTERVAL_H hours (background thread)       │
  │    Stage 3 – TRAIN:                                     │
  │      a. Build mixed loader (9:1 D_low + anomaly)        │
  │      b. Fine-tune model → candidate weights             │
  │      c. Atomic weight swap: live model ← candidate      │
  └─────────────────────────────────────────────────────────┘

The live model is protected by a threading.Lock during the weight swap so the
webcam loop is never interrupted for more than a few milliseconds.
"""
from __future__ import annotations

import copy
import threading
import time
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from torch.utils.data import DataLoader

from config import (
    ADAPT_BATCH, ADAPT_EPOCHS, ADAPT_INTERVAL_H,
    CHECKPOINT_DIR, MIX_RATIO,
)
from dataset.retail_dataset import RetailSTestDataset, WebcamWindowDataset
from model.stg_nf import STGNF
from training.mixing import MixedWindowDataset
from training.trainer import Trainer
from adaptation.buffer import LowScoreBuffer


class AdaptationPipeline:
    """
    Manages the three-stage periodic adaptation loop.

    Args:
        model:           The live STGNF model (shared with the inference loop).
        device:          Torch device the model lives on.
        anomaly_dataset: RetailS staged anomaly windows for 9:1 mixing.
        tau:             Current anomaly score threshold.
        buffer:          D_low buffer instance (can be shared).
        interval_hours:  How often to trigger a training job.
        ckpt_dir:        Where to save candidate weights.
    """

    def __init__(
        self,
        model:           STGNF,
        device:          torch.device,
        anomaly_dataset: RetailSTestDataset,
        tau:             float,
        buffer:          Optional[LowScoreBuffer] = None,
        interval_hours:  float = ADAPT_INTERVAL_H,
        ckpt_dir:        Path  = CHECKPOINT_DIR,
    ) -> None:
        self.model           = model
        self.device          = device
        self.anomaly_dataset = anomaly_dataset
        self.tau             = tau
        self.interval_s      = interval_hours * 3600
        self.ckpt_dir        = Path(ckpt_dir)

        self.buffer   = buffer or LowScoreBuffer()
        self._lock    = threading.Lock()          # guards weight swap
        self._stop    = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._last_adapt = time.time()

    # ── Stage 1+2: Filtering and Collection ─────────────────────────────────

    def filter_and_collect(
        self, window: np.ndarray, anomaly_score: float
    ) -> None:
        """
        Called by the webcam loop for every scored window.

        If score < τ the window is silently added to D_low.
        Thread-safe: uses the buffer's internal lock.
        """
        self.buffer.push(window, anomaly_score, self.tau)

    # ── Stage 3: Asynchronous Training ───────────────────────────────────────

    def start(self) -> None:
        """Launch the background adaptation scheduler thread."""
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._scheduler_loop,
            daemon=True,
            name="AdaptationScheduler",
        )
        self._thread.start()
        print(f"[adapt] Scheduler started  (interval = {self.interval_s/3600:.1f}h)")

    def stop(self) -> None:
        """Signal the scheduler to stop after the current sleep completes."""
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
        self.buffer.flush()
        print("[adapt] Scheduler stopped")

    def update_tau(self, new_tau: float) -> None:
        self.tau = new_tau

    # ── Model access (thread-safe) ────────────────────────────────────────────

    def get_model(self) -> STGNF:
        """Return the model under the lock (safe to use for inference)."""
        with self._lock:
            return self.model

    def _atomic_swap(self, new_state_dict: dict) -> None:
        """Replace live model weights without interrupting the inference loop."""
        with self._lock:
            self.model.load_state_dict(new_state_dict)
        print("[adapt] Atomic weight swap complete")

    # ── Internal scheduler ────────────────────────────────────────────────────

    def _scheduler_loop(self) -> None:
        while not self._stop.is_set():
            elapsed = time.time() - self._last_adapt
            remaining = self.interval_s - elapsed

            if remaining > 0:
                # Sleep in small chunks so we can respond to stop signal
                self._stop.wait(timeout=min(remaining, 60))
                continue

            # Time to adapt
            self._run_adaptation()
            self._last_adapt = time.time()

    def _run_adaptation(self) -> None:
        n_low = len(self.buffer)
        print(f"[adapt] Starting adaptation round  |D_low|={n_low}")

        if n_low < ADAPT_BATCH:
            print(f"[adapt] Not enough data ({n_low} < {ADAPT_BATCH}) – skipping")
            return

        # ── Build datasets ─────────────────────────────────────────────────
        low_windows = self.buffer.drain()
        normal_ds   = WebcamWindowDataset(low_windows)
        anomaly_ds  = self.anomaly_dataset  # staged shoplifting windows

        try:
            mixed_ds = MixedWindowDataset(normal_ds, anomaly_ds, ratio=MIX_RATIO)
        except ValueError as e:
            print(f"[adapt] Cannot build mixed dataset: {e}")
            return

        loader = mixed_ds.build_loader(
            batch_size  = ADAPT_BATCH,
            num_workers = 0,
        )

        # ── Train a deep copy of the model (non-blocking) ──────────────────
        candidate = copy.deepcopy(self.model).to(self.device)
        trainer   = Trainer(
            model      = candidate,
            device     = self.device,
            max_epochs = ADAPT_EPOCHS,
            ckpt_dir   = self.ckpt_dir,
            run_name   = "adapt_candidate",
        )

        candidate_path = trainer.adapt(
            mixed_loader = loader,
            epochs       = ADAPT_EPOCHS,
            out_path     = self.ckpt_dir / "adapted_candidate.pt",
        )

        # ── Atomic weight swap ─────────────────────────────────────────────
        new_state = torch.load(candidate_path, map_location=self.device)
        self._atomic_swap(new_state)

        # Clean up deep copy
        del candidate
        if self.device.type == "mps":
            torch.mps.empty_cache()
        elif self.device.type == "cuda":
            torch.cuda.empty_cache()

        print(f"[adapt] Round complete – live model updated")
