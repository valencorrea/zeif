import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { uploadVideoBuffer, waitForFileActive, deleteFile } from "./file-manager";
import { GeminiConfigError } from "./client";
import type { AnalysisResult } from "./types";

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
  "You are a security analyst reviewing CCTV footage. " +
  "Analyse this video clip and determine if it shows shoplifting behaviour. " +
  "Respond with a JSON object following the provided schema. " +
  "`confidence` must be a float between 0 and 1. " +
  "`reasoning` must be one concise sentence in English.";

export async function analyzeVideo(
  videoBuffer: Buffer,
  displayName: string
): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server."
    );
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA,
    },
  });

  const uploaded = await uploadVideoBuffer(videoBuffer, displayName);

  try {
    await waitForFileActive(uploaded.fileName);

    const result = await model.generateContent([
      { fileData: { mimeType: "video/mp4", fileUri: uploaded.fileUri } },
      ANALYSIS_PROMPT,
    ]);

    const raw = JSON.parse(result.response.text());

    if (
      typeof raw.shoplifting !== "boolean" ||
      typeof raw.confidence !== "number" ||
      typeof raw.reasoning !== "string"
    ) {
      throw new Error(
        `Unexpected response shape: ${JSON.stringify(raw)}`
      );
    }

    return {
      shoplifting: raw.shoplifting,
      confidence: raw.confidence,
      reasoning: raw.reasoning,
    };
  } finally {
    await deleteFile(uploaded.fileName);
  }
}
