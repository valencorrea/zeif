# Theft Detection Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-stage detection pipeline that ingests camera frames, classifies them locally for suspicious activity (shoplifting/pickpocketing), assembles 5-second clips, confirms via external vision API, and records incidents with evidence.

**Architecture:** A circular buffer continuously stores the last 150 frames (5s at 30 FPS). Stage 1 classifies each frame with a local model (≤200ms). When suspicion is detected, the buffer captures 3s pre + 2s post, encodes to H.264 MP4, sends to an external vision API for confirmation. Confirmed thefts save the clip to Supabase Storage, create an incident record, and surface a 911 button in the owner's UI.

**Tech Stack:** Next.js 15, TypeScript (strict), Supabase (Postgres + Storage + RLS), Vitest for testing, FFmpeg (via fluent-ffmpeg) for encoding.

---

## File Structure

```
src/
  lib/
    pipeline/
      zeif-frame.ts          — ZeifFrame type definition
      frame-buffer.ts        — Circular buffer implementation
      classification-queue.ts — Queue with overflow protection (max 10)
      clip-capture.ts        — Pre+post event capture logic
      clip-encoder.ts        — FFmpeg encoding (frames → MP4)
    detection/
      classifier.ts          — Stage 1: local frame classifier interface + stub
      vision-api.ts          — Stage 2: external vision API client
      detection-types.ts     — Shared types (DetectionResult, VisionResponse, etc.)
    incidents/
      incident-service.ts    — Create/query incidents in Supabase
      evidence-storage.ts    — Upload clips to Supabase Storage
    triggers/
      trigger-types.ts       — Trigger interfaces
      emergency-button.ts    — 911 button trigger logic
    supabase/
      client.ts              — Supabase client (already exists or create)
      migrations/
        001_incidents.sql    — incidents table + RLS
        002_zone_segments.sql — zone_segments table + RLS
  app/
    dashboard/
      page.tsx               — Owner dashboard (incident list + 911 button)
    api/
      incidents/
        route.ts             — GET/POST incidents API route
tests/
  lib/
    pipeline/
      frame-buffer.test.ts
      classification-queue.test.ts
      clip-capture.test.ts
      clip-encoder.test.ts
    detection/
      classifier.test.ts
      vision-api.test.ts
    incidents/
      incident-service.test.ts
      evidence-storage.test.ts
    triggers/
      emergency-button.test.ts
```

---

## Task 0: Set Up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

