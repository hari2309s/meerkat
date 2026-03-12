"use client";

import { useEffect, useState } from "react";
import { decryptBlob } from "@meerkat/crypto";
import { loadVaultKey } from "@/lib/vault-credentials";
import type { EncryptedBlob } from "@meerkat/crypto";

/**
 * Hook to resolve a voice note storage path to a playable object URL.
 *
 * All fetching goes through the /api/audio proxy, which creates the signed
 * Supabase URL server-side and returns bytes with CORP: cross-origin. This is
 * required because the app sets COEP: credentialless (for SharedArrayBuffer /
 * ONNX WASM), and Supabase Storage returns CORP: same-origin, which COEP
 * would otherwise block.
 *
 * Handles two storage formats transparently:
 *
 *   *.webm  -- legacy unencrypted audio.
 *              Returns the proxy URL directly for the <audio> element.
 *
 *   *.enc   -- AES-GCM-256 encrypted JSON blob.
 *              Fetches bytes via proxy -> JSON-parses to EncryptedBlob
 *              -> decrypts with the HKDF vault key -> creates a temporary
 *              object URL from the plaintext bytes.
 *              The object URL is revoked automatically on unmount.
 *
 * @param voicePath  Storage path (e.g. "denId/userId/ts-rand.enc").
 *                   Pass null/undefined while the path is not yet known.
 *
 * @returns  { url, isDecrypting, error }
 */
export function useVoiceUrl(voicePath: string | null | undefined): {
  url: string | null;
  isDecrypting: boolean;
  error: string | null;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!voicePath) {
      setUrl(null);
      setIsDecrypting(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const isEncrypted = voicePath.endsWith(".enc");

    async function resolve() {
      setError(null);

      if (!isEncrypted) {
        // Legacy .webm -- serve via the audio proxy so CORP: cross-origin is
        // set and the <audio> element loads under COEP: credentialless.
        if (!cancelled)
          setUrl(`/api/audio?path=${encodeURIComponent(voicePath!)}`);
        return;
      }

      // Encrypted .enc blob: fetch via proxy -> decrypt -> object URL.
      if (!cancelled) setIsDecrypting(true);

      try {
        // Step 2: Load the vault key. No vault session means we cannot decrypt.
        const vaultKey = await loadVaultKey();
        if (!vaultKey) {
          throw new Error(
            "No vault session found. Please sign in again to play this voice note.",
          );
        }

        // Step 3: Fetch the encrypted blob via the /api/audio proxy.
        //
        // Direct fetch from Supabase Storage is blocked under COEP:
        // credentialless because Supabase returns CORP: same-origin.
        // The proxy fetches server-side (no COEP) and returns the bytes with
        // CORP: cross-origin so the browser accepts the response.
        const response = await fetch(
          `/api/audio?path=${encodeURIComponent(voicePath!)}`,
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch encrypted blob: HTTP ${response.status}`,
          );
        }

        // Step 4: Parse JSON to EncryptedBlob { alg, iv, data }.
        const encryptedBlob: EncryptedBlob = await response.json();

        // Step 5: Decrypt with the HKDF-derived vault key.
        const plaintextBytes = await decryptBlob(encryptedBlob, vaultKey);

        // Step 6: Wrap in a Blob and create a temporary object URL.
        //
        // Why `new Uint8Array(plaintextBytes)` instead of using plaintextBytes
        // directly?
        //
        // decryptBlob returns Uint8Array<ArrayBufferLike>. The Blob constructor
        // accepts BlobPart[], where BlobPart includes ArrayBuffer but NOT the
        // broader ArrayBufferLike union (which also includes SharedArrayBuffer).
        // TypeScript therefore rejects plaintextBytes and also rejects
        // plaintextBytes.buffer.slice(...) because .slice() on ArrayBufferLike
        // returns ArrayBuffer | SharedArrayBuffer, still not narrow enough.
        //
        // Passing plaintextBytes into `new Uint8Array(...)` invokes the
        // typed-array copy constructor. The copy constructor always allocates a
        // fresh, plain ArrayBuffer -- narrowing the type to
        // Uint8Array<ArrayBuffer>, which Blob accepts without complaint.
        const safeBytes = new Uint8Array(plaintextBytes);
        const audioBlob = new Blob([safeBytes], { type: "audio/webm" });
        objectUrl = URL.createObjectURL(audioBlob);

        if (!cancelled) {
          setUrl(objectUrl);
          setIsDecrypting(false);
        } else {
          // Component unmounted while decrypting -- clean up immediately.
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setIsDecrypting(false);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to decrypt voice note.",
          );
        }
      }
    }

    resolve();

    return () => {
      cancelled = true;
      // Revoke the object URL on unmount or when voicePath changes.
      // Object URLs hold the decrypted blob in memory until revoked.
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [voicePath]);

  return { url, isDecrypting, error };
}
