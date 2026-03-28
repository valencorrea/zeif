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
