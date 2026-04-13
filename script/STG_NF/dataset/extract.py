"""
Utility to extract the RetailS dataset ZIP and verify its structure.

Expected layout inside the ZIP:
  RetailS/
    train/
      normal/
        *.pkl          # per-clip annotation files
    test/
      staged/
        clips/  *.pkl
        labels/ *.npy
      real/
        clips/  *.pkl
        labels/ *.npy

Usage:
    python -m dataset.extract          # uses paths from config
    python -m dataset.extract --zip /path/to/RetailS.zip --out /path/to/data
"""
from __future__ import annotations

import argparse
import pickle
import zipfile
from pathlib import Path

import numpy as np


def extract_dataset(zip_path: Path, out_dir: Path, verbose: bool = True) -> Path:
    """
    Extract the RetailS ZIP archive.

    Returns the root RetailS directory inside `out_dir`.
    """
    zip_path = Path(zip_path)
    out_dir  = Path(out_dir)

    if not zip_path.exists():
        raise FileNotFoundError(f"Dataset ZIP not found: {zip_path}")

    out_dir.mkdir(parents=True, exist_ok=True)

    if verbose:
        print(f"[extract] Extracting {zip_path.name} → {out_dir} …")

    with zipfile.ZipFile(zip_path, "r") as zf:
        members = zf.namelist()
        if verbose:
            print(f"[extract] {len(members):,} members in archive")
        zf.extractall(out_dir)

    # Determine root (handle top-level RetailS/ folder or bare files)
    retail_root = out_dir / "RetailS"
    if not retail_root.exists():
        retail_root = out_dir

    if verbose:
        print(f"[extract] Done. Root: {retail_root}")
        _print_tree(retail_root, depth=3)

    return retail_root


def _print_tree(root: Path, depth: int = 3, indent: int = 0) -> None:
    if depth == 0 or not root.is_dir():
        return
    for child in sorted(root.iterdir())[:20]:
        marker = "/" if child.is_dir() else ""
        print("  " * indent + child.name + marker)
        if child.is_dir():
            _print_tree(child, depth - 1, indent + 1)


def verify_pkl(path: Path) -> dict:
    """
    Load and validate a single annotation .pkl file.

    Expected structure:
        {
          frame_idx: {
            person_id: {
              'bbox': [x1, y1, x2, y2],
              'keypoints': [[x, y, conf], ...] * 15-or-17,
            },
            ...
          },
          ...
        }

    Returns the loaded dict.
    """
    with open(path, "rb") as f:
        data = pickle.load(f)
    assert isinstance(data, dict), f"Expected dict, got {type(data)}"
    return data


def verify_npy(path: Path) -> np.ndarray:
    """
    Load and validate a binary label .npy file.

    Expected: 1-D int array of 0 (normal) / 1 (shoplifting) values, one per frame.
    """
    labels = np.load(path)
    assert labels.ndim == 1,              f"Expected 1-D labels, got shape {labels.shape}"
    assert set(np.unique(labels)) <= {0, 1}, f"Labels must be binary (0/1)"
    return labels


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from config import RETAIL_ZIP, DATA_ROOT

    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, default=RETAIL_ZIP)
    parser.add_argument("--out", type=Path, default=DATA_ROOT)
    args = parser.parse_args()

    extract_dataset(args.zip, args.out)
