import { NextResponse } from "next/server";

import { GeminiConfigError, generateGeminiText } from "@/lib/gemini/client";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const prompt =
    typeof body === "object" &&
    body !== null &&
    "prompt" in body &&
    typeof (body as { prompt: unknown }).prompt === "string"
      ? (body as { prompt: string }).prompt.trim()
      : "";

  if (!prompt) {
    return NextResponse.json(
      { error: "Missing or empty \"prompt\" string in JSON body." },
      { status: 400 },
    );
  }

  try {
    const text = await generateGeminiText(prompt);
    return NextResponse.json({ text });
  } catch (err) {
    if (err instanceof GeminiConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/gemini]", err);
    return NextResponse.json(
      { error: "Gemini request failed.", detail: message },
      { status: 502 },
    );
  }
}
