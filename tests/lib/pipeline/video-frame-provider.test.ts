import { describe, it, expect, afterEach } from "vitest";
import { VideoFrameProvider } from "@/lib/pipeline/video-frame-provider";
import type { ZeifFrame } from "@/lib/pipeline/zeif-frame";
import path from "path";

const TEST_VIDEO = path.resolve(__dirname, "../../../fixtures/test-video.mp4");
const AUDIO_ONLY = path.resolve(__dirname, "../../../fixtures/audio-only.m4a");

describe("VideoFrameProvider", () => {
  let provider: VideoFrameProvider;

  afterEach(async () => {
    if (provider) {
      await provider.stop();
    }
  });

  it("has the configured sourceId", () => {
    provider = new VideoFrameProvider({
      filePath: TEST_VIDEO,
      fps: 10,
      width: 320,
      height: 240,
      sourceId: "test-cam",
      loop: false,
    });

    expect(provider.sourceId).toBe("test-cam");
  });

  it("throws on non-existent video file", () => {
    expect(
      () =>
        new VideoFrameProvider({
          filePath: "/nonexistent/video.mp4",
          fps: 10,
          width: 320,
          height: 240,
          sourceId: "test-cam",
          loop: false,
        })
    ).toThrow("Video file not found");
  });

  it("rejects audio-only files on start()", async () => {
    provider = new VideoFrameProvider({
      filePath: AUDIO_ONLY,
      fps: 10,
      width: 320,
      height: 240,
      sourceId: "test-cam",
      loop: false,
    });

    await expect(provider.start()).rejects.toThrow("No video stream");
  });

  it("delivers frames as ZeifFrame objects via onFrame", async () => {
    provider = new VideoFrameProvider({
      filePath: TEST_VIDEO,
      fps: 10,
      width: 320,
      height: 240,
      sourceId: "test-cam",
      loop: false,
    });

    const frames: ZeifFrame[] = [];
    provider.onFrame((frame) => frames.push(frame));

    await provider.start();

    // Wait for some frames to be delivered (2s video at 10fps = ~20 frames)
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await provider.stop();

    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0].sourceId).toBe("test-cam");
    expect(frames[0].imageData).toBeInstanceOf(Uint8Array);
    expect(frames[0].imageData.length).toBeGreaterThan(0);
    expect(frames[0].timestamp).toBeTypeOf("number");
  }, 10000);

  it("stops delivering frames after stop()", async () => {
    provider = new VideoFrameProvider({
      filePath: TEST_VIDEO,
      fps: 10,
      width: 320,
      height: 240,
      sourceId: "test-cam",
      loop: true,
    });

    const frames: ZeifFrame[] = [];
    provider.onFrame((frame) => frames.push(frame));

    await provider.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await provider.stop();

    const countAfterStop = frames.length;
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(frames.length).toBe(countAfterStop);
  }, 5000);

  it("assigns unique IDs to each frame", async () => {
    provider = new VideoFrameProvider({
      filePath: TEST_VIDEO,
      fps: 10,
      width: 320,
      height: 240,
      sourceId: "test-cam",
      loop: false,
    });

    const frames: ZeifFrame[] = [];
    provider.onFrame((frame) => frames.push(frame));

    await provider.start();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await provider.stop();

    const ids = frames.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  }, 5000);

  it("uses simulated live timestamps (based on now, not video time)", async () => {
    const beforeStart = Date.now();

    provider = new VideoFrameProvider({
      filePath: TEST_VIDEO,
      fps: 10,
      width: 320,
      height: 240,
      sourceId: "test-cam",
      loop: false,
    });

    const frames: ZeifFrame[] = [];
    provider.onFrame((frame) => frames.push(frame));

    await provider.start();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await provider.stop();

    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0].timestamp).toBeGreaterThanOrEqual(beforeStart);
  }, 5000);
});
