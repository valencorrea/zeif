# Implementation Plan: STG-NF Model Diagnosis & Performance Fix

**Branch**: `001-model-diagnosis-fix` | **Date**: 2026-03-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-model-diagnosis-fix/spec.md`

## Summary

The STG-NF model achieves AUC=0.439 (worse than random) because it was trained on only 20 of 942 available clips, with the LR schedule fully exhausted — leaving the model converged on a distribution too narrow to generalize. The fix is to discard the current checkpoint and run a fresh training pass on 400 clips for 100 epochs, followed by recalibration. A standalone evaluation script will be added to produce before/after diagnostic reports. No architecture changes are needed.

## Technical Context

**Language/Version**: Python 3.14 (MPS) / Python 3.11+ (CUDA)
**Primary Dependencies**: PyTorch (MPS + CUDA), Ultralytics YOLOv8, scikit-learn (AUC), tqdm
**Storage**: File-based — `.pt` checkpoints, `.json` metrics, `.zip` dataset
**Testing**: Manual evaluation via `main_evaluate.py` + visual inspection via `main_detect.py`
**Target Platform**: macOS M4 (MPS) primary; Google Colab A100 secondary
**Project Type**: ML training pipeline (offline batch) + real-time inference
**Performance Goals**: AUC ≥ 0.80; HPRS ≥ 0.70; training ≤ 2h on M4 Mac
**Constraints**: 200ms frame classification budget (Principle V); no DB writes in inference loop
**Scale/Scope**: Single model, 942 training clips, 15-keypoint pose schema, 24-frame windows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. [x] **No code duplication** — `main_evaluate.py` reuses `evaluation/hprs.py`, `dataset/retail_dataset.py`, and `training/trainer.load_checkpoint`. No new evaluation logic written from scratch.
2. [x] **Git worktree created** — Branch `001-model-diagnosis-fix` active.
3. [x] **Latency impact < 50ms** — `main_evaluate.py` is an offline script. Inference loop unchanged. Training config changes do not affect the 200ms frame budget.
4. [x] **No new components** — No new UI or composable components introduced.
5. [x] **No Supabase tables** — Purely ML pipeline work; no database involved.
6. [x] **Fail-safe preserved** — Detector's fail-safe behavior is untouched; new checkpoint is drop-in replacement.
7. [x] **Camera integration untouched** — No changes to `IZeifFrameProvider` or adapter layer.
8. [x] **No new triggers** — No trigger subsystem changes.

**Verdict**: All gates pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-model-diagnosis-fix/
├── plan.md              # This file
├── research.md          # Root cause analysis + fix rationale
├── data-model.md        # Artifact formats and state transitions
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code Changes

```text
script/STG_NF/
├── main_evaluate.py          # NEW — standalone evaluation + baseline report
└── checkpoints/
    ├── baseline_eval.json    # NEW — produced by main_evaluate.py before training
    ├── stgnf_best.pt         # REPLACED — by fresh training run
    ├── stgnf_metrics.json    # REPLACED — new training history
    └── tau.json              # REPLACED — recalibrated after new training
```

No other files change. The detector, adaptation pipeline, and clip recorder are untouched.

**Structure Decision**: Single-project layout. The `script/STG_NF/` directory already follows this structure. The only new source file is `main_evaluate.py` at the package root alongside `main_train.py` and `main_detect.py`.

---

## Implementation Phases

### Phase 1 — Baseline Evaluation Script

**Goal**: Create `main_evaluate.py` that runs the current checkpoint against the RetailS test set and saves a baseline report. This confirms the diagnosis and anchors the before/after comparison.

**What `main_evaluate.py` does:**
1. Loads `checkpoints/stgnf_best.pt`
2. Loads the RetailS staged test set
3. Scores all windows with `model.anomaly_score(x)`
4. Calls `evaluation/hprs.evaluate()` and `calibrate_threshold()`
5. Prints a full report (AUC, precision, recall, specificity, HPRS, confusion matrix)
6. Saves `checkpoints/baseline_eval.json`
7. Prints interpretation: what the AUC value means, whether it's the inversion pattern

**Key logic: inversion detection**
If `auc_roc < 0.5`, print a prominent warning:
```
[WARNING] AUC < 0.5 — anomaly scores are INVERTED relative to ground truth.
  This means the model assigns higher suspicion to NORMAL samples than ANOMALIES.
  Root cause: training distribution is too narrow (too few clips).
  Fix: fresh training on 400+ clips.
