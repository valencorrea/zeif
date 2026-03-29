# Data Model: Direct Gemini Camera Detection

## Entities

### Clip (ephemeral — not persisted)

A short video recording captured from the browser camera. Lives only in memory during the record → analyze → display cycle.

| Field       | Type       | Description                                  |
|-------------|------------|----------------------------------------------|
| blob        | Blob       | Raw video data from MediaRecorder            |
| mimeType    | string     | MIME type of the recording (video/webm, etc) |
| duration    | number     | Recording duration in milliseconds           |
| timestamp   | number     | Unix timestamp when recording started        |

**Note**: Clips are not stored in any database. They are sent to the server for analysis and discarded after the result is returned.

### AnalysisResult (existing — `src/lib/gemini/types.ts`)

The structured response from Gemini after analyzing a video clip.

| Field       | Type    | Description                                |
|-------------|---------|-------------------------------------------|
| shoplifting | boolean | Whether shoplifting/robbery was detected   |
| confidence  | number  | Confidence score between 0 and 1          |
| reasoning   | string  | One-sentence explanation of the assessment |

**No changes** — this type already exists and is used by `analyzeVideo()`.

### CameraSession (client-side state only)

Managed via React state in the `CameraView` component. Not a database entity.

| State        | Description                                            |
|-------------|-------------------------------------------------------|
| requesting  | Asking for camera permissions                          |
| active      | Camera streaming, idle between cycles                  |
| recording   | MediaRecorder actively capturing a clip                |
| analyzing   | Clip sent to server, waiting for Gemini response       |
| denied      | Camera permission denied or no camera available        |
| error       | Gemini API or network error (transient, auto-recovers) |

**State transitions**:
```
requesting → active (permission granted)
requesting → denied (permission denied / no camera)
active → recording (auto-start or manual trigger)
recording → analyzing (clip captured, sent to server)
analyzing → active (result received, display it, then start next cycle)
analyzing → error (API failure) → active (auto-retry next cycle)
```

## Database Impact

**None.** This feature does not create, modify, or query any database tables. All data flows are ephemeral:
- Camera → Browser memory (Blob) → Server API route (Buffer) → Gemini API → JSON response → UI display

The existing `incidents` table and Supabase storage are not used by this feature's core flow.
