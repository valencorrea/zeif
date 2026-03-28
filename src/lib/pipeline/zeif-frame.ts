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

export function createZeifFrame(input: CreateFrameInput): ZeifFrame {
  return {
    id: crypto.randomUUID(),
    imageData: input.imageData,
    timestamp: input.timestamp ?? Date.now(),
    sourceId: input.sourceId,
    metadata: input.metadata,
  };
}
