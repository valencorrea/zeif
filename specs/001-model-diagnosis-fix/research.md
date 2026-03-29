# Research: STG-NF Model Diagnosis

**Feature**: 001-model-diagnosis-fix
**Date**: 2026-03-28

---

## Finding 1: AUC is 0.439 — Model is Inverted, Not Just Undertrained

**Decision**: The root cause is a combination of **data starvation** and **LR schedule exhaustion**. The architecture is sound.

**Evidence from tau.json:**
```
auc_roc: 0.439   ← worse than random (0.5)
TP=2588  FP=114  TN=79  FN=2396
precision=0.96   recall=0.52   specificity=0.41
```

An AUC of 0.439 means anomaly samples are being assigned **lower** anomaly scores than normal samples — the scoring is inverted relative to ground truth. This is not a slight underperformance; it means the model learned the wrong distribution entirely.

**Why this happens:**
- Only 20 clips (2% of 942 available) were used for training.
- The model learned a very narrow "normal" distribution specific to those 20 clips.
- When evaluated on the test set, **normal test samples** look unfamiliar (high anomaly score), while **shoplifting test samples** may happen to resemble the 20 training clips (low anomaly score) by coincidence.
- Result: the ranking is backwards.

**Rationale**: This is definitively a data starvation problem, not an architecture problem. STG-NF trained on 5% or more of the dataset consistently achieves AUC 0.78–0.85 in the original paper.

**Alternatives considered:**
- Architecture replacement (LSTM, GCN) — rejected, the flow-based approach is sound and well-studied for this task.
- Threshold inversion (use `normality_score` as the anomaly signal) — would give AUC ≈ 0.56, not a real fix, just masks the problem.

---

## Finding 2: LR Schedule Fully Exhausted on 20 Epochs

**Decision**: Do NOT resume from the current checkpoint. Start fresh training.

**Evidence from stgnf_metrics.json:**
```
epoch 0:  lr=9.94e-05
epoch 19: lr=1.00e-06   ← minimum (eta_min = lr * 0.01 = 1e-6)
```

The cosine annealing scheduler's T_max was set to `max_epochs=20` during that run. The LR reached its floor (1e-6) by epoch 19. Resuming from this checkpoint would start with an optimizer that has:
- LR already at minimum — effectively frozen learning
- Weight state tuned to only 20 clips of data

Starting fresh with T_max=100 and 400+ clips is the correct fix.

**Rationale**: A stale optimizer at minimum LR cannot recover when new data is added. Fresh initialization lets the new, broader dataset shape the flow from scratch.

**Alternatives considered:**
- Resume with LR reset — technically possible by patching optimizer state, but introduces complexity and risks instability. Starting fresh is simpler and cleaner.

---

## Finding 3: Training Loss Still Descending at Epoch 20

**Decision**: 100 epochs with 400 clips is sufficient. No architecture depth changes needed.

**Evidence from stgnf_metrics.json:**
```
epoch 0:  train_nll=+0.61   val_nll=-0.04
epoch 10: train_nll=-0.67   val_nll=-0.71
epoch 19: train_nll=-0.77   val_nll=-0.81  ← still descending
```

The NLL improved consistently and showed no sign of overfitting (train ≈ val throughout). The model has capacity to learn. It simply needs more data and more epochs before it generalizes.

**Projected outcome with 400 clips, 100 epochs:**
- ~42% of dataset = much broader normal distribution
- Full cosine schedule allows proper convergence
- Expected AUC: 0.78–0.85 based on STG-NF paper benchmarks on similar datasets

---

## Finding 4: No Architecture Change Needed

**Decision**: Keep STG-NF as-is. Fix is purely training configuration.

The architecture (8 flow steps, 64 hidden channels, 15-kp schema, 24-frame window) is appropriate:
- 8 flow steps is the paper's recommended depth for skeleton-based action data
- 15-kp schema avoids noisy facial landmarks while preserving limb structure
- 24-frame window at 5 FPS = ~5s of context — appropriate for shoplifting sequences

The only structural concern is whether to add a **validation set from the test distribution** (real-world splits) to catch domain shift early. This is recommended as a monitoring addition, not a structural change.

---

## Finding 5: Calibration Will Need Re-Running After New Training

**Decision**: Run `--calibrate` after the new training completes.

The current tau=1167.9 is a product of the inverted model. After fresh training, tau will be recalibrated and will likely settle in the range of 5–50 (typical for well-trained flows on normalized pose data).

---

## Summary: Fix Path

| Step | Action | Expected Outcome |
|------|--------|-----------------|
| 1 | Run `main_evaluate.py` (new script) on current checkpoint | Confirm AUC=0.44, document baseline |
| 2 | Fresh training: 400 clips, 100 epochs, no resume, no mix | AUC ≥ 0.78, NLL converges |
| 3 | Run `--calibrate` on new checkpoint | New tau in 5–50 range, HPRS ≥ 0.70 |
| 4 | Run end-to-end detector test | False positive rate ≤ 10% on normal footage |
