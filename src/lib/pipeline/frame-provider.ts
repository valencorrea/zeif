import type { ZeifFrame } from "./zeif-frame";

export type FrameHandler = (frame: ZeifFrame) => void;

export interface IZeifFrameProvider {
  readonly sourceId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onFrame(handler: FrameHandler): () => void;
}
