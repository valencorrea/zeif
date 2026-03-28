"""
HPRS (Harmonic Mean of Precision, Recall, and Specificity) threshold calibration.

Definition
----------
For a given threshold τ on the anomaly score:
  - Predictions: ŷ = 1 if score(x) ≥ τ else 0  (1 = anomalous)
  - Precision   P  = TP / (TP + FP)
  - Recall      R  = TP / (TP + FN)   (sensitivity)
  - Specificity S  = TN / (TN + FP)

  HPRS(τ) = 3 / (1/P + 1/R + 1/S)     [harmonic mean of P, R, S]

HPRS penalises both false positives (via P and S) and false negatives (via R),
making it particularly suitable for shoplifting detection where false alarms
(phone-use, crouching, bag adjustment) erode operator trust.

Usage
-----
    from evaluation.hprs import calibrate_threshold, evaluate

    tau, hprs, stats = calibrate_threshold(scores, labels)
    print(f"τ* = {tau:.4f},  HPRS = {hprs:.4f}")
    metrics = evaluate(scores, labels, tau)
"""
from __future__ import annotations

from typing import Dict, Tuple

import numpy as np


_EPS = 1e-8


def _confusion(
    scores: np.ndarray,
    labels: np.ndarray,
    tau: float,
) -> Tuple[int, int, int, int]:
    """Return (TP, FP, TN, FN) for predictions score ≥ τ → anomalous."""
    preds = (scores >= tau).astype(int)
    TP = int(((preds == 1) & (labels == 1)).sum())
    FP = int(((preds == 1) & (labels == 0)).sum())
    TN = int(((preds == 0) & (labels == 0)).sum())
    FN = int(((preds == 0) & (labels == 1)).sum())
    return TP, FP, TN, FN


def hprs_at_tau(
    scores: np.ndarray,
    labels: np.ndarray,
    tau: float,
) -> float:
    """Compute HPRS at a single threshold."""
    TP, FP, TN, FN = _confusion(scores, labels, tau)

    P = TP / (TP + FP + _EPS)
    R = TP / (TP + FN + _EPS)
    S = TN / (TN + FP + _EPS)

    denom = (1 / (P + _EPS)) + (1 / (R + _EPS)) + (1 / (S + _EPS))
    return 3 / (denom + _EPS)


def calibrate_threshold(
    scores: np.ndarray,
    labels: np.ndarray,
    n_thresholds: int = 1000,
) -> Tuple[float, float, Dict]:
    """
    Sweep τ over the score range and find the value that maximises HPRS.

    Args:
        scores:       (N,) anomaly scores (higher = more suspicious)
        labels:       (N,) binary ground-truth labels (1 = shoplifting)
        n_thresholds: resolution of the sweep

    Returns:
        tau_star:  optimal threshold
        hprs_star: HPRS value at tau_star
        stats:     dict of metrics at tau_star
    """
    scores = np.asarray(scores, dtype=float)
    labels = np.asarray(labels, dtype=int)

    lo, hi = float(scores.min()), float(scores.max())
    taus   = np.linspace(lo, hi, n_thresholds)

    best_tau  = lo
    best_hprs = -1.0

    for tau in taus:
        h = hprs_at_tau(scores, labels, tau)
        if h > best_hprs:
            best_hprs = h
            best_tau  = tau

    stats = evaluate(scores, labels, best_tau)
    return float(best_tau), float(best_hprs), stats


def evaluate(
    scores: np.ndarray,
    labels: np.ndarray,
    tau: float,
) -> Dict[str, float]:
    """
    Full evaluation metrics at a fixed threshold.

    Returns dict with:  TP, FP, TN, FN, precision, recall, specificity,
                        f1, hprs, accuracy, auc_roc (if sklearn available)
    """
    scores = np.asarray(scores, dtype=float)
    labels = np.asarray(labels, dtype=int)

    TP, FP, TN, FN = _confusion(scores, labels, tau)
    P  = TP / (TP + FP + _EPS)
    R  = TP / (TP + FN + _EPS)
    S  = TN / (TN + FP + _EPS)
    F1 = 2 * P * R / (P + R + _EPS)
    denom = (1 / (P + _EPS)) + (1 / (R + _EPS)) + (1 / (S + _EPS))
    HPRS  = 3 / (denom + _EPS)
    ACC   = (TP + TN) / (TP + FP + TN + FN + _EPS)

    metrics: Dict[str, float] = {
        "tau":         tau,
        "TP":          TP,
        "FP":          FP,
        "TN":          TN,
        "FN":          FN,
        "precision":   P,
        "recall":      R,
        "specificity": S,
        "f1":          F1,
        "hprs":        HPRS,
        "accuracy":    ACC,
    }

    # Optional AUC-ROC
    try:
        from sklearn.metrics import roc_auc_score
        if len(np.unique(labels)) == 2:
            metrics["auc_roc"] = float(roc_auc_score(labels, scores))
    except ImportError:
        pass

    return metrics


def print_report(metrics: Dict[str, float]) -> None:
    """Pretty-print evaluation results."""
    print("─" * 50)
    print(f"  Threshold   (τ)  : {metrics['tau']:.6f}")
    print(f"  Precision       : {metrics['precision']:.4f}")
    print(f"  Recall          : {metrics['recall']:.4f}")
    print(f"  Specificity     : {metrics['specificity']:.4f}")
    print(f"  F1              : {metrics['f1']:.4f}")
    print(f"  HPRS            : {metrics['hprs']:.4f}")
    print(f"  Accuracy        : {metrics['accuracy']:.4f}")
    if "auc_roc" in metrics:
        print(f"  AUC-ROC         : {metrics['auc_roc']:.4f}")
    print(f"  TP={int(metrics['TP'])}  FP={int(metrics['FP'])}  "
          f"TN={int(metrics['TN'])}  FN={int(metrics['FN'])}")
    print("─" * 50)
