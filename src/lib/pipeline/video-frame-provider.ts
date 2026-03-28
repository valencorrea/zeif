import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
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

  constructor(config: FrameProviderConfig) {
    if (!existsSync(config.filePath)) {
      throw new Error(`Video file not found: ${config.filePath}`);
    }
    this.config = config;
    this.sourceId = config.sourceId;
  }

  onFrame(handler: FrameHandler): void {
    this.handlers.push(handler);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.startExtraction();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  private startExtraction(): void {
    if (!this.running) return;

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
      if (this.config.loop && this.running) {
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
