/**
 * Drop upload via the /api/drops route.
 *
 * Routes through the admin-backed API endpoint so vault users (no Supabase
 * session) can still upload encrypted drops to Storage.
 *
 * Frame format (4-byte big-endian length prefix):
 *   [metaLen: u32][metaBytes: JSON][cipherBytes]
 */
export async function uploadDropViaApi(
  path: string,
  data: Uint8Array,
  metadata: { iv: string; visitorId: string; droppedAt: string },
): Promise<void> {
  const metaBytes = new TextEncoder().encode(JSON.stringify(metadata));
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, metaBytes.length, false);
  const combined = new Uint8Array(4 + metaBytes.length + data.length);
  combined.set(header, 0);
  combined.set(metaBytes, 4);
  combined.set(data, 4 + metaBytes.length);

  const form = new FormData();
  form.append("path", path);
  form.append(
    "data",
    new Blob([combined], { type: "application/octet-stream" }),
  );
  const res = await fetch("/api/drops", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      error: "Upload failed",
    }))) as { error: string };
    throw new Error(body.error);
  }
}
