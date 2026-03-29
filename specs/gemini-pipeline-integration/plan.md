# Gemini Video Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take an MP4 video, send it to Gemini via the File API, and get back a shoplifting analysis result. Gemini keeps the file for processing.

**Architecture:** Video file → upload to Gemini File API → wait for ACTIVE state → send to model with analysis prompt → get structured JSON response (shoplifting yes/no, confidence, reasoning). Uses the existing `file-manager.ts` and `analyze-clip.ts` modules, adapted to work with a direct MP4 file path instead of only through Supabase.

**Tech Stack:** TypeScript, @google/generative-ai (already installed), existing Gemini modules.

---

## File Structure

```
src/
  lib/
    gemini/
      client.ts              — (exists) Gemini client init
      file-manager.ts        — (exists) Upload/wait/delete from File API
      analyze-clip.ts        — (exists, needs adaptation) Currently fetches from Supabase
      analyze-video.ts       — (NEW) Accept MP4 buffer directly → Gemini → result
      types.ts               — (exists) AnalysisResult type
scripts/
  test-gemini-video.ts       — (NEW) Test script: video file → Gemini → print result
```

---

## Task 0: Create analyze-video (direct MP4 → Gemini)

**Files:**
- Create: `src/lib/gemini/analyze-video.ts`

- [ ] **Step 1: Create the module**

Create `src/lib/gemini/analyze-video.ts`:

```typescript
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { uploadVideoBuffer, waitForFileActive, deleteFile } from "./file-manager";
import { GeminiConfigError } from "./client";
import type { AnalysisResult } from "./types";

const DEFAULT_MODEL = "gemini-2.0-flash";

const ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    shoplifting: { type: SchemaType.BOOLEAN },
    confidence: { type: SchemaType.NUMBER },
    reasoning: { type: SchemaType.STRING },
  },
  required: ["shoplifting", "confidence", "reasoning"],
};

const ANALYSIS_PROMPT =
  "You are a security analyst reviewing CCTV footage. " +
  "Analyse this video clip and determine if it shows shoplifting behaviour. " +
  "Respond with a JSON object following the provided schema. " +
  "`confidence` must be a float between 0 and 1. " +
  "`reasoning` must be one concise sentence in English.";

export async function analyzeVideo(
  videoBuffer: Buffer,
  displayName: string
): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server."
    );
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA,
    },
  });

  const uploaded = await uploadVideoBuffer(videoBuffer, displayName);

  try {
    await waitForFileActive(uploaded.fileName);

    const result = await model.generateContent([
      { fileData: { mimeType: "video/mp4", fileUri: uploaded.fileUri } },
      ANALYSIS_PROMPT,
    ]);

    const raw = JSON.parse(result.response.text());

    if (
      typeof raw.shoplifting !== "boolean" ||
      typeof raw.confidence !== "number" ||
      typeof raw.reasoning !== "string"
    ) {
      throw new Error(
        `Unexpected response shape: ${JSON.stringify(raw)}`
      );
    }

    return {
      shoplifting: raw.shoplifting,
      confidence: raw.confidence,
      reasoning: raw.reasoning,
    };
  } finally {
    await deleteFile(uploaded.fileName);
  }
}
```

- [ ] **Step 2: Run type-check**

Run: `pnpm type-check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/gemini/analyze-video.ts
git commit -m "feat: add analyzeVideo — direct MP4 buffer to Gemini analysis"
```

---

## Task 1: Test Script (video file → Gemini → result)

**Files:**
- Create: `scripts/test-gemini-video.ts`

- [ ] **Step 1: Create the test script**

Create `scripts/test-gemini-video.ts`:

```typescript
/**
 * Test: send a video file to Gemini for shoplifting analysis.
 * Usage: npx tsx scripts/test-gemini-video.ts [path-to-video.mp4]
 */

import { config } from "dotenv";
import path from "path";
import { readFileSync } from "fs";

config({ path: path.resolve(__dirname, "../.env.local") });

import { analyzeVideo } from "../src/lib/gemini/analyze-video";

const DEFAULT_VIDEO = path.resolve(__dirname, "../fixtures/real-test-5s.mp4");

async function main() {
  const videoPath = process.argv[2] || DEFAULT_VIDEO;

  console.log("=== Gemini Video Analysis Test ===\n");
  console.log(`Video: ${videoPath}`);
  console.log(`Model: ${process.env.GEMINI_MODEL || "gemini-2.0-flash"}\n`);

  const buffer = Buffer.from(readFileSync(videoPath));
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)}KB`);
  console.log("Uploading to Gemini File API...\n");

  const start = Date.now();
  const result = await analyzeVideo(buffer, path.basename(videoPath));
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log("=== Result ===\n");
  console.log(`Shoplifting: ${result.shoplifting}`);
  console.log(`Confidence:  ${result.confidence}`);
  console.log(`Reasoning:   ${result.reasoning}`);
  console.log(`\nTime: ${elapsed}s`);
}

main().catch(console.error);
```

- [ ] **Step 2: Run the test with a real video**

Run: `npx tsx scripts/test-gemini-video.ts`

Expected output:
```
=== Gemini Video Analysis Test ===

Video: fixtures/real-test-5s.mp4
Model: gemini-2.0-flash
File size: 60.5KB
Uploading to Gemini File API...

=== Result ===

Shoplifting: false
Confidence:  0.1
Reasoning:   The video shows a test pattern, not CCTV footage.

Time: 8.3s
```

- [ ] **Step 3: Commit**

```bash
git add scripts/test-gemini-video.ts
git commit -m "test: add script to test video analysis via Gemini"
```

---

## Task 2: Final Validation

- [ ] **Step 1: Run type-check**

Run: `pnpm type-check`

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

- [ ] **Step 3: Commit any fixes**
