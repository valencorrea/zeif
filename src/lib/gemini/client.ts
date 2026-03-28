import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.0-flash";

function requireApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key?.trim()) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }
  return key;
}

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

/**
 * Server-only: streams or generates text from Gemini. Do not import from Client Components.
 */
export async function generateGeminiText(prompt: string): Promise<string> {
  const apiKey = requireApiKey();
  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  if (!text?.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}
