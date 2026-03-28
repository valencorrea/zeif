import "server-only";

import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

import { GeminiConfigError } from "./client";

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 30;

export interface UploadedFile {
  fileUri: string;
  fileName: string;
}

function getFileManager(): GoogleAIFileManager {
  const key = process.env.GEMINI_API_KEY;
  if (!key?.trim()) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }
  return new GoogleAIFileManager(key);
}

export async function uploadVideoBuffer(
  buffer: Buffer,
  displayName: string,
): Promise<UploadedFile> {
  const fileManager = getFileManager();
  const response = await fileManager.uploadFile(buffer, {
    mimeType: "video/mp4",
    displayName,
  });
  return {
    fileUri: response.file.uri,
    fileName: response.file.name,
  };
}

export async function waitForFileActive(fileName: string): Promise<void> {
  const fileManager = getFileManager();

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const file = await fileManager.getFile(fileName);

    if (file.state === FileState.ACTIVE) return;

    if (file.state !== FileState.PROCESSING) {
      throw new Error(
        `Gemini file "${fileName}" entered unexpected state: ${file.state}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Gemini file "${fileName}" did not become active after ${POLL_MAX_ATTEMPTS * (POLL_INTERVAL_MS / 1000)}s`,
  );
}

export async function deleteFile(fileName: string): Promise<void> {
  try {
    const fileManager = getFileManager();
    await fileManager.deleteFile(fileName);
  } catch (err) {
    console.error(`[gemini/file-manager] Failed to delete file "${fileName}":`, err);
  }
}
