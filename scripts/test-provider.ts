/**
 * Manual test: run the VideoFrameProvider with a real video
 * and print stats about the frames received.
 *
 * Usage: npx tsx scripts/test-provider.ts
 */

import path from "path";
import { VideoFrameProvider } from "../src/lib/pipeline/video-frame-provider";
import type { ZeifFrame } from "../src/lib/pipeline/zeif-frame";

const VIDEO_PATH = path.resolve(__dirname, "../fixtures/real-test-5s.mp4");

const CONFIG = {
  filePath: VIDEO_PATH,
  fps: 30,
  width: 640,
  height: 480,
  sourceId: "test-cam-real",
  loop: false,
};

async function main() {
  console.log("=== VideoFrameProvider Manual Test ===\n");
  console.log(`Video: ${VIDEO_PATH}`);
  console.log(`Config: ${JSON.stringify(CONFIG, null, 2)}\n`);

  const provider = new VideoFrameProvider(CONFIG);

  const frames: ZeifFrame[] = [];
  let firstFrameAt: number | null = null;
  let lastFrameAt: number | null = null;

  const unsubscribe = provider.onFrame((frame) => {
    const now = Date.now();
    if (!firstFrameAt) firstFrameAt = now;
    lastFrameAt = now;
    frames.push(frame);

    // Print progress every 30 frames (once per second)
    if (frames.length % 30 === 0) {
      const elapsed = ((now - firstFrameAt) / 1000).toFixed(1);
      const avgSize = Math.round(
        frames.reduce((sum, f) => sum + f.imageData.length, 0) / frames.length
      );
      console.log(
        `  [${elapsed}s] ${frames.length} frames received | ` +
          `avg size: ${(avgSize / 1024).toFixed(1)}KB | ` +
          `sourceId: ${frame.sourceId}`
      );
    }
  });

  console.log("Starting provider...\n");
  const startTime = Date.now();
  await provider.start();

  // Wait for video to finish (5s video + margin)
  await new Promise((resolve) => setTimeout(resolve, 7000));

  await provider.stop();
  unsubscribe();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n=== Results ===\n");
  console.log(`Total frames received: ${frames.length}`);
  console.log(`Expected (5s × 30fps): ~150`);
  console.log(`Total time: ${totalTime}s`);

  if (frames.length > 0 && firstFrameAt && lastFrameAt) {
    const deliveryTime = (lastFrameAt - firstFrameAt) / 1000;
    const actualFps = frames.length / deliveryTime;
    const avgSize =
      frames.reduce((sum, f) => sum + f.imageData.length, 0) / frames.length;
    const totalSize = frames.reduce((sum, f) => sum + f.imageData.length, 0);

    console.log(`Delivery duration: ${deliveryTime.toFixed(2)}s`);
    console.log(`Actual FPS: ${actualFps.toFixed(1)}`);
    console.log(`Avg frame size: ${(avgSize / 1024).toFixed(1)}KB`);
    console.log(`Total data: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

    // Check frame quality
    console.log(`\nFirst frame:`);
    console.log(`  id: ${frames[0].id}`);
    console.log(`  sourceId: ${frames[0].sourceId}`);
    console.log(`  timestamp: ${frames[0].timestamp} (${new Date(frames[0].timestamp).toISOString()})`);
    console.log(`  imageData: ${frames[0].imageData.length} bytes`);
    console.log(`  starts with FF D8: ${frames[0].imageData[0] === 0xff && frames[0].imageData[1] === 0xd8}`);

    console.log(`\nLast frame:`);
    const last = frames[frames.length - 1];
    console.log(`  id: ${last.id}`);
    console.log(`  timestamp: ${last.timestamp} (${new Date(last.timestamp).toISOString()})`);
    console.log(`  imageData: ${last.imageData.length} bytes`);

    // Verify unique IDs
    const uniqueIds = new Set(frames.map((f) => f.id));
    console.log(`\nUnique IDs: ${uniqueIds.size}/${frames.length} (${uniqueIds.size === frames.length ? "✓ all unique" : "✗ DUPLICATES!"})`);

    // Verify timestamps are increasing
    let timestampsOk = true;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i].timestamp < frames[i - 1].timestamp) {
        timestampsOk = false;
        break;
      }
    }
    console.log(`Timestamps increasing: ${timestampsOk ? "✓ yes" : "✗ NO"}`);

    // FPS tolerance check (±10% per spec SC-002)
    const fpsTarget = CONFIG.fps;
    const fpsTolerance = fpsTarget * 0.1;
    const fpsOk =
      actualFps >= fpsTarget - fpsTolerance &&
      actualFps <= fpsTarget + fpsTolerance;
    console.log(
      `FPS within ±10% of ${fpsTarget}: ${fpsOk ? "✓" : "✗"} (actual: ${actualFps.toFixed(1)}, range: ${(fpsTarget - fpsTolerance).toFixed(0)}-${(fpsTarget + fpsTolerance).toFixed(0)})`
    );
  }

  console.log("\n=== Test Complete ===");
}

main().catch(console.error);
