# Feature Specification: STG-NF Model Diagnosis & Performance Fix

**Feature Branch**: `001-model-diagnosis-fix`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "i need to fix this problem. The model isnt functioning as it should, i should know if our approach in the architecture isnt the correct one, we should train more the model, or what should we do?"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diagnose Root Cause of Poor Detection (Priority: P1)

As a developer operating the Zeif system, I need a clear diagnosis of why the STG-NF model produces excessive false positives — so I know whether the problem is the model architecture, insufficient training, miscalibrated threshold, or data quality — before investing more time on the wrong fix.

**Why this priority**: Without a diagnosis, all improvement work may be wasted. The model currently achieves AUC=0.59 (barely above random) and flags normal behavior as suspicious, making it unusable in production. Knowing the root cause determines every subsequent decision.

**Independent Test**: Run the existing evaluation script against the RetailS test set with the current checkpoint and produce a metrics report. This delivers value on its own: a concrete before-state that anchors all future comparison.

**Acceptance Scenarios**:

1. **Given** the current trained checkpoint (20 epochs, 20 clips, AUC=0.59), **When** evaluation runs against the RetailS test set, **Then** a report is produced showing AUC, Precision, Recall, Specificity, HPRS, and a confusion matrix.
2. **Given** the evaluation report, **When** the developer reviews it, **Then** the root cause is clearly identifiable as one of: (a) undertrained model, (b) architecture mismatch, (c) miscalibrated threshold, or (d) data quality / distribution shift.
3. **Given** the identified root cause, **When** the recommended fix path is selected, **Then** it is documented with expected outcomes before any training begins.

---

### User Story 2 - Improve Model to Usable Detection Quality (Priority: P2)

As a developer, I need the model to reach a minimum usable quality so that detection is reliable enough to justify evidence clip recording and security alerts in a real store.

**Why this priority**: The current AUC of 0.59 is barely above random. The system needs AUC ≥ 0.80 to be useful. This story depends on Story 1's diagnosis to pick the right action (more training vs. architecture change vs. recalibration).

**Independent Test**: Re-evaluate with the new checkpoint after applying the fix. AUC and HPRS scores must improve measurably compared to the Story 1 baseline.

**Acceptance Scenarios**:

1. **Given** the diagnosis identifies "undertrained" as root cause, **When** training runs with more data and more epochs, **Then** the new checkpoint achieves AUC ≥ 0.80 on the RetailS test set.
2. **Given** the diagnosis identifies "threshold miscalibration" as root cause, **When** re-calibration produces a new tau value, **Then** HPRS ≥ 0.70 on the test set.
3. **Given** the diagnosis identifies "architecture mismatch" as root cause, **When** the recommended architectural changes are applied and the model is retrained, **Then** AUC ≥ 0.80 on the test set.
4. **Given** an improved checkpoint, **When** the live detector runs on 60 seconds of clearly normal footage, **Then** the alert is active for ≤ 10% of the time.

---

### User Story 3 - Validate Fix Does Not Break the Pipeline (Priority: P3)

As a developer, I need confidence that any model or architecture change does not break the real-time detection pipeline, clip recording, or adaptation pipeline.

**Why this priority**: Downstream systems depend on the model's output format and scoring range. Changes must be backward-compatible or the pipeline must be updated accordingly.

**Independent Test**: Run `main_detect.py` end-to-end with the new checkpoint on a 30-second video. No crashes, clips save correctly, overlay renders.

**Acceptance Scenarios**:

1. **Given** a new checkpoint, **When** the detector is launched, **Then** it loads and runs without errors.
2. **Given** a simulated green→red transition with the new model, **When** the clip recorder fires, **Then** a valid annotated video is saved to `clips/`.
3. **Given** adaptation is enabled, **When** the pipeline collects windows, **Then** scoring and collection continue to work correctly with the new model.

---

### Edge Cases

- What if the RetailS test set is too small to produce statistically reliable AUC/HPRS scores?
- What if the model has overfit to the 20 training clips and performs worse on additional training data?
- What if the distribution between the lab-collected RetailS data and real webcam footage is too large to bridge with this architecture?
- What if tau is calibrated to near-zero, causing any movement to trigger an alert?
- What if training on more data degrades AUC (sign of architecture capacity issue)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST produce a quantitative evaluation report (AUC, Precision, Recall, Specificity, HPRS, confusion matrix) on the current checkpoint before any changes are made.
- **FR-002**: System MUST identify the primary root cause of poor detection from: undertrained, architecture mismatch, threshold miscalibration, data quality / distribution shift.
- **FR-003**: The recommended fix path MUST be documented with expected outcome before implementation begins.
- **FR-004**: After applying the fix, the model MUST be re-evaluated and new metrics MUST be compared against the Story 1 baseline.
- **FR-005**: The improved model MUST achieve AUC ≥ 0.80 and HPRS ≥ 0.70 on the RetailS test set.
- **FR-006**: False positive rate on normal-only live footage MUST be ≤ 10%.
- **FR-007**: The real-time pipeline (detector, clip recorder, adaptation) MUST continue to function correctly after any model or architecture change.
- **FR-008**: Any training run required by the fix MUST complete within 2 hours on an M4 Mac or within 1 hour on a Colab A100 GPU.

### Key Entities

- **Baseline Checkpoint**: The current `stgnf_best.pt` trained for 20 epochs on 20 clips; establishes the before-state for all comparisons.
- **Evaluation Report**: Quantitative metrics (AUC, HPRS, confusion matrix) generated against the RetailS test set; the primary diagnostic artifact.
- **Root Cause**: The identified primary reason for poor performance; determines which fix path is taken.
- **Improved Checkpoint**: The new `stgnf_best.pt` produced after applying the fix; must be validated before replacing the baseline.
- **Tau (threshold)**: The HPRS-calibrated anomaly score threshold stored in `tau.json`; must be recalibrated after any model change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: AUC on the RetailS test set improves from the current 0.59 baseline to ≥ 0.80 after the fix is applied.
- **SC-002**: HPRS score reaches ≥ 0.70 after recalibration with the improved checkpoint.
- **SC-003**: False positive rate on 60 seconds of normal behavior footage is ≤ 10% in live detection.
- **SC-004**: Alert clears within 10 seconds of returning to normal behavior (no sticky-alert regression from the `maxlen=5` fix).
- **SC-005**: The root cause diagnosis report is produced within 30 minutes of starting the analysis.
- **SC-006**: Full pipeline (detect → clip → adapt) runs without errors end-to-end with the new checkpoint.

## Assumptions

- The RetailS dataset is available locally and extracted; evaluation can be run immediately without downloading.
- The current 20-epoch, 20-clip checkpoint is significantly undertrained — this is the most likely root cause, but the diagnosis will confirm or refute it.
- The STG-NF architecture (normalizing flows on pose graphs) is sound for unsupervised anomaly detection; architecture changes are a fallback path only if diagnosis shows a fundamental mismatch.
- The 15-keypoint schema and 24-frame window size are appropriate and not a bottleneck.
- Training on 300–400 clips (out of 942 available) for 45–60 total epochs is the primary fix candidate if "undertrained" is confirmed.
- M4 Mac MPS acceleration is available; all fixes must be executable locally within the 2-hour budget.
- The Periodic Adaptation Pipeline and clip recording system are out of scope for this feature — only the core detection model is being fixed.
- The `maxlen=5` sticky-alert fix from the previous session is already applied and is not the root cause of the low AUC; AUC is a model quality metric independent of the alert window.
