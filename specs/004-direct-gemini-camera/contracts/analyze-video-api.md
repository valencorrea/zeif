# API Contract: POST /api/analyze-video

## Purpose

Receives a raw video blob from the browser, sends it to Gemini for robbery detection analysis, and returns the result.

## Request

```
POST /api/analyze-video
Content-Type: video/webm | video/mp4
Body: raw binary video data
```

No JSON wrapping. The body IS the video file.

## Response (200 OK)

```json
{
  "shoplifting": false,
  "confidence": 0.12,
  "reasoning": "The video shows normal customer browsing behavior with no suspicious activity."
}
```

| Field       | Type    | Description                              |
|-------------|---------|------------------------------------------|
| shoplifting | boolean | Whether robbery/shoplifting was detected  |
| confidence  | number  | 0.0 to 1.0 confidence score             |
| reasoning   | string  | One-sentence explanation                 |

## Error Responses

### 400 Bad Request
```json
{ "error": "GEMINI_API_KEY is not set..." }
```
Missing or invalid API key configuration.

### 400 Bad Request
```json
{ "error": "No video data received." }
```
Empty body or zero-length upload.

### 502 Bad Gateway
```json
{ "error": "Analysis failed.", "detail": "..." }
```
Gemini API error, timeout, or unexpected response.

## Notes

- Max expected payload: ~3MB (5s video at 720p)
- Expected response time: 8-15 seconds (Gemini upload + processing)
- The route calls `analyzeVideo()` from `src/lib/gemini/analyze-video.ts`
- No authentication required for MVP (server-side API key handles Gemini auth)
