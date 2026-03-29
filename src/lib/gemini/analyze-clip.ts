import { GoogleGenerativeAI, SchemaType, type ObjectSchema } from "@google/generative-ai";

import { createClient } from "@/lib/supabase/server";
import { GeminiConfigError } from "./client";
import { uploadVideoBuffer, waitForFileActive, deleteFile } from "./file-manager";
import type { AnalysisResult } from "./types";
import { IncidentNotFoundError } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";

const ANALYSIS_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
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

function parseAnalysisResult(raw: unknown): AnalysisResult {
  if (
    typeof raw !== "object" ||
    raw === null ||
    typeof (raw as Record<string, unknown>).shoplifting !== "boolean" ||
    typeof (raw as Record<string, unknown>).confidence !== "number" ||
    typeof (raw as Record<string, unknown>).reasoning !== "string"
  ) {
    throw new Error(
      `Gemini returned an unexpected response shape: ${JSON.stringify(raw)}`,
    );
  }

  const { shoplifting, confidence, reasoning } = raw as AnalysisResult;
  return { shoplifting, confidence, reasoning };
}

export async function analyzeClip(incidentId: string): Promise<AnalysisResult> {
  const supabase = await createClient();

  const { data: incident, error: fetchError } = await supabase
    .from("incidents")
    .select("clip_path")
    .eq("id", incidentId)
    .single();

  if (fetchError || !incident) {
    throw new IncidentNotFoundError(incidentId);
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from("clips")
    .download(incident.clip_path);

  if (downloadError || !blob) {
    throw new Error(
      `Failed to download clip for incident "${incidentId}": ${downloadError?.message}`,
    );
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.",
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

  let fileName: string | null = null;

  try {
    const uploaded = await uploadVideoBuffer(buffer, incidentId);
    fileName = uploaded.fileName;

    await waitForFileActive(fileName);

    const result = await model.generateContent([
      { fileData: { mimeType: "video/mp4", fileUri: uploaded.fileUri } },
      ANALYSIS_PROMPT,
    ]);

    const analysisResult = parseAnalysisResult(
      JSON.parse(result.response.text()),
    );

    await supabase
      .from("incidents")
      .update({
        confirmed: analysisResult.shoplifting,
        confidence: analysisResult.confidence,
        reasoning: analysisResult.reasoning,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", incidentId);

    return analysisResult;
  } finally {
    if (fileName) {
      await deleteFile(fileName);
    }
  }
}
