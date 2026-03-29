# Research: Direct Gemini Camera Detection

## R-001: Browser Video Recording (MediaRecorder API)

**Decision**: Use `MediaRecorder` API with `getUserMedia` to capture clips from the device camera.

**Rationale**: Already partially implemented in `src/components/camera-view.tsx` which uses `getUserMedia` for the live preview. MediaRecorder is the standard browser API for recording video from a MediaStream. Supported in all modern browsers (Chrome 49+, Firefox 25+, Safari 14.1+, Edge 79+).

**Key findings**:
- MediaRecorder outputs WebM (VP8/VP9) in Chrome/Firefox, MP4 (H.264) in Safari
- Gemini File API accepts both `video/mp4` and `video/webm`
- No need for client-side format conversion — send the native recording format
- `mimeType` can be negotiated via `MediaRecorder.isTypeSupported()`
- Preferred codecs in order: `video/webm;codecs=vp9`, `video/webm;codecs=vp8`, `video/mp4`

**Alternatives considered**:
- Canvas frame capture + FFmpeg.wasm → Too heavy, large WASM bundle, unnecessary complexity
- Server-side FFmpeg conversion → Adds latency, the existing `analyzeVideo` already handles Buffer input

## R-002: Client-to-Server Video Upload Pattern

**Decision**: POST the recorded Blob to a new Next.js API route (`/api/analyze-video`) which calls `analyzeVideo()` server-side.

**Rationale**: The Gemini API key must stay server-side. The existing `analyzeVideo()` function accepts a `Buffer` and handles upload/analysis/cleanup. We just need a thin API route to receive the blob and call it.

**Key findings**:
- `Request.arrayBuffer()` in the route handler converts the upload to Buffer
- No need for multipart/form-data — send raw binary with `Content-Type: video/webm` or `video/mp4`
- Response returns the `AnalysisResult` JSON directly
- Max video size ~2-5s at 720p ≈ 1-3MB — well within Next.js default body limit

**Alternatives considered**:
- Upload to Supabase Storage first, then analyze → Adds unnecessary storage + latency for ephemeral clips
- Server-sent events for streaming results → Overkill for a single JSON response

## R-003: Recording Loop Architecture

**Decision**: Simple state machine in the camera component: `idle → recording → analyzing → displaying → recording`.

**Rationale**: The loop is sequential (record, then analyze, then show result, then record again). No need for Web Workers or complex concurrency. The existing `CameraView` component already manages camera state — extend it with recording + analysis states.

**Key findings**:
- `MediaRecorder.start()` / `MediaRecorder.stop()` with `ondataavailable` to collect chunks
- Use `setTimeout` or `MediaRecorder.start(durationMs)` for timed recording (the `timeslice` param emits data periodically but doesn't auto-stop — use `setTimeout` + `stop()`)
- Between cycles, the camera preview stays live (recording doesn't interrupt the video element)
- Tab visibility API (`document.visibilityState`) to pause recording when backgrounded

**Alternatives considered**:
- Web Worker for recording → Unnecessary, MediaRecorder runs on main thread efficiently for short clips
- Parallel record + analyze → Would require two streams or complex buffer management, not worth it for MVP

## R-004: Existing Code Reuse

**Decision**: Reuse `analyzeVideo()` from `src/lib/gemini/analyze-video.ts` as-is. Extend `CameraView` component with recording capabilities.

**Rationale**:
- `analyzeVideo(buffer, displayName)` already does: upload → wait for active → send to Gemini → parse result → cleanup. No changes needed.
- `CameraView` already has: camera permission handling, live preview, denied state UI. Add recording + analysis on top.
- The `AnalysisResult` type (`shoplifting`, `confidence`, `reasoning`) is already defined in `src/lib/gemini/types.ts`.

**What changes**:
- `CameraView` gets extended states: `recording`, `analyzing`, `result`
- New API route: `src/app/api/analyze-video/route.ts`
- Result overlay component for displaying analysis results

**What stays the same**:
- `analyzeVideo()`, `uploadVideoBuffer()`, `waitForFileActive()`, `deleteFile()` — untouched
- `AnalysisResult` type — untouched
- Gemini client configuration — untouched