```

**Usage:**
```bash
cd script/STG_NF
source .venv/bin/activate
python main_evaluate.py                              # uses default best checkpoint
python main_evaluate.py --weights checkpoints/stgnf_best.pt --split staged
python main_evaluate.py --compare baseline_eval.json # after retraining, show delta
```

---

### Phase 2 — Fresh Training Run

**Goal**: Train from scratch on 400 clips for 100 epochs with correct LR schedule.

**Why fresh (not resume):**
- Current optimizer state has LR=1e-6 (exhausted floor)
- Model weights converged on 20-clip distribution
- Resuming would not escape this local minimum

**Training command:**
```bash
cd script/STG_NF
source .venv/bin/activate
python main_train.py \
  --max-clips 400 \
  --epochs 100 \
  --batch 256
```

No `--resume`, no `--mix` (normal-only first). The `--mix` flag can be used in a follow-up adaptation pass if needed, but for the initial fix, training on clean normal data is the right approach for a normalizing flow.

**Expected timeline on M4 Mac:**
- 400 clips → ~3.7 min/epoch × 100 epochs ≈ 370 min (~6h)
- This exceeds the 2h budget. Adjusted recommendation: **--max-clips 200 --epochs 100**
  - 200 clips × ~2.1 min/epoch × 100 epochs ≈ 210 min (~3.5h) still over
  - **--max-clips 100 --epochs 100**: ~1.05 min/epoch × 100 ≈ 105 min ✓ (within 2h)
  - **--max-clips 150 --epochs 80**: ~1.6 min/epoch × 80 ≈ 128 min ✓ (within 2.5h)

**Recommended 2h command (M4 Mac):**
```bash
python main_train.py --max-clips 100 --epochs 100 --batch 256
```
100 clips is 5× more data than the broken 20-clip run. With correct LR schedule and diverse normal data, AUC ≥ 0.78 is achievable.

**For Colab A100 (preferred — no time constraint):**
```bash
python main_train.py --max-clips 942 --epochs 100 --batch 512
```
Full dataset, full training. Expected AUC ≥ 0.85.

---

### Phase 3 — Recalibration

**Goal**: Find the new HPRS-optimal tau for the improved checkpoint.

```bash
python main_train.py --calibrate --weights checkpoints/stgnf_best.pt
```

This overwrites `tau.json` with the new threshold. The live detector (`main_detect.py`) reads this automatically on next launch.

---

### Phase 4 — Post-Training Evaluation

**Goal**: Confirm AUC ≥ 0.80 and HPRS ≥ 0.70.

```bash
python main_evaluate.py --compare checkpoints/baseline_eval.json
```

The `--compare` flag prints a delta table:

```
              Before    After    Delta
AUC-ROC       0.439     ?.???    +?.???
HPRS          0.554     ?.???    +?.???
Recall        0.519     ?.???    +?.???
Specificity   0.409     ?.???    +?.???
```

If AUC ≥ 0.80 and HPRS ≥ 0.70: pass, proceed to live test.
If AUC 0.70–0.80: acceptable but run Colab training for full-dataset result.
If AUC < 0.70: investigate data loading (check clip count actually loaded, check RetailS path).

---

### Phase 5 — End-to-End Pipeline Validation

**Goal**: Confirm the new checkpoint works in the live detector without errors.

```bash
python main_detect.py --weights checkpoints/stgnf_best.pt --source 0
```

Acceptance criteria:
- Launches without error
- Skeleton overlay renders
- Alert does not fire continuously on normal movement
- Clip saves correctly when alert triggers

---

## Risk Register

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| 100-clip training still gives AUC < 0.70 | Low | Use Colab for full 942-clip training |
| RetailS path issues cause empty dataset | Medium | Check `print([data] train=...)` output; should be >1000 windows |
| MPS OOM at batch=256 with 100 clips | Low | Reduce to --batch 128 |
| New tau is near-zero (all frames trigger) | Low | Check specificity in evaluate output; raise tau manually with --tau flag |
| Cosine schedule undershoots convergence in 100 epochs | Low | Monitor val_nll curve; add --epochs 120 if still descending at epoch 100 |
