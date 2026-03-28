import { GeminiPromptTester } from "@/components/gemini-prompt-tester";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <h1 className="text-4xl font-bold">Zeif</h1>
      <p className="mt-2 max-w-lg text-center text-sm text-zinc-600 dark:text-zinc-400">
        Gemini test: set <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">GEMINI_API_KEY</code>{" "}
        in <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">.env.local</code>, then send a
        prompt below.
      </p>
      <GeminiPromptTester />
    </main>
  );
}
