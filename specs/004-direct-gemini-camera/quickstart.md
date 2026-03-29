# Quickstart: Direct Gemini Camera Detection

## Prerequisites

- Node.js 18+
- pnpm installed
- `GEMINI_API_KEY` set in `.env.local`
- A device with a camera (or browser with camera simulation)

## Setup

```bash
pnpm install
pnpm dev
```

## Usage

1. Open `http://localhost:3000`
2. Navigate to "Floor View" from the sidebar
3. Grant camera permissions when prompted
4. The system will automatically:
   - Record a 5-second clip from your camera
   - Send it to Gemini for analysis
   - Display the result (detected/not detected, confidence, reasoning)
   - Start the next recording cycle

## Testing the API Route Directly

```bash
# Send a video file to the analyze endpoint
curl -X POST http://localhost:3000/api/analyze-video \
  -H "Content-Type: video/mp4" \
  --data-binary @fixtures/real-test-5s.mp4
```

## Key Files

| File | Purpose |
|------|---------|
| `src/components/camera-view.tsx` | Camera + recording + result display |
| `src/app/api/analyze-video/route.ts` | API route proxying to Gemini |
| `src/lib/gemini/analyze-video.ts` | Core Gemini analysis (unchanged) |
| `src/lib/gemini/types.ts` | AnalysisResult type (unchanged) |
