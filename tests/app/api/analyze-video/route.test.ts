import { describe, it, expect, vi, beforeEach } from "vitest";

import { POST } from "@/app/api/analyze-video/route";

function makeRequest(body: BodyInit | null, contentType = "video/webm") {
  return new Request("http://localhost:3000/api/analyze-video", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
}

const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  }
  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
    SchemaType: { OBJECT: "OBJECT", BOOLEAN: "BOOLEAN", NUMBER: "NUMBER", STRING: "STRING" },
  };
});

describe("POST /api/analyze-video", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });

  it("returns 400 when body is empty", async () => {
    const response = await POST(makeRequest(new Uint8Array([])));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("No video data received.");
  });

  it("returns 400 when GEMINI_API_KEY is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const response = await POST(makeRequest(new Uint8Array([1, 2, 3])));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("GEMINI_API_KEY");
  });

  it("returns 200 with AnalysisResult on success", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            shoplifting: false,
            confidence: 0.12,
            reasoning: "Normal activity.",
          }),
      },
    });

    const response = await POST(makeRequest(new Uint8Array([1, 2, 3])));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      shoplifting: false,
      confidence: 0.12,
      reasoning: "Normal activity.",
    });
  });

  it("returns 502 when Gemini fails", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Gemini timeout"));

    const response = await POST(makeRequest(new Uint8Array([1, 2, 3])));
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.error).toBe("Analysis failed.");
    expect(json.detail).toBe("Gemini timeout");
  });
});
