"""
RetailS dataset loading and windowing.

Actual on-disk layout
---------------------
RetailS/
  RetailS_train/
    pose/train/
      <clip_stem>.json        ← normal training clips, no labels
  RetailS_test_staged/
    pose/test/<clip_stem>.json
    gt/test_frame_mask/<clip_stem>.npy
  RetailS_test_realworld/
    pose/test/<clip_stem>.json
    gt/test_frame_mask/<clip_stem>.npy

JSON schema
-----------
{
  "<person_id>": {                  ← string integer, e.g. "1"
    "<frame_idx>": {                ← string integer, e.g. "0"
      "keypoints": [x0,y0,c0, ...] ← flat list of 17×3 = 51 floats (COCO-17)
    }
  }
}

Label .npy
----------
  1-D uint8 array of length N_frames  (0=normal, 1=shoplifting)
  Indexable by frame_idx (0-based).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import torch
from torch.utils.data import Dataset

from config import WINDOW_T
from dataset.pose_schema import NUM_KEYPOINTS, build_15kp_from_coco, normalize_pose


# ── helpers ────────────────────────────────────────────────────────────────────

def _load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def _parse_kps_flat(flat: list) -> np.ndarray:
    """[x0,y0,c0, x1,y1,c1, ...] → (17, 3) float32."""
    return np.array(flat, dtype=np.float32).reshape(17, 3)


def _person_sequence(clip: dict, pid: str) -> np.ndarray:
    """
    Extract one person's frames as (T, 15, 3).

    clip: parsed JSON dict  {person_id_str: {frame_idx_str: {keypoints:[...]}}}
    pid:  string person id
    """
    person = clip.get(pid, {})
    if not person:
        return np.empty((0, NUM_KEYPOINTS, 3), dtype=np.float32)

    frames = sorted(person.items(), key=lambda kv: int(kv[0]))
    kps = []
    for _, fdata in frames:
        kp17 = _parse_kps_flat(fdata["keypoints"])   # (17, 3)
        kp15 = build_15kp_from_coco(kp17)            # (15, 3)
        kps.append(kp15)

    return np.stack(kps, axis=0)   # (T, 15, 3)


def _frame_indices(clip: dict, pid: str) -> List[int]:
    """Sorted list of integer frame indices for a person."""
    return sorted(int(k) for k in clip.get(pid, {}).keys())


def _windows(
    seq: np.ndarray,          # (T, 15, 3)
    labels: Optional[np.ndarray],  # (L,) uint8 or None
    fidxs: List[int],          # frame indices matching seq rows
    window: int,
    stride: int,
) -> List[Tuple[np.ndarray, Optional[int]]]:
    """
    Slide a window over seq; return (window_kps (W,15,3), window_label).
    window_label = max label over the window frames (any shoplifting → anomalous).
    """
    T = seq.shape[0]
    if T < window:
        return []

    result = []
    for start in range(0, T - window + 1, stride):
        end   = start + window
        w     = seq[start:end]    # (W, 15, 3)
        lab   = None
        if labels is not None:
            frame_slice = [fidxs[i] for i in range(start, end)
                           if fidxs[i] < len(labels)]
            if frame_slice:
                lab = int(labels[frame_slice].max())
            else:
                lab = 0
        result.append((w, lab))
    return result


# ── datasets ───────────────────────────────────────────────────────────────────

class RetailSTrainDataset(Dataset):
    """
    Normal-only training set from RetailS_train/pose/train/*.json.
    Each sample: (2, T, V) = (2, 24, 15) normalised pose tensor.
    """

    def __init__(
        self,
        retail_root: Path,
        window: int = WINDOW_T,
        stride: int = 6,
        max_clips: Optional[int] = None,
    ) -> None:
        self.window = window
        self.stride = stride
        self._samples: List[np.ndarray] = []   # each (T, 15, 2)

        train_dir = Path(retail_root) / "RetailS_train" / "pose" / "train"
        if not train_dir.exists():
            raise FileNotFoundError(f"Train dir not found: {train_dir}")

        clips = sorted(train_dir.glob("*.json"))
        if max_clips:
            clips = clips[:max_clips]

        print(f"[RetailSTrainDataset] Loading {len(clips)} clip files …")
        for p in clips:
            self._ingest(p)

        print(f"[RetailSTrainDataset] {len(self._samples):,} normal windows")

    def _ingest(self, path: Path) -> None:
        clip = _load_json(path)
        for pid in clip.keys():
            seq   = _person_sequence(clip, pid)       # (T, 15, 3)
            fidxs = _frame_indices(clip, pid)
            for (w, _) in _windows(seq, None, fidxs, self.window, self.stride):
                xy = w[:, :, :2]                      # (T, 15, 2)
                norm_xy, _ = normalize_pose(xy)
                self._samples.append(norm_xy)

    def __len__(self) -> int:
        return len(self._samples)

    def __getitem__(self, idx: int) -> torch.Tensor:
        return torch.from_numpy(self._samples[idx]).permute(2, 0, 1)  # (2, T, V)


class RetailSTestDataset(Dataset):
    """
    Labelled test set for threshold calibration and evaluation,
    and as the anomaly source for 9:1 mixing.

    split:        'staged' | 'real'
    anomaly_only: if True, return only windows with label=1 (shoplifting)
    """

    def __init__(
        self,
        retail_root: Path,
        split: str = "staged",
        window: int = WINDOW_T,
        stride: int = 6,
        anomaly_only: bool = False,
    ) -> None:
        assert split in {"staged", "real"}, f"Unknown split: {split}"
        folder_map = {"staged": "RetailS_test_staged", "real": "RetailS_test_realworld"}
        folder     = folder_map[split]

        pose_dir  = Path(retail_root) / folder / "pose" / "test"
        label_dir = Path(retail_root) / folder / "gt" / "test_frame_mask"

        self._samples: List[np.ndarray] = []
        self._labels:  List[int]        = []

        for json_path in sorted(pose_dir.glob("*.json")):
            npy_path = label_dir / f"{json_path.stem}.npy"
            if not npy_path.exists():
                continue
            self._ingest(json_path, npy_path, anomaly_only)

        tag = f"{split}/anomaly_only" if anomaly_only else split
        print(f"[RetailSTestDataset/{tag}] {len(self._samples):,} windows "
              f"({sum(self._labels)} anomalous)")

    def _ingest(self, json_path: Path, npy_path: Path,
                anomaly_only: bool) -> None:
        clip   = _load_json(json_path)
        labels = np.load(npy_path)   # (N_frames,) uint8

        for pid in clip.keys():
            seq   = _person_sequence(clip, pid)
            fidxs = _frame_indices(clip, pid)

            for (w, lab) in _windows(seq, labels, fidxs, WINDOW_T, 6):
                if lab is None:
                    lab = 0
                if anomaly_only and lab == 0:
                    continue
                xy = w[:, :, :2]
                norm_xy, _ = normalize_pose(xy)
                self._samples.append(norm_xy)
                self._labels.append(lab)

    def __len__(self) -> int:
        return len(self._samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        x = torch.from_numpy(self._samples[idx]).permute(2, 0, 1)  # (2, T, V)
        return x, self._labels[idx]


class WebcamWindowDataset(Dataset):
    """
    In-memory wrapper for D_low windows used by the adaptation pipeline.
    windows: list of (T, 15, 2) float32 arrays.
    """

    def __init__(self, windows: List[np.ndarray]) -> None:
        self._data = windows

    def __len__(self) -> int:
        return len(self._data)

    def __getitem__(self, idx: int) -> torch.Tensor:
        return torch.from_numpy(self._data[idx]).permute(2, 0, 1)  # (2, T, V)
