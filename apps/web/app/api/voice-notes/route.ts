import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// 30 uploads per minute per IP.
const uploadLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

// Max upload size: 50 MB — matches Supabase Storage object limit and is
// generous for voice memos (a 10-minute WebM at 128 kbps ≈ 10 MB).
const MAX_BYTES = 50 * 1024 * 1024;

// All uploads use the admin client (bypasses RLS) so vault users with no
// Supabase session can write to the voice-notes bucket.
//
// POST /api/voice-notes
//   Multipart: path (string), data (Blob)
//   Uploads an encrypted voice memo blob. Path must be a valid storage path
//   that does not start with "/" or contain ".." path traversal sequences.

export async function POST(req: NextRequest) {
  if (!uploadLimiter.check(getClientIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let path: string;
  let data: ArrayBuffer;

  try {
    const form = await req.formData();
    path = (form.get("path") as string | null) ?? "";
    const blob = form.get("data") as Blob | null;

    if (!path || !blob) {
      return NextResponse.json(
        { error: "path and data are required" },
        { status: 400 },
      );
    }
    if (blob.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Payload exceeds ${MAX_BYTES} byte limit` },
        { status: 413 },
      );
    }
    data = await blob.arrayBuffer();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  // Prevent path traversal. No further structure enforcement — the client
  // already controls the path format and the bucket is not public.
  if (path.startsWith("/") || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from("voice-notes")
    .upload(path, new Uint8Array(data), {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
