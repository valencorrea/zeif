"""
main_train.py – Initial training of the STG-NF model on RetailS normal data.

Usage:
    # Standard training (normal data only):
    python main_train.py

    # With 9:1 mixing of anomaly samples (staged subset):
    python main_train.py --mix

    # Resume from checkpoint:
    python main_train.py --resume checkpoints/stgnf_best.pt

    # Threshold calibration after training:
    python main_train.py --calibrate --weights checkpoints/stgnf_best.pt

Options:
    --zip        Path to RetailS.zip  (default: ../PoseBasedModel/RetailS.zip)
    --epochs     Max training epochs  (default: 100)
    --batch      Batch size           (default: 256)
    --val-split  Fraction for val     (default: 0.05)
    --max-clips  Limit clip loading   (for quick smoke-tests)
    --workers    DataLoader workers   (default: 0 for MPS)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, random_split

sys.path.insert(0, str(Path(__file__).parent))

from config import (
    BATCH_SIZE, CHECKPOINT_DIR, DATA_ROOT,
    FLOW_DEPTH, HIDDEN_CHANNELS, MAX_EPOCHS, RETAIL_ZIP,
)
from dataset.extract import extract_dataset
from dataset.retail_dataset import RetailSTestDataset, RetailSTrainDataset
from model.stg_nf import STGNF, build_model
from training.mixing import MixedWindowDataset
from training.trainer import Trainer
from evaluation.hprs import calibrate_threshold, print_report


def _select_device() -> torch.device:
    if torch.backends.mps.is_available():
        print("[device] MPS (Apple Silicon GPU)")
        return torch.device("mps")
    if torch.cuda.is_available():
        print("[device] CUDA")
        return torch.device("cuda")
    print("[device] CPU")
    return torch.device("cpu")


def _parse() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--zip",       type=Path,  default=RETAIL_ZIP)
    p.add_argument("--epochs",    type=int,   default=MAX_EPOCHS)
    p.add_argument("--batch",     type=int,   default=BATCH_SIZE)
    p.add_argument("--val-split", type=float, default=0.05)
    p.add_argument("--max-clips", type=int,   default=None)
    p.add_argument("--workers",   type=int,   default=0)
    p.add_argument("--mix",       action="store_true",
                   help="Enable 9:1 mixing during initial training")
    p.add_argument("--resume",    type=Path,  default=None)
    p.add_argument("--weights",   type=Path,  default=None,
                   help="Weights for calibration (used with --calibrate)")
    p.add_argument("--calibrate", action="store_true",
                   help="Calibrate threshold on test set and save tau.json")
    return p.parse_args()


def main() -> None:
    args   = _parse()
    device = _select_device()

    # ── Extract dataset ────────────────────────────────────────────────────────
    retail_root = DATA_ROOT / "RetailS"
    if not retail_root.exists():
        if not args.zip.exists():
            print(f"[ERROR] Dataset ZIP not found: {args.zip}")
            print("  Place RetailS.zip in script/PoseBasedModel/ or pass --zip <path>")
            sys.exit(1)
        extract_dataset(args.zip, DATA_ROOT)

    # ── Build model ────────────────────────────────────────────────────────────
    model = build_model(
        flow_depth = FLOW_DEPTH,
        hidden     = HIDDEN_CHANNELS,
        device     = device,
    )
    print(f"[model] Parameters: {sum(p.numel() for p in model.parameters()):,}")

    if args.calibrate:
        _run_calibration(model, args, device, retail_root)
        return

    # ── Load training data ─────────────────────────────────────────────────────
    print("[data] Loading RetailS normal training set …")
    full_ds = RetailSTrainDataset(
        retail_root,
        max_clips = args.max_clips,
    )

    val_size   = int(len(full_ds) * args.val_split)
    train_size = len(full_ds) - val_size
    train_ds, val_ds = random_split(full_ds, [train_size, val_size])

    if args.mix:
        print("[data] Building 9:1 mixed training set …")
        anomaly_ds = RetailSTestDataset(retail_root, split="staged", anomaly_only=True)
        train_ds   = MixedWindowDataset(train_ds, anomaly_ds, ratio=9)
        train_loader = train_ds.build_loader(
            batch_size  = args.batch,
            num_workers = args.workers,
        )
    else:
        train_loader = DataLoader(
            train_ds,
            batch_size  = args.batch,
            shuffle     = True,
            num_workers = args.workers,
            pin_memory  = False,
            drop_last   = True,
        )

    val_loader = DataLoader(
        val_ds,
        batch_size  = args.batch * 2,
        shuffle     = False,
        num_workers = args.workers,
        pin_memory  = False,
    )

    print(f"[data] train={len(train_ds):,}  val={len(val_ds):,}")

    # ── Train ──────────────────────────────────────────────────────────────────
    trainer = Trainer(
        model      = model,
        device     = device,
        max_epochs = args.epochs,
        ckpt_dir   = CHECKPOINT_DIR,
        run_name   = "stgnf",
    )
    trainer.fit(
        train_loader = train_loader,
        val_loader   = val_loader,
        resume_from  = args.resume,
    )

    # Auto-calibrate after training
    _run_calibration(model, args, device, retail_root)


def _run_calibration(
    model:       STGNF,
    args:        argparse.Namespace,
    device:      torch.device,
    retail_root: Path,
) -> None:
    """
    Compute anomaly scores on the staged test set and find HPRS-optimal τ.
    Saves tau.json to CHECKPOINT_DIR.
    """
    weights_path = args.weights or (CHECKPOINT_DIR / "stgnf_best.pt")
    if weights_path.exists():
        from training.trainer import load_checkpoint
        load_checkpoint(model, weights_path, device=device)
        print(f"[calibrate] Loaded weights from {weights_path}")
    else:
        print(f"[calibrate] Warning: no weights at {weights_path}, using current params")

    model.eval()

    test_ds = RetailSTestDataset(retail_root, split="staged")
    loader  = DataLoader(test_ds, batch_size=256, shuffle=False, num_workers=0)

    all_scores: list[float] = []
    all_labels: list[int]   = []

    print("[calibrate] Scoring test set …")
    with torch.no_grad():
        for x, labels in loader:
            x = x.to(device)
            scores = model.anomaly_score(x).cpu().numpy().tolist()
            all_scores.extend(scores)
            all_labels.extend(labels.tolist())

    tau, hprs, stats = calibrate_threshold(
        np.array(all_scores), np.array(all_labels)
    )

    print(f"\n[calibrate] HPRS-optimal threshold found:")
    print_report(stats)

    tau_path = CHECKPOINT_DIR / "tau.json"
    with open(tau_path, "w") as f:
        json.dump({"tau": tau, "hprs": hprs, **stats}, f, indent=2)
    print(f"[calibrate] Saved τ={tau:.6f} to {tau_path}")


if __name__ == "__main__":
    main()
