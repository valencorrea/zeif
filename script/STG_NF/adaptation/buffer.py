"""
D_low: persistent low-score buffer for the Periodic Adaptation Pipeline.

Windows with anomaly scores below the current threshold τ are stored here.
These represent high-confidence *normal* observations from the live camera,
used to fine-tune the model so it adapts to the deployment environment.

The buffer persists to disk so it survives process restarts.
"""
from __future__ import annotations

import pickle
import threading
from pathlib import Path
from typing import List, Optional

import numpy as np

from config import BUFFER_CAPACITY, BUFFER_DIR


class LowScoreBuffer:
    """
    Thread-safe ring buffer of normalised pose windows (T, 15, 2).

    On every push, the window is kept only if anomaly_score < tau.
    When the buffer is full, the oldest entry is evicted (FIFO).

    The buffer is persisted at `save_path` after every `flush_every` pushes
    so it survives crashes / restarts.
    """

    def __init__(
        self,
        capacity:   int  = BUFFER_CAPACITY,
        save_path:  Path = BUFFER_DIR / "d_low.pkl",
        flush_every: int = 200,
    ) -> None:
        self.capacity    = capacity
        self.save_path   = Path(save_path)
        self.flush_every = flush_every

        self._lock: threading.Lock = threading.Lock()
        self._buffer: List[np.ndarray] = []   # each: (T, 15, 2)
        self._push_count = 0

        self._load()

    # ── public API ─────────────────────────────────────────────────────────────

    def push(self, window: np.ndarray, anomaly_score: float, tau: float) -> bool:
        """
        Add `window` to the buffer if anomaly_score < tau.

        Returns True if the window was accepted.
        """
        if anomaly_score >= tau:
            return False

        with self._lock:
            if len(self._buffer) >= self.capacity:
                self._buffer.pop(0)         # evict oldest

            self._buffer.append(window.astype(np.float32))
            self._push_count += 1

            if self._push_count % self.flush_every == 0:
                self._save()

        return True

    def drain(self, max_samples: Optional[int] = None) -> List[np.ndarray]:
        """Return up to `max_samples` windows (does NOT clear the buffer)."""
        with self._lock:
            data = list(self._buffer)

        if max_samples is not None:
            data = data[:max_samples]
        return data

    def clear(self) -> None:
        with self._lock:
            self._buffer.clear()
            self._save()

    def __len__(self) -> int:
        with self._lock:
            return len(self._buffer)

    # ── persistence ────────────────────────────────────────────────────────────

    def _save(self) -> None:
        self.save_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.save_path, "wb") as f:
            pickle.dump(self._buffer, f, protocol=4)

    def _load(self) -> None:
        if self.save_path.exists():
            try:
                with open(self.save_path, "rb") as f:
                    self._buffer = pickle.load(f)
                # Trim to current capacity in case config changed
                self._buffer = self._buffer[-self.capacity:]
                print(f"[buffer] Restored {len(self._buffer)} windows from disk")
            except Exception as e:
                print(f"[buffer] Could not restore buffer ({e}) – starting fresh")
                self._buffer = []
        else:
            self._buffer = []

    def flush(self) -> None:
        """Force-flush buffer to disk."""
        with self._lock:
            self._save()
        print(f"[buffer] Flushed {len(self._buffer)} windows to {self.save_path}")
