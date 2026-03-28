import { NextResponse } from "next/server";

import { GeminiConfigError } from "@/lib/gemini/client";
import { analyzeClip } from "@/lib/gemini/analyze-clip";
import { IncidentNotFoundError } from "@/lib/gemini/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing incident id." }, { status: 400 });
  }

  try {
    const result = await analyzeClip(id);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof IncidentNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof GeminiConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/incidents/analyze]", err);
    return NextResponse.json(
      { error: "Analysis failed.", detail: message },
      { status: 502 },
    );
  }
}
