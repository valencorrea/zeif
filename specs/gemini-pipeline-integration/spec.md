# Feature Specification: Gemini Pipeline Integration

**Feature Branch**: `geminiIntegration`
**Created**: 2026-03-28
**Status**: Draft
**Input**: Integrate the existing Gemini analysis code (Stage 2) with the VideoFrameProvider pipeline (Stage 1) so that frames flow from video → classification → buffer → rolling average trigger → clip encoding → Gemini confirmation → incident creation, end to end.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — End-to-End Detection Pipeline Runs Against a Video File (Priority: P1)

A developer starts the pipeline with a test video file. The VideoFrameProvider feeds frames into a classifier stub. When the rolling average crosses the 0.6 threshold, the system captures the 150-frame clip, encodes it to MP4, sends it to Gemini for analysis, and creates an incident record in Supabase with the result.

**Why this priority**: This is the core integration — connecting Stage 1 (frames + classification + buffer) to Stage 2 (Gemini confirmation + incident creation). Without this, the two halves of the system exist independently and cannot work together.

**Independent Test**: Can be fully tested by running the pipeline with a video file and a classifier stub that returns configurable scores, verifying that an incident is created in Supabase when the rolling average exceeds 0.6.

**Acceptance Scenarios**:

1. **Given** a video file and a classifier stub returning scores > 0.6, **When** the pipeline runs for 5 seconds (buffer fills), **Then** a clip is encoded, sent to Gemini, and an incident is created in Supabase.
2. **Given** a video file and a classifier stub returning scores < 0.4, **When** the pipeline runs for 10 seconds, **Then** no clip is captured and no incident is created.
3. **Given** a trigger occurs, **When** the cooldown period (30s) is active, **Then** no additional clips are captured until cooldown expires.

---

### User Story 2 — Pipeline Handles Gemini Failures Gracefully (Priority: P2)

When Gemini is unreachable or returns an error, the pipeline must still save the clip and create an unconfirmed incident, alerting the owner rather than silently dropping the evidence.

**Why this priority**: Fail-safe behavior is a constitution requirement (Principle XI). A security system that silently drops evidence during API failures is dangerous.

**Independent Test**: Can be tested by mocking the Gemini API to fail and verifying the clip is saved and an unconfirmed incident is created.

**Acceptance Scenarios**:

1. **Given** a captured clip, **When** Gemini API fails on first attempt, **Then** the system retries once.
2. **Given** a captured clip, **When** Gemini API fails on retry, **Then** the clip is saved to Supabase Storage and an unconfirmed incident is created with a descriptive error.

---

### User Story 3 — Pipeline Adds Audit Logs for Every Significant Event (Priority: P2)

Every significant pipeline event generates an audit log entry: detection triggered, clip saved, Gemini confirmed/rejected, API failure.

**Why this priority**: Audit trail is essential for a security system — incident review, legal evidence, and system debugging all depend on it.

**Independent Test**: Can be tested by running the pipeline and checking that audit_logs entries exist for each event type.

**Acceptance Scenarios**:

1. **Given** a detection trigger, **When** the pipeline completes successfully, **Then** audit_logs contains entries for: `incident.created`, `incident.clip_saved`, and `incident.confirmed` or `incident.rejected`.
2. **Given** a Gemini API failure, **When** the pipeline handles the error, **Then** audit_logs contains a `system.api_failure` entry with error details.

---

### Edge Cases

- What happens when the clip encoder fails? The system must log the error and attempt to save raw frames as fallback evidence.
- What happens when Supabase Storage upload fails? The incident must still be created with a note that the clip is missing.
- What happens when two triggers fire within the cooldown window? Only the first one should produce a clip.
- What happens when the video file ends (loop: false) mid-buffer? The pipeline must handle incomplete buffers gracefully without crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect VideoFrameProvider output to a frame classifier via the onFrame handler pattern.
- **FR-002**: System MUST store each frame and its classification score in the circular FrameBuffer.
- **FR-003**: System MUST compute the rolling average score after each frame is added to the buffer.
- **FR-004**: System MUST trigger clip capture when the buffer is full AND the rolling average score ≥ 0.6.
- **FR-005**: System MUST encode captured frames into an MP4 clip using FFmpeg.
- **FR-006**: System MUST send the encoded clip to Gemini for shoplifting analysis using the existing analyze-clip module.
- **FR-007**: System MUST create an incident record in Supabase with the Gemini analysis result.
- **FR-008**: System MUST upload the clip to Supabase Storage as evidence.
- **FR-009**: System MUST enforce a configurable cooldown period (default 30s) between triggers.
- **FR-010**: System MUST retry Gemini API calls once on failure, then save as unconfirmed incident.
- **FR-011**: System MUST create audit_log entries for all significant pipeline events.
- **FR-012**: System MUST use the existing Supabase admin client (service role) for all database operations.

### Key Entities

- **DetectionPipeline**: The orchestrator that connects VideoFrameProvider → Classifier → FrameBuffer → ClipCapture → Gemini → Supabase.
- **FrameBuffer (with scores)**: Circular buffer storing frames + classification scores, computes rolling average.
- **ClipEncoder**: Converts captured frames to MP4.
- **CooldownManager**: Tracks trigger cooldown to prevent re-triggering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: End-to-end pipeline runs from video file to incident creation in under 60 seconds (including Gemini analysis).
- **SC-002**: Zero evidence is lost when Gemini API fails — clip and unconfirmed incident are always saved.
- **SC-003**: Every pipeline run produces the correct number of audit log entries (minimum 3 per confirmed incident).
- **SC-004**: Cooldown prevents duplicate triggers — at most 1 clip per 30-second window.

## Assumptions

- The VideoFrameProvider, FrameBuffer, and Gemini analysis code already exist and are tested independently.
- A Supabase project is linked and tables (incidents, audit_logs, tenants) exist with RLS.
- FFmpeg is available on the developer's machine.
- The classifier for Stage 1 will initially be a configurable stub. Real model integration is a separate feature.
- The pipeline runs server-side (Node.js), not in the browser.
- A test tenant exists in the tenants table (or is created for testing purposes).
