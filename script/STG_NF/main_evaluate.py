"""
main_evaluate.py – Standalone evaluation and baseline reporting for STG-NF.

Usage:
    # Evaluate current best checkpoint, save baseline report:
    python main_evaluate.py

    # Evaluate a specific weights file:
    python main_evaluate.py --weights checkpoints/stgnf_best.pt

    # Use realworld test split instead of staged:
    python main_evaluate.py --split realworld

    # After retraining: compare new checkpoint against saved baseline:
    python main_evaluate.py --compare checkpoints/baseline_eval.json

Options:
    --weights   Path to model checkpoint  (default: checkpoints/stgnf_best.pt)
    --split     Test split to evaluate on (default: staged)
    --compare   Path to a prior baseline_eval.json for delta reporting
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

sys.path.insert(0, str(Path(__file__).parent))

from config import CHECKPOINT_DIR, DATA_ROOT, FLOW_DEPTH, HIDDEN_CHANNELS
from dataset.retail_dataset import RetailSTestDataset
from evaluation.hprs import calibrate_threshold, evaluate, print_report
from model.stg_nf import build_model
from training.trainer import load_checkpoint


def _select_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def _parse() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="STG-NF Evaluation & Diagnosis")
    p.add_argument("--weights", type=Path, default=None,
                   help="Path to model checkpoint (default: checkpoints/stgnf_best.pt)")
    p.add_argument("--split",   type=str,  default="staged",
                   choices=["staged", "realworld"],
                   help="Test split to evaluate on")
    p.add_argument("--compare", type=Path, default=None,
                   help="Baseline JSON to compare against (shows Before/After/Delta table)")
    return p.parse_args()


def _score_dataset(
    model: torch.nn.Module,
    device: torch.device,
    retail_root: Path,
    split: str,
) -> tuple[list[float], list[int]]:
    """Score all windows in the test split. Returns (scores, labels)."""
    test_ds = RetailSTestDataset(retail_root, split=split)
    loader  = DataLoader(test_ds, batch_size=256, shuffle=False, num_workers=0)

    all_scores: list[float] = []
    all_labels: list[int]   = []

    print(f"[evaluate] Scoring {len(test_ds):,} windows from '{split}' split …")
    with torch.no_grad():
        for batch in loader:
            x, labels = batch
            x = x.to(device)
            scores = model.anomaly_score(x).cpu().numpy().tolist()
            all_scores.extend(scores)
            all_labels.extend(labels.tolist())

    return all_scores, all_labels


def _print_inversion_warning(auc: float) -> None:
    if auc < 0.5:
        print()
        print("┌─────────────────────────────────────────────────────────────────┐")
        print("│  WARNING: AUC < 0.5 — anomaly scores are INVERTED               │")
        print("│                                                                  │")
        print("│  The model assigns HIGHER suspicion to NORMAL samples and        │")
        print("│  LOWER suspicion to SHOPLIFTING samples. This causes the live    │")
        print("│  detector to flag innocent behavior and miss real events.        │")
        print("│                                                                  │")
        print("│  Root cause: Training on too few clips (data starvation) caused  │")
        print("│  the normalizing flow to learn a distribution so narrow that     │")
        print("│  normal test samples appear anomalous by comparison.             │")
        print("│                                                                  │")
        print("│  Fix: Fresh training on 100+ clips, no --resume:                 │")
        print("│    python main_train.py --max-clips 100 --epochs 100 --batch 256 │")
        print("└─────────────────────────────────────────────────────────────────┘")
        print()
    elif auc < 0.70:
        print()
        print("[WARNING] AUC < 0.70 — model is undertrained.")
        print("  Consider running more epochs or using more training clips.")
        print()


def _print_delta_table(baseline: dict, current: dict) -> None:
    keys = [
        ("auc_roc",     "AUC-ROC"),
        ("hprs",        "HPRS"),
        ("precision",   "Precision"),
        ("recall",      "Recall"),
        ("specificity", "Specificity"),
        ("f1",          "F1"),
        ("accuracy",    "Accuracy"),
    ]
    print()
    print("┌─────────────────────────────────────────────────────────────┐")
    print("│  Before / After Comparison                                  │")
    print("├─────────────┬──────────┬──────────┬──────────┬─────────────┤")
    print("│  Metric     │  Before  │  After   │  Delta   │  Status     │")
    print("├─────────────┼──────────┼──────────┼──────────┼─────────────┤")
    for key, label in keys:
        if key not in baseline or key not in current:
            continue
        before = baseline[key]
        after  = current[key]
        delta  = after - before
        sign   = "+" if delta >= 0 else ""
        status = "✓ improved" if delta > 0.01 else ("✗ degraded" if delta < -0.01 else "~ unchanged")
        print(f"│  {label:<11} │  {before:.4f}  │  {after:.4f}  │  {sign}{delta:.4f}  │  {status:<11} │")
    print("└─────────────┴──────────┴──────────┴──────────┴─────────────┘")
    print()

    # AUC gate check
    auc_after = current.get("auc_roc", 0.0)
    hprs_after = current.get("hprs", 0.0)
    if auc_after >= 0.80 and hprs_after >= 0.70:
        print("[PASS] AUC ≥ 0.80 and HPRS ≥ 0.70 — model meets quality targets.")
    elif auc_after >= 0.78:
        print("[PARTIAL] AUC ≥ 0.78 — acceptable. For AUC ≥ 0.80 run full Colab training:")
        print("  python main_train.py --max-clips 942 --epochs 100 --batch 512")
    else:
        print("[FAIL] AUC < 0.78 — quality target not met. Check training curve in")
        print("  checkpoints/stgnf_metrics.json for signs of underfitting or stale LR.")


def main() -> None:
    args   = _parse()
    device = _select_device()

    retail_root = DATA_ROOT / "RetailS"
    if not retail_root.exists():
        print(f"[ERROR] RetailS dataset not found at {retail_root}")
        print("  Extract RetailS.zip first or check DATA_ROOT in config.py")
        sys.exit(1)

    # ── Build + load model ────────────────────────────────────────────────────
    model = build_model(FLOW_DEPTH, HIDDEN_CHANNELS, device=device)

    weights = args.weights or (CHECKPOINT_DIR / "stgnf_best.pt")
    if not weights.exists():
        print(f"[ERROR] Weights not found: {weights}")
        sys.exit(1)

    load_checkpoint(model, weights, device=device)
    model.eval()
    print(f"[evaluate] Loaded weights: {weights}")

    # ── Score test set ────────────────────────────────────────────────────────
    scores, labels = _score_dataset(model, device, retail_root, args.split)

    scores_arr = np.array(scores, dtype=float)
    labels_arr = np.array(labels, dtype=int)

    # ── Calibrate + evaluate ──────────────────────────────────────────────────
    tau, hprs, stats = calibrate_threshold(scores_arr, labels_arr)

    print(f"\n[evaluate] HPRS-optimal threshold:")
    print_report(stats)

    auc = stats.get("auc_roc", float("nan"))
    _print_inversion_warning(auc)

    # ── Save report ───────────────────────────────────────────────────────────
    # Always save as baseline_eval.json (the canonical before-state).
    # If --compare is set the file already exists; save current run under a
    # timestamped name to avoid overwriting the baseline.
    if args.compare and args.compare.exists():
        import datetime
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = CHECKPOINT_DIR / f"eval_{ts}.json"
    else:
        out_path = CHECKPOINT_DIR / "baseline_eval.json"

    with open(out_path, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"[evaluate] Report saved → {out_path}")

    # ── Delta comparison ──────────────────────────────────────────────────────
    if args.compare and args.compare.exists():
        with open(args.compare) as f:
            baseline = json.load(f)
        _print_delta_table(baseline, stats)
    else:
        print()
        print("  Tip: After retraining, compare improvement with:")
        print(f"    python main_evaluate.py --compare {out_path}")


if __name__ == "__main__":
    main()
