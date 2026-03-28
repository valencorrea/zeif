import { spawn, execFile, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
import { createZeifFrame } from "./zeif-frame";
import type { IZeifFrameProvider, FrameHandler } from "./frame-provider";
import type { FrameProviderConfig } from "./video-frame-provider.config";

const JPEG_START = Buffer.from([0xff, 0xd8]);
const JPEG_END = Buffer.from([0xff, 0xd9]);

export class VideoFrameProvider implements IZeifFrameProvider {
  readonly sourceId: string;
  private config: FrameProviderConfig;
  private handlers: FrameHandler[] = [];
  private process: ChildProcess | null = null;
  private running = false;
  private processExited = false;
  private frameCount = 0;
  private fpsCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: FrameProviderConfig) {
    if (!existsSync(config.filePath)) {
      throw new Error(`Video file not found: ${config.filePath}`);
    }
    this.config = config;
    this.sourceId = config.sourceId;
  }

  onFrame(handler: FrameHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    await this.validateVideoStream();
    this.running = true;
    this.frameCount = 0;
    this.startFpsMonitor();
    this.startExtraction();
  }

  private async validateVideoStream(): Promise<void> {
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_streams",
        "-select_streams",
        "v",
        this.config.filePath,
      ]);

      const probe = JSON.parse(stdout);
      if (!probe.streams || probe.streams.length === 0) {
        throw new Error(
          `No video stream found in file: ${this.config.filePath}`
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("No video stream")) {
        throw err;
      }
      throw new Error(
        `Failed to probe video file: ${this.config.filePath} — is ffprobe installed?`
      );
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.fpsCheckInterval) {
      clearInterval(this.fpsCheckInterval);
      this.fpsCheckInterval = null;
    }
    const proc = this.process;
    this.process = null;
    if (proc && !this.processExited) {
      return new Promise<void>((resolve) => {
        proc.on("close", () => resolve());
        proc.kill("SIGTERM");
      });
    }
  }

  private startFpsMonitor(): void {
    const checkIntervalMs = 2000;
    const tolerance = 0.1; // 10% tolerance per spec SC-002

    this.fpsCheckInterval = setInterval(() => {
      if (!this.running) return;

      const actualFps = this.frameCount / (checkIntervalMs / 1000);
      const minAcceptableFps = this.config.fps * (1 - tolerance);

      if (actualFps < minAcceptableFps && this.frameCount > 0) {
        console.warn(
          `[VideoFrameProvider:${this.sourceId}] FPS below target: ${actualFps.toFixed(1)} actual vs ${this.config.fps} configured`
        );
      }

      this.frameCount = 0;
    }, checkIntervalMs);
  }

  private startExtraction(): void {
    if (!this.running) return;
    this.processExited = false;

    let buffer = Buffer.alloc(0);

    const args = [
      "-i",
      this.config.filePath,
      "-vf",
      `scale=${this.config.width}:${this.config.height}`,
      "-r",
      String(this.config.fps),
      "-f",
      "mjpeg",
      "-q:v",
      "5",
      "pipe:1",
    ];

    this.process = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "ignore"],
    });

    this.process.stdout!.on("data", (chunk: Buffer) => {
      if (!this.running) return;

      buffer = Buffer.concat([buffer, chunk]);

      let startIdx = 0;
      while (true) {
        const jpegStart = buffer.indexOf(JPEG_START, startIdx);
        if (jpegStart === -1) break;

        const jpegEnd = buffer.indexOf(JPEG_END, jpegStart + 2);
        if (jpegEnd === -1) break;

        const frameData = buffer.subarray(jpegStart, jpegEnd + 2);

        const frame = createZeifFrame({
          imageData: new Uint8Array(frameData),
          sourceId: this.sourceId,
          timestamp: Date.now(),
        });

        this.frameCount++;
        for (const handler of this.handlers) {
          handler(frame);
        }

        startIdx = jpegEnd + 2;
      }

      if (startIdx > 0) {
        buffer = buffer.subarray(startIdx);
      }
    });

    this.process.on("close", () => {
      this.processExited = true;
      if (this.config.loop && this.running) {
        this.processExited = false;
        this.startExtraction();
      }
    });

    this.process.on("error", (err) => {
      if (!this.running) return;
      console.warn(
        `[VideoFrameProvider:${this.sourceId}] FFmpeg error: ${err.message}`
      );
    });
  }
}
