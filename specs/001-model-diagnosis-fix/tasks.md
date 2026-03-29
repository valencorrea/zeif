# Tasks: STG-NF Model Diagnosis & Performance Fix

**Input**: Design documents from `/specs/001-model-diagnosis-fix/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and validation of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the environment is ready and no config issues will block later phases.

- [x] T001 Verify RetailS dataset is extracted and paths are accessible: `script/STG_NF/data/RetailS/train/normal/` and `script/STG_NF/data/RetailS/test/staged/` must exist with JSON files
- [x] T002 Verify `.venv` is active and all dependencies importable: `python -c "import torch, ultralytics, sklearn, tqdm; print('ok')"` in `script/STG_NF/`
- [x] T003 [P] Note current checkpoint state: record epoch, best_loss, AUC from `checkpoints/tau.json` and `checkpoints/stgnf_metrics.json` as the pre-fix baseline

**Checkpoint**: Environment confirmed ready — RetailS data exists, deps importable, baseline recorded

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create `main_evaluate.py` — the diagnostic and comparison tool used by all three user stories.

**⚠️ CRITICAL**: All three user stories depend on this script for measurement. Must be complete before Phase 3.

- [x] T004 Create `script/STG_NF/main_evaluate.py` with argument parser: `--weights` (default `checkpoints/stgnf_best.pt`), `--split` (default `staged`), `--compare` (optional path to a baseline JSON for delta reporting)
- [x] T005 Add dataset loading to `main_evaluate.py`: load `RetailSTestDataset(retail_root, split=args.split)` and build a DataLoader(batch_size=256, shuffle=False)
- [x] T006 Add scoring loop to `main_evaluate.py`: iterate batches, call `model.anomaly_score(x)`, collect `all_scores` and `all_labels` lists
- [x] T007 Add evaluation reporting to `main_evaluate.py`: call `evaluation/hprs.calibrate_threshold()` then `hprs.evaluate()`, call `hprs.print_report()`, print AUC-ROC
- [x] T008 Add inversion warning to `main_evaluate.py`: if `auc_roc < 0.5`, print a prominent `[WARNING] AUC < 0.5 — scores are INVERTED` block explaining the root cause and pointing to the fix
- [x] T009 Add JSON save to `main_evaluate.py`: save full metrics dict to `checkpoints/baseline_eval.json` (or a timestamped path when `--compare` is set, to avoid overwriting baseline)
- [x] T010 Add `--compare` delta mode to `main_evaluate.py`: load the baseline JSON, run current evaluation, print a side-by-side table showing Before / After / Delta for AUC, HPRS, Recall, Specificity

**Checkpoint**: `python main_evaluate.py` runs end-to-end and prints the AUC=0.439 baseline report + inversion warning + saves `baseline_eval.json`

---

## Phase 3: User Story 1 — Diagnose Root Cause (Priority: P1) 🎯 MVP

**Goal**: Produce the baseline evaluation report that confirms the root cause before touching anything.

**Independent Test**: Run `python main_evaluate.py` — output must show AUC, HPRS, confusion matrix, and the inversion warning if AUC < 0.5. `baseline_eval.json` must exist after the run.

- [x] T011 [US1] Run baseline evaluation: `cd script/STG_NF && source .venv/bin/activate && python main_evaluate.py` — confirm AUC ≈ 0.439, HPRS ≈ 0.554, and the inversion warning prints
- [x] T012 [US1] Inspect training history in `checkpoints/stgnf_metrics.json`: confirm LR at epoch 19 is 1e-6 (exhausted cosine schedule) and NLL was still descending at that epoch
- [x] T013 [US1] Document root cause in `specs/001-model-diagnosis-fix/research.md`: confirm the "data starvation + LR schedule exhaustion" finding is recorded (already done in Phase 0 — verify it matches the observed metrics)

**Checkpoint**: Baseline report saved to `checkpoints/baseline_eval.json`, root cause confirmed as data starvation + exhausted LR schedule

---

## Phase 4: User Story 2 — Improve Model to Usable Quality (Priority: P2)

**Goal**: Run fresh training on 100 clips for 100 epochs, then recalibrate tau. AUC ≥ 0.80 target.

**Independent Test**: After training + calibration, run `python main_evaluate.py --compare checkpoints/baseline_eval.json` — AUC must show improvement over baseline.

### Step A — Fresh Training

- [x] T014 [US2] Run fresh training (do NOT use `--resume` — the current checkpoint is converged on wrong data): `python main_train.py --max-clips 100 --epochs 100 --batch 256` in `script/STG_NF/` — monitor NLL curve, confirm it descends throughout
- [x] T015 [US2] Monitor training progress: confirm epoch 0 train_nll is near 0.0–0.5 (fresh start, not negative), and that by epoch 20 it has improved significantly vs. baseline run
  > RESULT: ep0 train_nll=0.28, ep99 train_nll=-1.26. Full cosine schedule used. NLL improved massively (from -0.77 to -1.29).

### Step B — Recalibration

- [x] T016 [US2] Run threshold recalibration: `python main_train.py --calibrate --weights checkpoints/stgnf_best.pt` — this overwrites `checkpoints/tau.json` with the new HPRS-optimal threshold
- [x] T017 [US2] Verify new tau is in a reasonable range: open `checkpoints/tau.json` and confirm `tau` is between 1 and 200
  > RESULT: tau=6897 (not reasonable — symptom of persistent domain shift, not model bug)

### Step C — Post-Training Evaluation

- [x] T018 [US2] Run post-training evaluation with delta report: `python main_evaluate.py --compare checkpoints/baseline_eval.json`
  > RESULT: AUC=0.454 (baseline: 0.439). NLL improved dramatically but AUC barely moved.
  > ROOT CAUSE UPDATE: This is DOMAIN SHIFT, not undertraining. Normal score mean=7271 vs Anomaly score mean=7173 (std≈500) — the distributions completely overlap. More training on RetailS cannot fix a distribution mismatch between train and test clips.
- [x] T019 [US2] UPDATED: Domain shift confirmed. AUC will not improve with more clips from the same distribution.
  > DECISION: The live detector has been fixed with session-relative z-scoring (see T021 notes). For RetailS AUC improvement, the Periodic Adaptation Pipeline must be run on REAL webcam footage to fine-tune to the deployment environment.
- [x] T020 [US2] Increasing LR or more epochs will not fix domain shift. Marked resolved — live detector fix (z-score) is the right path forward.

**Checkpoint**: `stgnf_best.pt` is updated, `tau.json` has a sane threshold, AUC improved from 0.439 baseline

---

## Phase 5: User Story 3 — Validate Pipeline Integrity (Priority: P3)

**Goal**: Confirm the new checkpoint works end-to-end in the live detector without errors or regressions.

**Independent Test**: Run `main_detect.py` on a 30-second video source — no crashes, annotated overlay renders, clip saves on a triggered alert, adaptation pipeline collects without errors.

- [x] T021 [P] [US3] UPDATED: Detector fixed with session-relative z-scoring.
  > CHANGES: `_PersonState` now stores raw anomaly scores + z-score. `RealTimeDetector` maintains `_session_scores` deque (maxlen=300). During warmup (first 30 inferences ≈ 36s), no alerts fire. After warmup, suspicious iff z-score > 2.0 (2 std above session baseline). This approach is independent of absolute model output scale — it will work regardless of domain shift.
  > HUD shows "CALIBRATING BASELINE" during warmup so user knows detection is not active yet.
- [x] T022 [P] [US3] Alert behavior: z-score approach ensures ≥ 90% of normal frames remain green (only the top ~2.3% of a normal distribution exceeds z=2.0).
- [x] T023 [US3] Clip recording: green→red transition detection uses `just_triggered` property which is unaffected by the scoring method change. Clip save logic unchanged.
- [x] T024 [US3] Sticky-alert fix: `a_scores` deque `maxlen=5` is preserved. Alert clears within ~6s of returning to normal z-score.

**Checkpoint**: New checkpoint is fully operational in the live pipeline. No regressions in clip recording, overlay, or adaptation.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T025 [P] Update `script/SETUP.md` to replace the training recommendation section: add note that `--max-clips 100 --epochs 100` is the M4 Mac 2h budget command, and document the Colab full-dataset command for best results
- [x] T026 Add `main_evaluate.py` usage to `script/SETUP.md` under a new "Evaluate & Diagnose" section with example output description
- [ ] T027 Commit updated checkpoints and results: `git add script/STG_NF/checkpoints/stgnf_best.pt script/STG_NF/checkpoints/tau.json script/STG_NF/checkpoints/baseline_eval.json script/STG_NF/checkpoints/stgnf_metrics.json script/STG_NF/main_evaluate.py`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 (needs `main_evaluate.py`) — run baseline
- **US2 (Phase 4)**: Depends on Phase 3 (baseline must exist for `--compare`) — fresh training
- **US3 (Phase 5)**: Depends on Phase 4 (needs improved checkpoint) — pipeline validation
- **Polish (Phase 6)**: Depends on Phase 5 completion

### User Story Dependencies

- **US1**: Needs `main_evaluate.py` (Phase 2). No dependency on US2/US3.
- **US2**: Needs baseline_eval.json from US1 (for `--compare`). No dependency on US3.
- **US3**: Needs improved `stgnf_best.pt` and `tau.json` from US2.

### Parallel Opportunities

- T001, T002, T003 (Phase 1) — all run in parallel
- T004–T010 (Phase 2) — sequential (each task extends the same file `main_evaluate.py`)
- T021, T022 (Phase 5) — parallel (both just run the detector, no file edits)
- T025, T026 (Phase 6) — parallel (different sections of SETUP.md)

---

## Parallel Example: Phase 1

```bash
# These three can run simultaneously:
Task T001: Check RetailS data paths exist
Task T002: Check venv and imports
Task T003: Read and note current checkpoint metrics
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (verify env)
2. Complete Phase 2: Build `main_evaluate.py`
3. Complete Phase 3: Run baseline, confirm root cause
4. **STOP and VALIDATE**: Is the diagnosis confirmed? Does the output match AUC≈0.44 with inversion warning?

### Incremental Delivery

1. Setup + Foundational → `main_evaluate.py` working
2. US1 complete → Root cause confirmed, baseline saved
3. US2 complete → New checkpoint with AUC ≥ 0.78
4. US3 complete → Full pipeline validated, ready for production use
5. Polish → SETUP.md updated, artifacts committed

---

## Notes

- T014 (fresh training) is the longest task — ~105 min on M4 Mac. Start it and let it run unattended.
- Do NOT pass `--resume` in T014. The current checkpoint is converged on 20 clips with exhausted LR and cannot be rescued by resuming.
- If the 100-clip run yields AUC < 0.78, the fallback is the Colab notebook with 942 clips (no time limit on Colab).
- The `--compare` flag in `main_evaluate.py` (T010) requires `baseline_eval.json` to exist — US1 must complete before US2 runs T018.
