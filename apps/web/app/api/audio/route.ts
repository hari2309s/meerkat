/**
 * /api/audio — Supabase Storage proxy for voice note blobs.
 *
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The app sets Cross-Origin-Embedder-Policy: credentialless to enable
 * SharedArrayBuffer for onnxruntime-web (Whisper WASM). Under COEP, cross-
 * origin CORS-mode fetches require the response to carry
 * Cross-Origin-Resource-Policy: cross-origin (or cross-site). Supabase
 * Storage returns CORP: same-origin, which causes the browser to block the
 * response with "Cross-Origin-Resource-Policy prevented from serving the
 * response".
 *
 * Server-side fetches are not subject to COEP. This route:
 *   1. Creates a short-lived signed URL server-side (authenticated via the
 *      user's session cookie, so only the file's owner can access it).
 *   2. Fetches the bytes from Supabase Storage server-side.
 *   3. Streams them back to the browser with CORP: cross-origin, satisfying
 *      the COEP check.
 *
 * PRIVACY
 * ─────────────────────────────────────────────────────────────────────────────
 * Voice note blobs are AES-GCM-256 encrypted on-device before upload. This
 * server only ever sees the encrypted ciphertext — it cannot read or store the
 * audio content.
 *
 * USAGE
 *   GET /api/audio?path=<storage-path>
 *   path: the Supabase Storage object path, e.g. "denId/userId/ts-rand.enc"
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Signed URL TTL in seconds — short because the proxy streams immediately. */
const SIGNED_URL_TTL = 60;

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");

  if (!path || path.trim() === "") {
    return new Response("Missing required query parameter: path", {
      status: 400,
    });
  }

  // Only allow voice-notes bucket paths to limit blast radius.
  // Paths must not start with / or contain .. traversal sequences.
  if (path.startsWith("/") || path.includes("..")) {
    return new Response("Invalid path", { status: 400 });
  }

  const supabase = createClient();

  // Generate a short-lived signed URL authenticated to the requesting user.
  const { data, error: signErr } = await supabase.storage
    .from("voice-notes")
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (signErr || !data?.signedUrl) {
    return new Response(
      `Failed to create signed URL: ${signErr?.message ?? "unknown error"}`,
      { status: 500 },
    );
  }

  // Fetch from Supabase Storage server-side (no COEP restrictions).
  let storageResponse: Response;
  try {
    storageResponse = await fetch(data.signedUrl);
  } catch (err) {
    return new Response(
      `Failed to fetch from storage: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502 },
    );
  }

  if (!storageResponse.ok) {
    return new Response(
      `Storage fetch failed: HTTP ${storageResponse.status}`,
      { status: storageResponse.status },
    );
  }

  const contentType =
    storageResponse.headers.get("Content-Type") ?? "application/octet-stream";

  // Stream the response body back to the browser.
  // Adding CORP: cross-origin satisfies the COEP check on the client side.
  return new Response(storageResponse.body, {
    headers: {
      "Content-Type": contentType,
      // Required for the browser to accept the response under COEP.
      "Cross-Origin-Resource-Policy": "cross-origin",
      // Short cache — signed URLs are single-use and short-lived.
      "Cache-Control": "private, max-age=60, no-store",
    },
  });
}
