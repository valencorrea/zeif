# Tasks: Direct Gemini Camera Detection

**Input**: Design documents from `/specs/004-direct-gemini-camera/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec. Included only for the API route (critical boundary).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included

---

## Phase 1: Setup

**Purpose**: Verify existing infrastructure is ready — no new project setup needed.

- [x] T001 Verify existing Gemini modules compile and tests pass: run `pnpm type-check` and `pnpm vitest run tests/lib/`
- [x] T002 Verify `analyzeVideo()` works with test fixture: run `npx tsx scripts/test-gemini-video.ts`

**Checkpoint**: Existing Gemini pipeline confirmed working.

---

## Phase 2: Foundational (API Route)

**Purpose**: The API route is a blocking prerequisite — all user stories need it to send video to Gemini.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Create API route handler in `src/app/api/analyze-video/route.ts` — accept raw binary body (video/webm or video/mp4), validate non-empty, convert to Buffer via `Request.arrayBuffer()`, call `analyzeVideo(buffer, displayName)`, return AnalysisResult JSON. Handle `GeminiConfigError` (400) and general errors (502). See `specs/004-direct-gemini-camera/contracts/analyze-video-api.md` for full contract.
- [x] T004 Create API route test in `tests/app/api/analyze-video/route.test.ts` — mock `analyzeVideo()` from `src/lib/gemini/analyze-video`, test: successful analysis returns 200 + AnalysisResult, empty body returns 400, missing API key returns 400, Gemini failure returns 502.
- [x] T005 Run `pnpm type-check` and `pnpm lint` to verify no regressions.

**Checkpoint**: `POST /api/analyze-video` works — testable via curl with a video file.

---

## Phase 3: User Story 1 — Record and Analyze a Clip (Priority: P1) MVP

**Goal**: Camera records a 5-second clip, sends it to Gemini via the API route, and displays the result. Continuous loop.

**Independent Test**: Open app → Floor View → grant camera → watch recording indicator → see analysis result → next cycle starts automatically.

### Implementation for User Story 1

- [x] T006 [US1] Extend `CameraState` type in `src/components/camera-view.tsx` — add `'recording' | 'analyzing'` to the existing union type. Add state for latest `AnalysisResult | null` and `error: string | null`.
- [x] T007 [US1] Add MediaRecorder setup in `src/components/camera-view.tsx` — when camera becomes `'active'`, create a `MediaRecorder` from the stream. Negotiate best mime type via `MediaRecorder.isTypeSupported()` (prefer `video/webm;codecs=vp9` → `video/webm` → `video/mp4`). Store recorder in a ref.
- [x] T008 [US1] Implement recording loop in `src/components/camera-view.tsx` — function `startRecordingCycle()`: set state to `'recording'`, call `recorder.start()`, after 5 seconds call `recorder.stop()`. On `ondataavailable` collect chunks. On `onstop` create Blob, set state to `'analyzing'`, POST blob to `/api/analyze-video` with correct Content-Type header. On response, parse JSON as `AnalysisResult`, store in state, set state back to `'active'`. After 3-second display pause, call `startRecordingCycle()` again. On fetch error, set error state, wait 3s, retry next cycle.
- [x] T009 [US1] Add recording indicator UI in `src/components/camera-view.tsx` — when state is `'recording'`, show a pulsing red dot + "REC" badge (similar to existing LIVE badge). When state is `'analyzing'`, show a spinner/loading indicator with "Analyzing..." text.
- [x] T010 [US1] Add tab visibility handling in `src/components/camera-view.tsx` — listen to `document.visibilitychange`. When tab is hidden, pause the recording loop (don't start new cycles). When tab becomes visible again, resume the loop.
- [x] T011 [US1] Run `pnpm type-check` and `pnpm lint` to verify.

**Checkpoint**: US1 fully functional — camera records, analyzes, loops. Results stored in state but not yet displayed with styled overlay.

---

## Phase 4: User Story 2 — Camera Unavailability (Priority: P2)

**Goal**: Clear error messages when camera is denied or unavailable.

**Independent Test**: Deny camera permissions → see actionable error message explaining how to enable.

### Implementation for User Story 2

- [x] T012 [US2] Enhance denied state UI in `src/components/camera-view.tsx` — replace the minimal "Camera access denied" text with an actionable message: icon, explanation of why camera is needed, and instructions to enable it in browser settings. Use existing design system colors (`text-[#fbfbe2]`, `bg-[#1b1d0e]`).
- [x] T013 [US2] Add detection for missing camera in `src/components/camera-view.tsx` — in the `getUserMedia` catch block, differentiate between `NotAllowedError` (denied) and `NotFoundError` (no camera). Show different messages for each.

**Checkpoint**: US2 complete — denied and no-camera states show clear, actionable messages.

---

## Phase 5: User Story 3 — Analysis Result Overlay (Priority: P2)

**Goal**: Display Gemini analysis results as a styled overlay on the camera feed.

**Independent Test**: Trigger an analysis → see result card with detection status, confidence %, reasoning text. Positive = alert red, negative = calm green, error = warning.

### Implementation for User Story 3

- [x] T014 [P] [US3] Create result overlay component in `src/components/camera-view.tsx` — inline component (or section within CameraView) that renders when `analysisResult` is not null. Shows: detection badge (ROBBERY DETECTED / ALL CLEAR), confidence as percentage, reasoning text. Positive detection uses alert colors (`bg-[#ffdad6]`, `text-[#93000a]`). Negative uses calm colors (`bg-[#a6f3cc]`, `text-[#002114]`). Auto-fades after 3 seconds (before next recording cycle).
- [x] T015 [P] [US3] Create error overlay in `src/components/camera-view.tsx` — when `error` state is set, show a warning overlay with yellow/amber styling (`bg-[#e3e89a]`, `text-[#1b1d00]`) displaying the error message and "Retrying..." indicator. Auto-dismiss when next cycle starts.
- [x] T016 [US3] Add framer-motion transitions in `src/components/camera-view.tsx` — use `AnimatePresence` + `motion.div` for result/error overlay enter/exit animations (fade + slide). framer-motion is already a project dependency.
- [x] T017 [US3] Run `pnpm type-check` and `pnpm lint` to verify.

**Checkpoint**: All 3 user stories complete — full recording + analysis + display loop with error handling.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [x] T018 Validate fetch timeout in `src/components/camera-view.tsx` — add `AbortController` with 30-second timeout to the fetch call in the recording loop. On timeout, set error state and continue to next cycle.
- [x] T019 Validate blob size before sending in `src/components/camera-view.tsx` — if recorded blob is 0 bytes, skip analysis, log warning, start next cycle.
- [x] T020 Run full validation: `pnpm type-check && pnpm lint && pnpm vitest run`
- [ ] T021 Manual E2E test: open app → Floor View → grant camera → verify full loop works (record → analyze → display result → repeat). Test with camera denied. Test with network off.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify existing code works
- **Foundational (Phase 2)**: Depends on Phase 1 — creates the API route all stories need
- **US1 (Phase 3)**: Depends on Phase 2 — recording loop needs API route
- **US2 (Phase 4)**: Depends on Phase 1 only — camera error handling is independent of API route
- **US3 (Phase 5)**: Depends on Phase 3 — result overlay needs recording loop to produce results
- **Polish (Phase 6)**: Depends on Phases 3-5

### User Story Dependencies

- **US1 (P1)**: Blocked by Phase 2 (API route). Core MVP.
- **US2 (P2)**: Independent of US1 — can be done in parallel after Phase 1.
- **US3 (P2)**: Depends on US1 — needs analysis results to display.

### Parallel Opportunities

- T014 and T015 can run in parallel (different UI sections, no shared state)
- US2 (Phase 4) can run in parallel with US1 (Phase 3) since they modify different parts of the component

---

## Parallel Example: User Story 3

```
# Launch overlay components together:
Task T014: "Create result overlay component in src/components/camera-view.tsx"
Task T015: "Create error overlay component in src/components/camera-view.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Verify existing pipeline ✓
2. Phase 2: Create API route (T003-T005)
3. Phase 3: Recording loop (T006-T011)
4. **STOP and VALIDATE**: Camera records, sends to Gemini, gets result back
5. This is a functional demo even without styled overlays

### Incremental Delivery

1. Setup + Foundational → API route works via curl
2. + US1 → Camera records and analyzes in a loop (MVP!)
3. + US2 → Graceful camera error handling
4. + US3 → Styled result overlays with animations
5. + Polish → Timeouts, edge cases, full validation

---

## Notes

- All UI work is in a single file (`src/components/camera-view.tsx`) — coordinate parallel tasks carefully
- The API route is the only new file (`src/app/api/analyze-video/route.ts`)
- No database changes, no new Supabase tables, no RLS needed
- Existing `analyzeVideo()` is used as-is — no modifications
- framer-motion already in dependencies — no install needed
