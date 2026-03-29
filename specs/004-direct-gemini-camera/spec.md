# Feature Specification: Direct Gemini Camera Detection

**Feature Branch**: `004-direct-gemini-camera`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "Pivot from two-stage frame scoring pipeline to direct Gemini video analysis. Camera captures 2-5 second clips and sends them directly to Gemini for robbery detection. Replace frame-by-frame classification + rolling average approach with single-pass video analysis."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record and Analyze a Clip (Priority: P1)

A security operator opens the Zeif web app and sees a live camera feed. The system automatically records a short clip (2-5 seconds), sends it to Gemini for analysis, and displays the result (robbery detected or not, confidence score, reasoning).

**Why this priority**: This is the core value proposition — real-time robbery detection from camera footage via Gemini. Without this, nothing else matters.

**Independent Test**: Can be fully tested by opening the app, allowing camera access, waiting for a clip to be captured and analyzed, and verifying the result appears on screen.

**Acceptance Scenarios**:

1. **Given** the user has granted camera permissions, **When** the app starts recording, **Then** a 2-5 second video clip is captured from the camera feed.
2. **Given** a clip has been captured, **When** it is sent to Gemini, **Then** the system displays whether a robbery was detected, the confidence score (0-1), and a reasoning sentence.
3. **Given** the camera is active, **When** one analysis cycle completes, **Then** the system automatically starts recording the next clip (continuous monitoring loop).

---

### User Story 2 - Handle Camera Unavailability Gracefully (Priority: P2)

A user opens the app on a device without a camera or denies camera permissions. The system clearly communicates the issue and does not crash or show a blank screen.

**Why this priority**: Users must understand what went wrong and how to fix it. A broken first experience kills adoption.

**Independent Test**: Can be tested by denying camera permissions in the browser and verifying a clear error message is shown.

**Acceptance Scenarios**:

1. **Given** the user denies camera permissions, **When** the app loads, **Then** a clear message explains that camera access is required and how to enable it.
2. **Given** the device has no camera, **When** the app loads, **Then** a message informs the user that a camera is required.

---

### User Story 3 - View Analysis Results with Visual Feedback (Priority: P2)

After each analysis cycle, the user sees the result overlaid on or near the camera feed — a clear indicator of whether the clip was flagged, the confidence level, and the reasoning.

**Why this priority**: Without visible results, the operator has no way to act on detections. The UI must communicate urgency for positive detections.

**Independent Test**: Can be tested by triggering an analysis and verifying the result card/overlay appears with all three fields (detection status, confidence, reasoning).

**Acceptance Scenarios**:

1. **Given** Gemini returns a positive detection (robbery detected), **When** the result is displayed, **Then** it is visually prominent with alert styling, confidence, and reasoning visible.
2. **Given** Gemini returns a negative detection, **When** the result is displayed, **Then** it shows a neutral/calm indicator with confidence and reasoning.
3. **Given** Gemini analysis fails (network error, timeout), **When** the error occurs, **Then** the system displays an error state and continues recording the next clip.

---

### Edge Cases

- What happens when the network drops mid-analysis? The system should timeout, show an error, and retry with the next clip.
- What happens when the camera feed freezes or produces a black frame? The system should detect a low-quality clip and skip analysis, logging the event.
- What happens when Gemini rate limits are hit? The system should back off and retry after a delay, informing the user of reduced monitoring.
- What happens when the browser tab is backgrounded? Recording should pause and resume when the tab is active again (browsers throttle background tabs).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST access the device camera via the browser and display a live preview to the user.
- **FR-002**: System MUST record video clips of configurable duration (default 5 seconds, range 2-5 seconds) from the camera feed.
- **FR-003**: System MUST send each recorded clip directly to Gemini for robbery detection analysis (no intermediate frame scoring).
- **FR-004**: System MUST display the analysis result (detected: yes/no, confidence: 0-1, reasoning: text) after each clip is analyzed.
- **FR-005**: System MUST operate in a continuous loop: record clip -> analyze -> display result -> record next clip.
- **FR-006**: System MUST handle camera permission denial with a clear user-facing message.
- **FR-007**: System MUST handle Gemini API failures gracefully (display error, continue to next cycle).
- **FR-008**: System MUST visually distinguish between positive detections (robbery detected) and negative detections.
- **FR-009**: System MUST show a loading/analyzing state while waiting for Gemini's response.
- **FR-010**: System MUST encode captured video as MP4 before sending to Gemini.

### Key Entities

- **Clip**: A 2-5 second video recording from the device camera. Attributes: duration, timestamp, raw video data.
- **AnalysisResult**: The Gemini response for a clip. Attributes: robbery detected (boolean), confidence (0-1 float), reasoning (text).
- **CameraSession**: The active camera stream and its recording state. Attributes: stream status, current recording state, device info.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users see the first analysis result within 15 seconds of granting camera access (including recording time + Gemini round-trip).
- **SC-002**: The system completes at least 4 analysis cycles per minute during continuous monitoring (at 5-second clips + analysis time).
- **SC-003**: 100% of camera permission denials result in a visible, actionable error message (no blank screens or silent failures).
- **SC-004**: Analysis results are displayed within 2 seconds of receiving the Gemini response.
- **SC-005**: The system recovers from Gemini API failures and resumes monitoring within one cycle (no manual intervention required).

## Assumptions

- Users access the system via a modern browser (Chrome, Firefox, Safari, Edge) that supports MediaRecorder API and getUserMedia.
- The device has a functioning camera (front or rear).
- The existing Gemini video analysis module (`analyzeVideo`) is reused for the server-side analysis step — no changes to the Gemini interaction layer.
- Network connectivity is available for Gemini API calls; offline operation is out of scope.
- The two-stage frame scoring pipeline (VideoFrameProvider -> FrameBuffer -> rolling average -> threshold) is being replaced, not extended. Those components may remain in the codebase but are not used by this feature.
- Video is recorded in a format compatible with Gemini File API (MP4 or WebM converted to MP4).
- The Gemini API key is kept server-side; the browser sends video to a Next.js API route that proxies to Gemini.
- Mobile browser support is desired but not required for v1 — desktop browser is the primary target.
