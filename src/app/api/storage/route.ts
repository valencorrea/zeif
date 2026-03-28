import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "people";
const PAGE_SIZE = 10;

export interface StorageFile {
  name: string;
  url: string;
  type: "image" | "video" | "other";
}

function resolveType(mimetype: string | undefined): StorageFile["type"] {
  if (!mimetype) return "other";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  return "other";
}

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: PAGE_SIZE });

  if (error) {
    console.error("[api/storage]", error);
    return NextResponse.json(
      { error: "Failed to list storage files.", detail: error.message },
      { status: 502 },
    );
  }

  const files: StorageFile[] = (data ?? []).map((file) => {
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(file.name);

    return {
      name: file.name,
      url: urlData.publicUrl,
      type: resolveType(file.metadata?.mimetype),
    };
  });

  return NextResponse.json({ files });
}
