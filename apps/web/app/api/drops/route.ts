import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// All endpoints use the admin client (bypasses RLS) so vault users with no
// Supabase session can still read/write drops in the blobs bucket.
//
// POST /api/drops
//   Multipart: path (string), data (Blob)
//   Uploads an encrypted drop. Path must match drops/{denId}/{visitorId}-{dropId}.enc
//
// GET /api/drops?list=drops/{denId}/
//   Lists .enc filenames for a den prefix.
//
// GET /api/drops?path=drops/{denId}/{file}.enc
//   Downloads raw bytes for a single drop.
//
// DELETE /api/drops?path=drops/{denId}/{file}.enc
//   Deletes a drop after the host has imported it.

const DROP_PATH_RE = /^drops\/[0-9a-f-]{36}\/[^/]+-[^/]+\.enc$/;
const DROP_PREFIX_RE = /^drops\/[0-9a-f-]{36}\/$/;

export async function POST(req: NextRequest) {
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
    data = await blob.arrayBuffer();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!DROP_PATH_RE.test(path)) {
    return NextResponse.json(
      { error: "Invalid drop path format" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from("blobs")
    .upload(path, new Uint8Array(data), {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const listPrefix = searchParams.get("list");
  const filePath = searchParams.get("path");

  const supabase = createAdminClient();

  if (listPrefix) {
    if (!DROP_PREFIX_RE.test(listPrefix)) {
      return NextResponse.json(
        { error: "Invalid prefix format" },
        { status: 400 },
      );
    }
    const folder = listPrefix.replace(/\/$/, "");
    const { data, error } = await supabase.storage.from("blobs").list(folder);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const paths = (data ?? [])
      .filter((f) => f.name.endsWith(".enc"))
      .map((f) => `${folder}/${f.name}`);

    return NextResponse.json({ paths });
  }

  if (filePath) {
    if (!DROP_PATH_RE.test(filePath)) {
      return NextResponse.json(
        { error: "Invalid drop path format" },
        { status: 400 },
      );
    }
    const { data, error } = await supabase.storage
      .from("blobs")
      .download(filePath);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Not found" },
        { status: 404 },
      );
    }

    const bytes = await data.arrayBuffer();
    return new NextResponse(bytes, {
      headers: { "Content-Type": "application/octet-stream" },
    });
  }

  return NextResponse.json(
    { error: "Provide list= or path= query param" },
    { status: 400 },
  );
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");

  if (!filePath || !DROP_PATH_RE.test(filePath)) {
    return NextResponse.json(
      { error: "Invalid drop path format" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("blobs").remove([filePath]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
