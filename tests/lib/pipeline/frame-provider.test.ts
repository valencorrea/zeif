import { describe, it, expect, vi } from "vitest";
import type {
  IZeifFrameProvider,
  FrameHandler,
} from "@/lib/pipeline/frame-provider";
import { createZeifFrame } from "@/lib/pipeline/zeif-frame";

describe("IZeifFrameProvider contract", () => {
  it("can be implemented with start, stop, and onFrame", () => {
    const mockProvider: IZeifFrameProvider = {
      sourceId: "test-camera",
      async start() {},
      async stop() {},
      onFrame(_handler: FrameHandler) {},
    };

    expect(mockProvider.sourceId).toBe("test-camera");
    expect(mockProvider.start).toBeTypeOf("function");
    expect(mockProvider.stop).toBeTypeOf("function");
    expect(mockProvider.onFrame).toBeTypeOf("function");
  });

  it("onFrame handler receives ZeifFrame objects", () => {
    const handler = vi.fn();
    const frame = createZeifFrame({
      imageData: new Uint8Array([1, 2, 3]),
      sourceId: "test-camera",
    });

    handler(frame);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "test-camera",
        imageData: expect.any(Uint8Array),
      })
    );
  });
});
