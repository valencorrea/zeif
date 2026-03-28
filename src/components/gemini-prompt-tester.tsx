"use client";

import { useState } from "react";

export function GeminiPromptTester() {
  const [prompt, setPrompt] = useState(
    "Respond in one short sentence: what is 2+2?",
  );
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReply(null);
    setLoading(true);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `HTTP ${res.status}`;
        const detail =
          typeof data === "object" &&
          data !== null &&
          "detail" in data &&
          typeof (data as { detail: unknown }).detail === "string"
            ? ` — ${(data as { detail: string }).detail}`
            : "";
        throw new Error(msg + detail);
      }
      if (
        typeof data === "object" &&
        data !== null &&
        "text" in data &&
        typeof (data as { text: unknown }).text === "string"
      ) {
        setReply((data as { text: string }).text);
      } else {
        setError("Unexpected response shape.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 w-full max-w-lg space-y-4 text-left"
    >
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Prompt
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>
      <button
        type="submit"
        disabled={loading || !prompt.trim()}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Sending…" : "Send to Gemini"}
      </button>
      {reply !== null && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <p className="font-medium text-zinc-600 dark:text-zinc-400">
            Response
          </p>
          <p className="mt-1 whitespace-pre-wrap">{reply}</p>
        </div>
      )}
      {error !== null && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