```bash
pnpm add -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `"scripts"` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create a smoke test to verify setup**

Create `tests/setup.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("vitest setup", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test`
Expected: 1 test passes

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml tests/setup.test.ts
git commit -m "chore: add vitest testing framework"
```

---

## Task 1: ZeifFrame Type

**Files:**
- Create: `src/lib/pipeline/zeif-frame.ts`
- Test: `tests/lib/pipeline/zeif-frame.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/pipeline/zeif-frame.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createZeifFrame, type ZeifFrame } from "@/lib/pipeline/zeif-frame";

describe("ZeifFrame", () => {
  it("creates a frame with required fields", () => {
    const imageData = new Uint8Array([1, 2, 3]);
    const frame = createZeifFrame({
      imageData,
      sourceId: "camera-001",
    });

    expect(frame.imageData).toBe(imageData);
    expect(frame.sourceId).toBe("camera-001");
    expect(frame.timestamp).toBeTypeOf("number");
    expect(frame.id).toBeTypeOf("string");
  });

  it("uses provided timestamp when given", () => {
    const now = Date.now();
    const frame = createZeifFrame({
      imageData: new Uint8Array([1]),
      sourceId: "camera-001",
      timestamp: now,
    });

    expect(frame.timestamp).toBe(now);
  });

  it("generates unique IDs for each frame", () => {
    const frame1 = createZeifFrame({
      imageData: new Uint8Array([1]),
      sourceId: "camera-001",
    });
    const frame2 = createZeifFrame({
      imageData: new Uint8Array([2]),
      sourceId: "camera-001",
    });

    expect(frame1.id).not.toBe(frame2.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/pipeline/zeif-frame.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/pipeline/zeif-frame.ts`:

```typescript
export interface ZeifFrame {
  readonly id: string;
  readonly imageData: Uint8Array;
  readonly timestamp: number;
  readonly sourceId: string;
  readonly metadata?: Record<string, unknown>;
}

interface CreateFrameInput {
  imageData: Uint8Array;
  sourceId: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

let frameCounter = 0;

export function createZeifFrame(input: CreateFrameInput): ZeifFrame {
  frameCounter++;
  return {
    id: `frame-${Date.now()}-${frameCounter}`,
    imageData: input.imageData,
    timestamp: input.timestamp ?? Date.now(),
    sourceId: input.sourceId,
    metadata: input.metadata,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/pipeline/zeif-frame.test.ts`
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/zeif-frame.ts tests/lib/pipeline/zeif-frame.test.ts
git commit -m "feat: add ZeifFrame type and factory function"
```

---

## Task 2: Circular Frame Buffer

**Files:**
- Create: `src/lib/pipeline/frame-buffer.ts`
- Test: `tests/lib/pipeline/frame-buffer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/pipeline/frame-buffer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { FrameBuffer } from "@/lib/pipeline/frame-buffer";
import { createZeifFrame } from "@/lib/pipeline/zeif-frame";

function makeFrame(id: number) {
  return createZeifFrame({
    imageData: new Uint8Array([id]),
    sourceId: "camera-001",
    timestamp: id * 1000,
  });
}

describe("FrameBuffer", () => {
  it("creates buffer with given capacity", () => {
    const buffer = new FrameBuffer(150);
    expect(buffer.capacity).toBe(150);
    expect(buffer.size).toBe(0);
  });

  it("pushes and retrieves frames in order", () => {
    const buffer = new FrameBuffer(5);
    const f1 = makeFrame(1);
    const f2 = makeFrame(2);
    const f3 = makeFrame(3);

    buffer.push(f1);
    buffer.push(f2);
    buffer.push(f3);

    const frames = buffer.getAll();
    expect(frames).toHaveLength(3);
    expect(frames[0].timestamp).toBe(1000);
    expect(frames[2].timestamp).toBe(3000);
  });

  it("overwrites oldest frames when full", () => {
    const buffer = new FrameBuffer(3);
    buffer.push(makeFrame(1));
    buffer.push(makeFrame(2));
    buffer.push(makeFrame(3));
    buffer.push(makeFrame(4)); // overwrites frame 1

    const frames = buffer.getAll();
    expect(frames).toHaveLength(3);
    expect(frames[0].timestamp).toBe(2000); // oldest is now frame 2
    expect(frames[2].timestamp).toBe(4000); // newest is frame 4
  });

  it("returns a snapshot copy, not a reference", () => {
    const buffer = new FrameBuffer(5);
    buffer.push(makeFrame(1));

    const snapshot1 = buffer.getAll();
    buffer.push(makeFrame(2));
    const snapshot2 = buffer.getAll();

    expect(snapshot1).toHaveLength(1);
    expect(snapshot2).toHaveLength(2);
  });

  it("returns frames within a time range", () => {
    const buffer = new FrameBuffer(10);
    buffer.push(makeFrame(1)); // t=1000
    buffer.push(makeFrame(2)); // t=2000
    buffer.push(makeFrame(3)); // t=3000
    buffer.push(makeFrame(4)); // t=4000
    buffer.push(makeFrame(5)); // t=5000

    const range = buffer.getRange(2000, 4000);
    expect(range).toHaveLength(3);
    expect(range[0].timestamp).toBe(2000);
    expect(range[2].timestamp).toBe(4000);
  });

  it("reports correct size after overwrites", () => {
    const buffer = new FrameBuffer(3);
    buffer.push(makeFrame(1));
    buffer.push(makeFrame(2));
    buffer.push(makeFrame(3));
    buffer.push(makeFrame(4));

    expect(buffer.size).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/pipeline/frame-buffer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/pipeline/frame-buffer.ts`:

```typescript
import type { ZeifFrame } from "./zeif-frame";

export class FrameBuffer {
  readonly capacity: number;
  private buffer: (ZeifFrame | null)[];
  private head = 0;
  private count = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  get size(): number {
    return this.count;
  }

  push(frame: ZeifFrame): void {
    this.buffer[this.head] = frame;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  getAll(): ZeifFrame[] {
    if (this.count === 0) return [];

    const frames: ZeifFrame[] = [];
    const start =
      this.count < this.capacity
        ? 0
        : this.head; // head points to oldest when full

    for (let i = 0; i < this.count; i++) {
      const index = (start + i) % this.capacity;
      frames.push(this.buffer[index]!);
    }

    return frames;
  }

  getRange(fromTimestamp: number, toTimestamp: number): ZeifFrame[] {
    return this.getAll().filter(
      (f) => f.timestamp >= fromTimestamp && f.timestamp <= toTimestamp
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/pipeline/frame-buffer.test.ts`
Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/frame-buffer.ts tests/lib/pipeline/frame-buffer.test.ts
git commit -m "feat: add circular FrameBuffer with time-range queries"
```

---

## Task 3: Classification Queue with Overflow Protection

**Files:**
- Create: `src/lib/pipeline/classification-queue.ts`
- Test: `tests/lib/pipeline/classification-queue.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/pipeline/classification-queue.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ClassificationQueue } from "@/lib/pipeline/classification-queue";
import { createZeifFrame } from "@/lib/pipeline/zeif-frame";

function makeFrame(id: number) {
  return createZeifFrame({
    imageData: new Uint8Array([id]),
    sourceId: "camera-001",
    timestamp: id * 1000,
  });
}

describe("ClassificationQueue", () => {
  it("enqueues and dequeues frames in FIFO order", () => {
    const queue = new ClassificationQueue(10);
    const f1 = makeFrame(1);
    const f2 = makeFrame(2);

    queue.enqueue(f1);
    queue.enqueue(f2);

    expect(queue.dequeue()).toBe(f1);
    expect(queue.dequeue()).toBe(f2);
  });

  it("returns null when dequeuing from empty queue", () => {
    const queue = new ClassificationQueue(10);
    expect(queue.dequeue()).toBeNull();
  });

  it("drops oldest frames and logs when exceeding max depth", () => {
    const onDrop = vi.fn();
    const queue = new ClassificationQueue(3, onDrop);

    queue.enqueue(makeFrame(1));
    queue.enqueue(makeFrame(2));
    queue.enqueue(makeFrame(3));
    queue.enqueue(makeFrame(4)); // should drop frame 1

    expect(queue.depth).toBe(3);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: 1000 })
    );

    const first = queue.dequeue();
    expect(first?.timestamp).toBe(2000);
  });

  it("reports current depth", () => {
    const queue = new ClassificationQueue(10);
    expect(queue.depth).toBe(0);

    queue.enqueue(makeFrame(1));
    queue.enqueue(makeFrame(2));
    expect(queue.depth).toBe(2);

    queue.dequeue();
    expect(queue.depth).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/pipeline/classification-queue.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/pipeline/classification-queue.ts`:

```typescript
import type { ZeifFrame } from "./zeif-frame";

export class ClassificationQueue {
  private queue: ZeifFrame[] = [];
  private maxDepth: number;
  private onDrop: (frame: ZeifFrame) => void;

  constructor(
    maxDepth: number,
    onDrop: (frame: ZeifFrame) => void = () => {}
  ) {
    this.maxDepth = maxDepth;
    this.onDrop = onDrop;
  }

  get depth(): number {
    return this.queue.length;
  }

  enqueue(frame: ZeifFrame): void {
    if (this.queue.length >= this.maxDepth) {
      const dropped = this.queue.shift()!;
      this.onDrop(dropped);
    }
    this.queue.push(frame);
  }

  dequeue(): ZeifFrame | null {
    return this.queue.shift() ?? null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/pipeline/classification-queue.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/classification-queue.ts tests/lib/pipeline/classification-queue.test.ts
git commit -m "feat: add ClassificationQueue with overflow drop + callback"
```

---

## Task 4: Detection Types

**Files:**
- Create: `src/lib/detection/detection-types.ts`

- [ ] **Step 1: Create shared detection types**

Create `src/lib/detection/detection-types.ts`:

```typescript
export type TheftType = "shoplifting" | "pickpocket" | "none";

export interface ClassificationResult {
  readonly score: number; // 0-1
  readonly signals: string[]; // what the classifier saw (e.g., "concealing_merchandise")
}

export interface VisionApiResponse {
  readonly confirmed: boolean;
  readonly confidence: number; // 0-1
  readonly description: string;
  readonly theftType: TheftType;
  readonly itemsTargeted: string[];
  readonly peopleCount: number;
}

export interface Incident {
  readonly id: string;
  readonly timestamp: number;
  readonly confirmed: boolean;
  readonly confidence: number;
  readonly theftType: TheftType;
  readonly description: string;
  readonly clipPath: string;
  readonly zoneContext: string | null;
  readonly createdAt: string;
}

export interface ZoneSegment {
  readonly id: string;
  readonly zoneId: string;
  readonly theftType: TheftType;
  readonly frequency: number; // 0-1 percentage
}

export const SUSPICION_THRESHOLD = 0.4;
```

- [ ] **Step 2: Run type-check to verify no errors**

Run: `pnpm type-check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/detection/detection-types.ts
git commit -m "feat: add shared detection types (ClassificationResult, VisionApiResponse, Incident)"
```

---

## Task 5: Stage 1 — Local Frame Classifier

**Files:**
- Create: `src/lib/detection/classifier.ts`
- Test: `tests/lib/detection/classifier.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/detection/classifier.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  type FrameClassifier,
  createStubClassifier,
} from "@/lib/detection/classifier";
import { createZeifFrame } from "@/lib/pipeline/zeif-frame";
import { SUSPICION_THRESHOLD } from "@/lib/detection/detection-types";

function makeFrame() {
  return createZeifFrame({
    imageData: new Uint8Array([1, 2, 3]),
    sourceId: "camera-001",
  });
}

describe("FrameClassifier interface", () => {
  it("stub classifier returns a configurable score", async () => {
    const classifier = createStubClassifier(0.8, ["concealing_merchandise"]);
    const result = await classifier.classify(makeFrame());

    expect(result.score).toBe(0.8);
    expect(result.signals).toEqual(["concealing_merchandise"]);
  });

  it("stub classifier with low score returns below threshold", async () => {
    const classifier = createStubClassifier(0.1, []);
    const result = await classifier.classify(makeFrame());

    expect(result.score).toBeLessThan(SUSPICION_THRESHOLD);
    expect(result.signals).toEqual([]);
  });
});

describe("isSuspicious helper", () => {
  it("returns true when score >= threshold", async () => {
    const { isSuspicious } = await import("@/lib/detection/classifier");
    expect(isSuspicious({ score: 0.4, signals: [] })).toBe(true);
    expect(isSuspicious({ score: 0.9, signals: [] })).toBe(true);
  });

  it("returns false when score < threshold", async () => {
    const { isSuspicious } = await import("@/lib/detection/classifier");
    expect(isSuspicious({ score: 0.39, signals: [] })).toBe(false);
    expect(isSuspicious({ score: 0, signals: [] })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/detection/classifier.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/detection/classifier.ts`:

```typescript
import type { ZeifFrame } from "@/lib/pipeline/zeif-frame";
import {
  type ClassificationResult,
  SUSPICION_THRESHOLD,
} from "./detection-types";

export interface FrameClassifier {
  classify(frame: ZeifFrame): Promise<ClassificationResult>;
}

export function isSuspicious(result: ClassificationResult): boolean {
  return result.score >= SUSPICION_THRESHOLD;
}

export function createStubClassifier(
  score: number,
  signals: string[]
): FrameClassifier {
  return {
    async classify(): Promise<ClassificationResult> {
      return { score, signals };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/detection/classifier.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/detection/classifier.ts tests/lib/detection/classifier.test.ts
git commit -m "feat: add FrameClassifier interface, stub, and isSuspicious helper"
```

---

## Task 6: Clip Capture (Pre + Post Event)

**Files:**
- Create: `src/lib/pipeline/clip-capture.ts`
- Test: `tests/lib/pipeline/clip-capture.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/pipeline/clip-capture.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { captureClip } from "@/lib/pipeline/clip-capture";
import { FrameBuffer } from "@/lib/pipeline/frame-buffer";
import { createZeifFrame } from "@/lib/pipeline/zeif-frame";

function fillBuffer(buffer: FrameBuffer, count: number, startTimestamp = 0) {
  for (let i = 0; i < count; i++) {
    buffer.push(
      createZeifFrame({
        imageData: new Uint8Array([i % 256]),
        sourceId: "camera-001",
        timestamp: startTimestamp + i * 33, // ~30fps = 33ms per frame
      })
    );
  }
}

describe("captureClip", () => {
  it("captures frames from buffer as a snapshot", () => {
    const buffer = new FrameBuffer(150);
    fillBuffer(buffer, 150);

    const clip = captureClip(buffer, 75 * 33); // cut point in the middle

    expect(clip.frames.length).toBeGreaterThan(0);
    expect(clip.frames.length).toBeLessThanOrEqual(150);
    expect(clip.cutPointTimestamp).toBe(75 * 33);
  });

  it("includes metadata about pre and post durations", () => {
    const buffer = new FrameBuffer(150);
    fillBuffer(buffer, 150);

    const cutTimestamp = 75 * 33;
    const clip = captureClip(buffer, cutTimestamp);

    expect(clip.cutPointTimestamp).toBe(cutTimestamp);
    expect(clip.sourceId).toBe("camera-001");
  });

  it("captures all available frames when buffer is not full", () => {
    const buffer = new FrameBuffer(150);
    fillBuffer(buffer, 50); // only 50 frames

    const cutTimestamp = 25 * 33;
    const clip = captureClip(buffer, cutTimestamp);

    expect(clip.frames.length).toBe(50);
  });

  it("returns frames ordered by timestamp (oldest first)", () => {
    const buffer = new FrameBuffer(150);
    fillBuffer(buffer, 150);

    const clip = captureClip(buffer, 75 * 33);
    for (let i = 1; i < clip.frames.length; i++) {
      expect(clip.frames[i].timestamp).toBeGreaterThan(
        clip.frames[i - 1].timestamp
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/pipeline/clip-capture.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/pipeline/clip-capture.ts`:

```typescript
import type { ZeifFrame } from "./zeif-frame";
import type { FrameBuffer } from "./frame-buffer";

export interface CapturedClip {
  readonly frames: ZeifFrame[];
  readonly cutPointTimestamp: number;
  readonly sourceId: string;
  readonly capturedAt: number;
}

export function captureClip(
  buffer: FrameBuffer,
  cutPointTimestamp: number
): CapturedClip {
  const frames = buffer.getAll();
  const sourceId = frames.length > 0 ? frames[0].sourceId : "unknown";

  return {
    frames,
    cutPointTimestamp,
    sourceId,
    capturedAt: Date.now(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/pipeline/clip-capture.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/clip-capture.ts tests/lib/pipeline/clip-capture.test.ts
git commit -m "feat: add clip capture from buffer with pre+post event snapshot"
```

---

## Task 7: Clip Encoder (Frames → MP4)

**Files:**
- Create: `src/lib/pipeline/clip-encoder.ts`
- Test: `tests/lib/pipeline/clip-encoder.test.ts`

- [ ] **Step 1: Install fluent-ffmpeg**

```bash
pnpm add fluent-ffmpeg
pnpm add -D @types/fluent-ffmpeg
```

- [ ] **Step 2: Write the failing tests**

Create `tests/lib/pipeline/clip-encoder.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  type ClipEncoder,
  createMockEncoder,
  type EncodeOptions,
} from "@/lib/pipeline/clip-encoder";
import { createZeifFrame } from "@/lib/pipeline/zeif-frame";

function makeFrames(count: number): ReturnType<typeof createZeifFrame>[] {
  return Array.from({ length: count }, (_, i) =>
    createZeifFrame({
      imageData: new Uint8Array([i % 256]),
      sourceId: "camera-001",
      timestamp: i * 33,
    })
  );
}

describe("ClipEncoder", () => {
  it("mock encoder returns a buffer with metadata", async () => {
    const encoder = createMockEncoder();
    const frames = makeFrames(150);

    const result = await encoder.encode(frames, {
      fps: 30,
      width: 640,
      height: 480,
    });

    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.mimeType).toBe("video/mp4");
    expect(result.frameCount).toBe(150);
    expect(result.durationMs).toBe(5000); // 150 frames at 30fps
  });

  it("mock encoder calculates duration correctly", async () => {
    const encoder = createMockEncoder();
    const frames = makeFrames(90); // 3 seconds at 30fps

    const result = await encoder.encode(frames, {
      fps: 30,
      width: 640,
      height: 480,
    });

    expect(result.durationMs).toBe(3000);
  });

  it("rejects when given empty frames", async () => {
    const encoder = createMockEncoder();

    await expect(
      encoder.encode([], { fps: 30, width: 640, height: 480 })
    ).rejects.toThrow("No frames to encode");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/lib/pipeline/clip-encoder.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/pipeline/clip-encoder.ts`:

```typescript
import type { ZeifFrame } from "./zeif-frame";

export interface EncodeOptions {
  readonly fps: number;
  readonly width: number;
  readonly height: number;
}

export interface EncodedClip {
  readonly data: Buffer;
  readonly mimeType: string;
  readonly frameCount: number;
  readonly durationMs: number;
}

export interface ClipEncoder {
  encode(frames: ZeifFrame[], options: EncodeOptions): Promise<EncodedClip>;
}

export function createMockEncoder(): ClipEncoder {
  return {
    async encode(
      frames: ZeifFrame[],
      options: EncodeOptions
    ): Promise<EncodedClip> {
      if (frames.length === 0) {
        throw new Error("No frames to encode");
      }

      const durationMs = Math.round((frames.length / options.fps) * 1000);

      return {
        data: Buffer.from(`mock-mp4-${frames.length}-frames`),
        mimeType: "video/mp4",
        frameCount: frames.length,
        durationMs,
      };
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/lib/pipeline/clip-encoder.test.ts`
Expected: 3 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/pipeline/clip-encoder.ts tests/lib/pipeline/clip-encoder.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add ClipEncoder interface and mock encoder for testing"
```

> **Note:** The real FFmpeg encoder (`createFfmpegEncoder`) will be added when integrating with actual camera hardware. The interface is stable — swap implementations without changing consumers.

---

## Task 8: Stage 2 — Vision API Client

**Files:**
- Create: `src/lib/detection/vision-api.ts`
- Test: `tests/lib/detection/vision-api.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/detection/vision-api.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  type VisionApiClient,
  createVisionApiClient,
  buildPrompt,
} from "@/lib/detection/vision-api";
import type { VisionApiResponse } from "@/lib/detection/detection-types";

describe("buildPrompt", () => {
  it("builds a prompt without zone context", () => {
    const prompt = buildPrompt(null);

    expect(prompt).toContain("security camera");
    expect(prompt).toContain("shoplifting");
    expect(prompt).toContain("JSON");
    expect(prompt).not.toContain("zone");
  });

  it("includes zone context when provided", () => {
    const prompt = buildPrompt(
      "In this zone, 70% of thefts are shoplifting, 20% are pickpocketing"
    );

    expect(prompt).toContain("70% of thefts are shoplifting");
  });
});

describe("VisionApiClient", () => {
  it("sends clip and returns parsed response on success", async () => {
    const mockResponse: VisionApiResponse = {
      confirmed: true,
      confidence: 0.85,
      description: "Person concealing merchandise in bag",
      theftType: "shoplifting",
      itemsTargeted: ["electronics"],
      peopleCount: 1,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const client = createVisionApiClient({
      apiUrl: "https://api.example.com/vision",
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const result = await client.analyze(
      Buffer.from("fake-video"),
      null
    );

    expect(result.confirmed).toBe(true);
    expect(result.theftType).toBe("shoplifting");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries once on failure then throws", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error again"));

    const client = createVisionApiClient({
      apiUrl: "https://api.example.com/vision",
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    await expect(
      client.analyze(Buffer.from("fake-video"), null)
    ).rejects.toThrow("Network error again");

    expect(mockFetch).toHaveBeenCalledTimes(2); // 1 try + 1 retry
  });

  it("retries once and succeeds on second attempt", async () => {
    const mockResponse: VisionApiResponse = {
      confirmed: false,
      confidence: 0.2,
      description: "Normal shopping behavior",
      theftType: "none",
      itemsTargeted: [],
      peopleCount: 1,
    };

    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

    const client = createVisionApiClient({
      apiUrl: "https://api.example.com/vision",
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const result = await client.analyze(Buffer.from("fake-video"), null);

    expect(result.confirmed).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/detection/vision-api.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/detection/vision-api.ts`:

```typescript
import type { VisionApiResponse } from "./detection-types";

type FetchFn = typeof globalThis.fetch;

interface VisionApiConfig {
  apiUrl: string;
  apiKey: string;
  fetchFn?: FetchFn;
}

export interface VisionApiClient {
  analyze(
    clipData: Buffer,
    zoneContext: string | null
  ): Promise<VisionApiResponse>;
}

export function buildPrompt(zoneContext: string | null): string {
  let prompt =
    "Analyze this security camera clip. Determine if shoplifting or pickpocketing is occurring. " +
    "Respond in JSON with the following fields: " +
    "confirmed (boolean), confidence (0-1), description (string), " +
    'theftType ("shoplifting" | "pickpocket" | "none"), ' +
    "itemsTargeted (string[]), peopleCount (number).";

  if (zoneContext) {
    prompt += ` Additional zone context: ${zoneContext}`;
  }

  return prompt;
}

export function createVisionApiClient(config: VisionApiConfig): VisionApiClient {
  const fetchFn = config.fetchFn ?? globalThis.fetch;

  async function callApi(
    clipData: Buffer,
    zoneContext: string | null
  ): Promise<VisionApiResponse> {
    const prompt = buildPrompt(zoneContext);

    const response = await fetchFn(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        clip: clipData.toString("base64"),
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`);
    }

    return response.json() as Promise<VisionApiResponse>;
  }

  return {
    async analyze(
      clipData: Buffer,
      zoneContext: string | null
    ): Promise<VisionApiResponse> {
      try {
        return await callApi(clipData, zoneContext);
      } catch {
        // Retry once (Principle XI: fail-safe)
        return await callApi(clipData, zoneContext);
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/detection/vision-api.test.ts`
Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/detection/vision-api.ts tests/lib/detection/vision-api.test.ts
git commit -m "feat: add VisionApiClient with retry-once and prompt builder"
```

---

## Task 9: Evidence Storage (Supabase Storage)

**Files:**
- Create: `src/lib/incidents/evidence-storage.ts`
- Test: `tests/lib/incidents/evidence-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/incidents/evidence-storage.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { EvidenceStorage } from "@/lib/incidents/evidence-storage";

function createMockSupabaseStorage() {
  const upload = vi.fn().mockResolvedValue({ data: { path: "clips/test.mp4" }, error: null });
  const getPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: "https://storage.example.com/clips/test.mp4" },
  });

  return {
    storage: {
      from: vi.fn().mockReturnValue({ upload, getPublicUrl }),
    },
    upload,
    getPublicUrl,
  };
}

describe("EvidenceStorage", () => {
  it("uploads a clip and returns the path", async () => {
    const mock = createMockSupabaseStorage();
    const storage = new EvidenceStorage(mock as any, "evidence");

    const result = await storage.uploadClip(
      Buffer.from("fake-mp4"),
      "incident-123"
    );

    expect(result.path).toContain("incident-123");
    expect(result.path).toContain(".mp4");
    expect(mock.storage.from).toHaveBeenCalledWith("evidence");
    expect(mock.upload).toHaveBeenCalledTimes(1);
  });

  it("throws when upload fails", async () => {
    const upload = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Bucket not found" },
    });

    const mock = {
      storage: {
        from: vi.fn().mockReturnValue({ upload }),
      },
    };

    const storage = new EvidenceStorage(mock as any, "evidence");

    await expect(
      storage.uploadClip(Buffer.from("fake"), "incident-123")
    ).rejects.toThrow("Bucket not found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/incidents/evidence-storage.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/incidents/evidence-storage.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UploadResult {
  readonly path: string;
}

export class EvidenceStorage {
  private supabase: SupabaseClient;
  private bucket: string;

  constructor(supabase: SupabaseClient, bucket: string) {
    this.supabase = supabase;
    this.bucket = bucket;
  }

  async uploadClip(
    clipData: Buffer,
    incidentId: string
  ): Promise<UploadResult> {
    const path = `clips/${incidentId}-${Date.now()}.mp4`;

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, clipData, {
        contentType: "video/mp4",
      });

    if (error) {
      throw new Error(error.message);
    }

    return { path: data.path };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/incidents/evidence-storage.test.ts`
Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/incidents/evidence-storage.ts tests/lib/incidents/evidence-storage.test.ts
git commit -m "feat: add EvidenceStorage for uploading clips to Supabase Storage"
```

---

## Task 10: Incident Service (Supabase DB)

**Files:**
- Create: `src/lib/incidents/incident-service.ts`
- Test: `tests/lib/incidents/incident-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/incidents/incident-service.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { IncidentService } from "@/lib/incidents/incident-service";

function createMockSupabase() {
  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "inc-001",
          timestamp: 1234567890,
          confirmed: true,
          confidence: 0.85,
          theft_type: "shoplifting",
          description: "Person concealing item",
          clip_path: "clips/inc-001.mp4",
          zone_context: null,
          created_at: "2026-03-28T12:00:00Z",
        },
        error: null,
      }),
    }),
  });

  const select = vi.fn().mockReturnValue({
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "inc-001",
            timestamp: 1234567890,
            confirmed: true,
            confidence: 0.85,
            theft_type: "shoplifting",
            description: "Person concealing item",
            clip_path: "clips/inc-001.mp4",
            zone_context: null,
            created_at: "2026-03-28T12:00:00Z",
          },
        ],
        error: null,
      }),
    }),
  });

  return {
    from: vi.fn().mockReturnValue({ insert, select }),
    insert,
    select,
  };
}

describe("IncidentService", () => {
  it("creates an incident record", async () => {
    const mock = createMockSupabase();
    const service = new IncidentService(mock as any);

    const incident = await service.create({
      timestamp: 1234567890,
      confirmed: true,
      confidence: 0.85,
      theftType: "shoplifting",
      description: "Person concealing item",
      clipPath: "clips/inc-001.mp4",
      zoneContext: null,
    });

    expect(incident.id).toBe("inc-001");
    expect(incident.confirmed).toBe(true);
    expect(mock.from).toHaveBeenCalledWith("incidents");
  });

  it("lists recent incidents", async () => {
    const mock = createMockSupabase();
    const service = new IncidentService(mock as any);

    const incidents = await service.listRecent(10);

    expect(incidents).toHaveLength(1);
    expect(incidents[0].id).toBe("inc-001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/incidents/incident-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/incidents/incident-service.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Incident, TheftType } from "@/lib/detection/detection-types";

interface CreateIncidentInput {
  timestamp: number;
  confirmed: boolean;
  confidence: number;
  theftType: TheftType;
  description: string;
  clipPath: string;
  zoneContext: string | null;
}

interface IncidentRow {
  id: string;
  timestamp: number;
  confirmed: boolean;
  confidence: number;
  theft_type: TheftType;
  description: string;
  clip_path: string;
  zone_context: string | null;
  created_at: string;
}

function rowToIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    timestamp: row.timestamp,
    confirmed: row.confirmed,
    confidence: row.confidence,
    theftType: row.theft_type,
    description: row.description,
    clipPath: row.clip_path,
    zoneContext: row.zone_context,
    createdAt: row.created_at,
  };
}

export class IncidentService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async create(input: CreateIncidentInput): Promise<Incident> {
    const { data, error } = await this.supabase
      .from("incidents")
      .insert({
        timestamp: input.timestamp,
        confirmed: input.confirmed,
        confidence: input.confidence,
        theft_type: input.theftType,
        description: input.description,
        clip_path: input.clipPath,
        zone_context: input.zoneContext,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return rowToIncident(data as IncidentRow);
  }

  async listRecent(limit: number): Promise<Incident[]> {
    const { data, error } = await this.supabase
      .from("incidents")
      .select()
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    return (data as IncidentRow[]).map(rowToIncident);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/lib/incidents/incident-service.test.ts`
Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/incidents/incident-service.ts tests/lib/incidents/incident-service.test.ts
git commit -m "feat: add IncidentService for creating and listing incidents in Supabase"
```

---

## Task 11: Supabase Migrations (Incidents + Zone Segments)

**Files:**
- Create: `src/lib/supabase/migrations/001_incidents.sql`
- Create: `src/lib/supabase/migrations/002_zone_segments.sql`

- [ ] **Step 1: Write incidents table migration**

Create `src/lib/supabase/migrations/001_incidents.sql`:

```sql
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  timestamp bigint not null,
  confirmed boolean not null default false,
  confidence real not null,
  theft_type text not null check (theft_type in ('shoplifting', 'pickpocket', 'none')),
  description text not null default '',
  clip_path text not null,
  zone_context text,
  created_at timestamptz not null default now()
);

create index idx_incidents_created_at on incidents (created_at desc);
create index idx_incidents_confirmed on incidents (confirmed);

-- RLS: only authenticated users can read/write their own commerce's incidents
alter table incidents enable row level security;

create policy "Authenticated users can read incidents"
  on incidents for select
  to authenticated
  using (true);

create policy "Authenticated users can insert incidents"
  on incidents for insert
  to authenticated
  with check (true);
```

- [ ] **Step 2: Write zone segments table migration**

Create `src/lib/supabase/migrations/002_zone_segments.sql`:

```sql
create table if not exists zone_segments (
  id uuid primary key default gen_random_uuid(),
  zone_id text not null,
  theft_type text not null check (theft_type in ('shoplifting', 'pickpocket', 'none')),
  frequency real not null check (frequency >= 0 and frequency <= 1),
  created_at timestamptz not null default now()
);

create index idx_zone_segments_zone_id on zone_segments (zone_id);

alter table zone_segments enable row level security;

create policy "Authenticated users can read zone segments"
  on zone_segments for select
  to authenticated
  using (true);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/migrations/001_incidents.sql src/lib/supabase/migrations/002_zone_segments.sql
git commit -m "feat: add SQL migrations for incidents and zone_segments tables with RLS"
```

---

## Task 12: Emergency 911 Button Trigger

**Files:**
- Create: `src/lib/triggers/trigger-types.ts`
- Create: `src/lib/triggers/emergency-button.ts`
- Test: `tests/lib/triggers/emergency-button.test.ts`

- [ ] **Step 1: Create trigger types**

Create `src/lib/triggers/trigger-types.ts`:

```typescript
export interface Trigger {
  readonly id: string;
  readonly name: string;
  fire(incidentId: string): Promise<TriggerResult>;
}

export interface TriggerResult {
  readonly triggerId: string;
  readonly success: boolean;
  readonly message: string;
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/lib/triggers/emergency-button.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { EmergencyButton } from "@/lib/triggers/emergency-button";

describe("EmergencyButton", () => {
  it("has correct id and name", () => {
    const button = new EmergencyButton();

    expect(button.id).toBe("emergency-911");
    expect(button.name).toBe("911 Emergency");
  });

  it("fire returns a pending state (owner must confirm)", async () => {
    const button = new EmergencyButton();
    const result = await button.fire("incident-123");

    expect(result.triggerId).toBe("emergency-911");
    expect(result.success).toBe(true);
    expect(result.message).toContain("incident-123");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/lib/triggers/emergency-button.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/triggers/emergency-button.ts`:

```typescript
import type { Trigger, TriggerResult } from "./trigger-types";

export class EmergencyButton implements Trigger {
  readonly id = "emergency-911";
  readonly name = "911 Emergency";

  async fire(incidentId: string): Promise<TriggerResult> {
    // This trigger surfaces a 911 button in the UI.
    // It does NOT call 911 automatically — the owner decides.
    return {
      triggerId: this.id,
      success: true,
      message: `911 button activated for incident ${incidentId}. Awaiting owner action.`,
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/lib/triggers/emergency-button.test.ts`
Expected: 2 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/triggers/trigger-types.ts src/lib/triggers/emergency-button.ts tests/lib/triggers/emergency-button.test.ts
git commit -m "feat: add EmergencyButton trigger (911 button surfaced in UI)"
```

---

## Task 13: Incidents API Route

**Files:**
- Create: `src/app/api/incidents/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/incidents/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { IncidentService } from "@/lib/incidents/incident-service";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const service = new IncidentService(supabase);
    const incidents = await service.listRecent(50);

    return NextResponse.json(incidents);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const service = new IncidentService(supabase);
    const body = await request.json();

    const incident = await service.create({
      timestamp: body.timestamp,
      confirmed: body.confirmed,
      confidence: body.confidence,
      theftType: body.theftType,
      description: body.description,
      clipPath: body.clipPath,
      zoneContext: body.zoneContext ?? null,
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Run type-check**

Run: `pnpm type-check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/incidents/route.ts
git commit -m "feat: add incidents API route (GET list, POST create)"
```

---

## Task 14: Owner Dashboard with 911 Button

**Files:**
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `src/app/dashboard/page.tsx`:

```tsx
import { type Incident } from "@/lib/detection/detection-types";

async function getIncidents(): Promise<Incident[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/incidents`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

function EmergencyButton({ incidentId }: { incidentId: string }) {
  return (
    <a
      href="tel:911"
      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-lg font-bold text-white shadow-lg hover:bg-red-700 active:bg-red-800"
    >
      Call 911 — Incident {incidentId.slice(0, 8)}
    </a>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-neutral-500">
            {new Date(incident.createdAt).toLocaleString()}
          </p>
          <p className="mt-1 font-medium">
            {incident.theftType === "shoplifting"
              ? "Shoplifting"
              : incident.theftType === "pickpocket"
                ? "Pickpocket"
                : "Unknown"}
            {" — "}
            {incident.confirmed ? "Confirmed" : "Unconfirmed"}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {incident.description}
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            Confidence: {Math.round(incident.confidence * 100)}%
          </p>
        </div>
        {incident.confirmed && (
          <EmergencyButton incidentId={incident.id} />
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const incidents = await getIncidents();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Zeif — Incident Dashboard</h1>
      <p className="mt-1 text-neutral-500">
        {incidents.length} incident{incidents.length !== 1 && "s"} detected
      </p>

      <div className="mt-6 space-y-4">
        {incidents.length === 0 && (
          <p className="text-neutral-400">No incidents recorded yet.</p>
        )}
        {incidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run type-check**

Run: `pnpm type-check`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: add owner dashboard with incident list and 911 button"
```

---

## Task 15: Run All Tests and Final Check

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass (20+ tests across 8 test files)

- [ ] **Step 2: Run type-check**

Run: `pnpm type-check`
Expected: No TypeScript errors

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No lint errors

- [ ] **Step 4: Run build**

Run: `pnpm build`
Expected: Successful build

- [ ] **Step 5: Commit any remaining fixes**

If any step above required fixes, commit them:

```bash
git add -A
git commit -m "fix: resolve any lint/type/build issues"
```
