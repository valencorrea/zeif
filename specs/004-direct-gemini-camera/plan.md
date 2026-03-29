# Implementation Plan: Direct Gemini Camera Detection

**Branch**: `004-direct-gemini-camera` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-direct-gemini-camera/spec.md`

## Summary

Replace the two-stage frame scoring pipeline (VideoFrameProvider → FrameBuffer → rolling average → threshold → Gemini) with a simpler architecture: the browser camera records 2-5 second clips via MediaRecorder, sends them to a Next.js API route, which calls the existing `analyzeVideo()` function for direct Gemini robbery detection. Results are displayed as an overlay on the camera view.

## Technical Context

**Language/Version**: TypeScript 5.8 (strict mode)
**Primary Dependencies**: Next.js 15, React 19, @google/generative-ai 0.24, framer-motion, lucide-react
**Storage**: None for this feature (ephemeral clips only)
**Testing**: Vitest (unit + integration)
**Target Platform**: Modern desktop browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (Next.js)
**Performance Goals**: First result within 15s of camera grant; ~4 cycles/minute at 5s clips
**Constraints**: Gemini round-trip ~8-12s; browser MediaRecorder format varies by browser
**Scale/Scope**: Single user / single camera session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. [x] **Avoid code duplication (Principle VI)**: Reuses existing `analyzeVideo()`, `AnalysisResult` type, and `CameraView` component. No duplication.
2. [x] **Git worktree created (Principle VIII)**: Branch `004-direct-gemini-camera` created via speckit.
3. [x] **Latency impact < 50ms to pipeline (Principle V)**: This feature replaces the frame pipeline with direct video analysis. The 200ms per-frame budget doesn't apply — Gemini analysis is async (8-12s) and doesn't block the camera feed.
4. [x] **Components composable, not config-heavy (Principle IX)**: `CameraView` extended with recording state; result overlay is a separate component. No boolean prop proliferation.
5. [N/A] **Supabase tables RLS-enabled (DoD)**: No new tables. No database interaction in this feature.
6. [x] **Failure mode defaults to fail-open with alerts (Principle XI)**: Gemini failures show error in UI + auto-retry next cycle. Camera denial shows actionable message. No silent failures.
7. [x] **Camera integration behind adapter interface (Principle II)**: The browser camera is accessed via standard `getUserMedia` — no vendor-specific SDK. The existing `CameraView` component already abstracts this.
8. [N/A] **Triggers independently testable (Principle III)**: No triggers in this feature — it's the detection/UI layer, not the response layer.

**Post-design re-check**: All gates pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/004-direct-gemini-camera/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: setup guide
├── contracts/
│   └── analyze-video-api.md  # Phase 1: API contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   └── analyze-video/
│   │       └── route.ts          # NEW: receive video blob, call analyzeVideo()
│   └── page.tsx                  # existing (unchanged)
├── components/
│   ├── camera-view.tsx           # MODIFY: add recording + analysis loop + result display
│   └── dashboard.tsx             # existing (unchanged)
└── lib/
    └── gemini/
        ├── analyze-video.ts      # existing (unchanged)
        ├── types.ts              # existing (unchanged)
        ├── file-manager.ts       # existing (unchanged)
        └── client.ts             # existing (unchanged)

tests/
└── app/
    └── api/
        └── analyze-video/
            └── route.test.ts     # NEW: API route tests
```

**Structure Decision**: Extend the existing Next.js app structure. One new API route, one modified component. No new directories beyond `src/app/api/analyze-video/`.

## Implementation Tasks

### Task 1: API Route — `POST /api/analyze-video`

Create `src/app/api/analyze-video/route.ts`:
- Accept raw binary body (`video/webm` or `video/mp4`)
- Validate body is non-empty
- Convert to `Buffer` via `Request.arrayBuffer()`
- Call `analyzeVideo(buffer, displayName)` from existing module
- Return `AnalysisResult` JSON on success
- Return appropriate error responses (400, 502)
- Handle `GeminiConfigError` specifically

**Depends on**: Nothing (existing `analyzeVideo()` is stable)
**Test**: Unit test with mocked `analyzeVideo()`

### Task 2: Extend CameraView with Recording

Modify `src/components/camera-view.tsx`:
- Add states: `recording`, `analyzing`, `error` to the existing `CameraState` type
- Create `MediaRecorder` when camera becomes active
- Negotiate best supported mime type (`video/webm;codecs=vp9` → `video/webm` → `video/mp4`)
- Implement recording loop:
  1. Start recording for 5 seconds (configurable)
  2. On stop, collect chunks into Blob
  3. POST blob to `/api/analyze-video`
  4. Parse response, display result
  5. After brief display pause, start next recording
- Handle tab visibility (pause when backgrounded)
- Show recording indicator during capture
- Show loading/spinner during analysis

**Depends on**: Task 1 (API route must exist)

### Task 3: Analysis Result Overlay

Add result display to `CameraView`:
- Overlay on/near the camera feed
- Positive detection: alert styling (red/danger colors matching the existing design system — `bg-[#ffdad6]`, `text-[#93000a]`)
- Negative detection: calm styling (green — `bg-[#a6f3cc]`, `text-[#002114]`)
- Show: detection status, confidence percentage, reasoning text
- Auto-dismiss after configurable delay (default 3s) before next recording
- Error state: yellow/warning styling with retry message

**Depends on**: Task 2 (recording loop provides results to display)

### Task 4: Error Handling & Edge Cases

- Camera permission denied → existing denied state (already handled)
- Gemini API failure → show error overlay, auto-retry next cycle
- Network timeout → 30s fetch timeout, show error, continue
- Tab backgrounded → pause recording via `visibilitychange` listener
- Empty/corrupted recording → validate blob size > 0 before sending

**Depends on**: Tasks 2 + 3

### Task 5: Tests

- API route unit test: mock `analyzeVideo`, verify request handling and error responses
- Verify TypeScript compiles clean (`pnpm type-check`)
- Verify ESLint passes (`pnpm lint`)
- Manual E2E: open app, grant camera, verify recording + analysis loop works

**Depends on**: Tasks 1-4

## Complexity Tracking

No constitution violations — no complexity justifications needed.
