"""
Per-person state management: sliding window buffer and PID-level
probability aggregation.
"""

from __future__ import annotations
from collections import deque
from typing import Dict, List, Optional, Tuple

import numpy as np

from pose_schema import NUM_KEYPOINTS

WINDOW_SIZE = 25        # frames kept per PID
MAX_PROB_HISTORY = 50   # how many window predictions to average per PID


class PersonState:
    """Tracks raw keypoint history and inference results for one PID."""

    def __init__(self, pid: int) -> None:
        self.pid = pid
        # Each entry: (15, 3) float32 keypoint array
        self.kp_buffer: deque[np.ndarray] = deque(maxlen=WINDOW_SIZE)
        # Rolling window of shoplifter probabilities from QC-passed inferences
        self.prob_history: deque[float] = deque(maxlen=MAX_PROB_HISTORY)
        # Last known bounding box for overlay drawing
        self.last_bbox: Optional[Tuple[int, int, int, int]] = None  # x1,y1,x2,y2
        # Aggregated alert flag
        self.is_suspicious: bool = False

    def push_keypoints(self, kps: np.ndarray) -> None:
        """Append a (15,3) frame to the buffer."""
        self.kp_buffer.append(kps.astype(np.float32))

    def get_window(self) -> Optional[np.ndarray]:
        """Return (T, 15, 3) array if buffer is full, else None."""
        if len(self.kp_buffer) < WINDOW_SIZE:
            return None
        return np.stack(list(self.kp_buffer), axis=0)  # (T, 15, 3)

    def record_prob(self, p_shoplifter: float) -> None:
        """Store a new probability estimate and update alert flag."""
        self.prob_history.append(p_shoplifter)
        if self.prob_history:
            self.is_suspicious = float(np.mean(self.prob_history)) > 0.5

    @property
    def aggregated_prob(self) -> float:
        if not self.prob_history:
            return 0.0
        return float(np.mean(self.prob_history))


class PersonTracker:
    """Registry of all active PersonState objects keyed by PID."""

    def __init__(self) -> None:
        self._states: Dict[int, PersonState] = {}

    def get_or_create(self, pid: int) -> PersonState:
        if pid not in self._states:
            self._states[pid] = PersonState(pid)
        return self._states[pid]

    def prune_stale(self, active_pids: List[int]) -> None:
        """Remove PIDs that are no longer tracked to free memory."""
        stale = [p for p in self._states if p not in active_pids]
        for p in stale:
            del self._states[p]

    def active_states(self) -> List[PersonState]:
        return list(self._states.values())
