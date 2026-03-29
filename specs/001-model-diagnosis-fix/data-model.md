# Data Model: STG-NF Model Diagnosis & Fix

**Feature**: 001-model-diagnosis-fix
**Date**: 2026-03-28

This feature is ML pipeline work — there is no database schema or API contract. The "data model" here describes the inputs, outputs, and artifact formats that move between pipeline stages.

---

## Artifacts

### BaselineReport
Produced by `main_evaluate.py` on the current checkpoint before any changes.

```
{
  "checkpoint":   "checkpoints/stgnf_best.pt",
  "epoch":        20,
  "clips_trained": 20,
  "auc_roc":      float,     # ← diagnostic signal
  "precision":    float,
  "recall":       float,
  "specificity":  float,
  "hprs":         float,
  "tau":          float,
  "TP": int, "FP": int, "TN": int, "FN": int
}
```

Saved to: `checkpoints/baseline_eval.json`

### TrainingConfig (for fix run)
```
clips:      400          # out of 942 available
epochs:     100          # full cosine schedule
batch_size: 256
resume:     None         # fresh start — do NOT resume current checkpoint
mix:        False        # normal-only for initial training
```

### ImprovedCheckpoint
`checkpoints/stgnf_best.pt` (overwritten after new training run)

Acceptance gate: AUC ≥ 0.80 when evaluated with `main_evaluate.py`

### CalibratedTau
`checkpoints/tau.json` (recalibrated after new training)

Expected range: tau ∈ [5, 50] for a well-trained flow on normalized pose data.
Current (broken) value: 1167.9

---

## State Transitions

```
[Current State]
  stgnf_best.pt  → epoch=20, 20 clips, AUC=0.44 (inverted, unusable)
  tau.json       → tau=1167.9, HPRS=0.55 (miscalibrated)

         ↓  main_evaluate.py  (baseline report, no changes)

[After Diagnosis]
  baseline_eval.json  → confirms root cause documented

         ↓  main_train.py (fresh, 400 clips, 100 epochs)

[After Training]
  stgnf_best.pt  → epoch≈80-100, 400 clips, AUC≥0.80 (target)
  stgnf_metrics.json → new training history

         ↓  main_train.py --calibrate

[Final State]
  tau.json  → tau≈5-50, HPRS≥0.70
  baseline_eval.json  → before/after comparison preserved
```
