import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

import { GeminiConfigError } from "@/lib/gemini/client";

const DEFAULT_MODEL = "gemini-2.5-flash";

const ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT as const,
  properties: {
    shoplifting: { type: SchemaType.BOOLEAN as const },
    confidence: { type: SchemaType.NUMBER as const },
    reasoning: { type: SchemaType.STRING as const },
  },
  required: ["shoplifting", "confidence", "reasoning"] as string[],
};

const ANALYSIS_PROMPT =
  "You are a security analyst reviewing CCTV footage from a retail store. " +
  "Analyse this video clip and determine if it shows theft or robbery. " +
  "Look specifically for: someone taking an object from another person without consent, " +
  "someone grabbing items and concealing them, snatching, or any forceful taking of property. " +
  "Focus on the ACTIONS between people, not just what they are holding. " +
  "Respond with a JSON object following the provided schema. " +
  "`shoplifting` should be true ONLY if you see an actual act of taking/stealing. " +
  "`confidence` is the ROBBERY LIKELIHOOD score: 0.0 means definitely no robbery, " +
  "1.0 means definitely a robbery. If shoplifting is true, confidence should be high (>0.5). " +
  "If shoplifting is false, confidence should be low (<0.5). " +
  "`reasoning` must be one concise sentence describing what you observed.";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "video/webm";
  const mimeType = contentType.split(";")[0].trim();
  const buffer = Buffer.from(await request.arrayBuffer());

  if (buffer.length === 0) {
    return NextResponse.json(
      { error: "No video data received." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: new GeminiConfigError("GEMINI_API_KEY is not set.").message },
      { status: 400 },
    );
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
      },
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: buffer.toString("base64"),
        },
      },
      ANALYSIS_PROMPT,
    ]);

    const raw = JSON.parse(result.response.text());

    if (
      typeof raw.shoplifting !== "boolean" ||
      typeof raw.confidence !== "number" ||
      typeof raw.reasoning !== "string"
    ) {
      throw new Error(`Unexpected response shape: ${JSON.stringify(raw)}`);
    }

    return NextResponse.json({
      shoplifting: raw.shoplifting,
      confidence: raw.confidence,
      reasoning: raw.reasoning,
    });
  } catch (err) {
    if (err instanceof GeminiConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/analyze-video]", err);
    return NextResponse.json(
      { error: "Analysis failed.", detail: message },
      { status: 502 },
    );
  }
}
