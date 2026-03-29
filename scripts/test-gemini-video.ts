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
