"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { decryptBlob } from "@meerkat/crypto";
import { loadVaultKey } from "@/lib/vault-credentials";
import type { EncryptedBlob } from "@meerkat/crypto";

/**
 * Hook to resolve a voice note storage path to a playable object URL.
 *
 * Handles two storage formats transparently:
 *
 *   *.webm  -- legacy unencrypted audio (v1 Supabase users).
 *              Signs the storage URL and returns it directly.
 *
 *   *.enc   -- AES-GCM-256 encrypted JSON blob (vault v2 users).
 *              Signs the URL -> fetches bytes -> JSON-parses to EncryptedBlob
 *              -> decrypts with the HKDF vault key -> creates a temporary
 *              object URL from the plaintext bytes.
 *              The object URL is revoked automatically on unmount or when
 *              voicePath changes.
 *
 * @param voicePath  Storage path (e.g. "denId/userId/ts-rand.enc").
 *                   Pass null/undefined while the path is not yet known.
 *
 * @returns  { url, isDecrypting, error }
 *   url          -- Playable URL, or null while loading.
 *   isDecrypting -- True while fetching + decrypting an .enc blob.
 *   error        -- Non-null string if something went wrong.
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

      const supabase = createClient();

      // Step 1: Get a signed URL from Supabase Storage (both formats need this).
      const { data, error: signErr } = await supabase.storage
        .from("voice-notes")
        .createSignedUrl(voicePath!, 3600);

      if (signErr || !data?.signedUrl) {
        if (!cancelled) {
          setError(
            `Could not load voice note: ${signErr?.message ?? "unknown error"}`,
          );
        }
        return;
      }

      if (!isEncrypted) {
        // Legacy .webm -- use the signed URL directly, no decryption needed.
        if (!cancelled) setUrl(data.signedUrl);
        return;
      }

      // Encrypted .enc blob: fetch -> decrypt -> object URL.
      if (!cancelled) setIsDecrypting(true);

      try {
        // Step 2: Load the vault key. No vault session means we cannot decrypt.
        const vaultKey = await loadVaultKey();
        if (!vaultKey) {
          throw new Error(
            "No vault session found. Please sign in again to play this voice note.",
          );
        }

        // Step 3: Fetch the encrypted blob from the signed URL.
        const response = await fetch(data.signedUrl);
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
