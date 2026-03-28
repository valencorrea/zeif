export interface FrameProviderConfig {
  readonly filePath: string;
  readonly fps: number;
  readonly width: number;
  readonly height: number;
  readonly sourceId: string;
  readonly loop: boolean;
}

export const DEFAULT_CONFIG: Omit<FrameProviderConfig, "filePath"> = {
  fps: 30,
  width: 640,
  height: 480,
  sourceId: "dev-camera-001",
  loop: true,
};
