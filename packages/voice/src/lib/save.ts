// ─── save.ts ─────────────────────────────────────────────────────────────────
//
// saveVoiceNote: the heart of @meerkat/voice.
//
// Lifecycle: record → analyse on-device → encrypt → upload → store in Yjs
//
// Called by:
//   • useVoiceRecorder().save()  — from UI components
//   • Directly in server/background contexts (optional)
//
// Nothing leaves the device unencrypted. The raw audio blob is only
// ever seen by the on-device analyser and the encryptBlob() call —
// neither sends it anywhere.

import { analyzeVoice } from "@meerkat/analyzer";
import { encryptBlob } from "@meerkat/crypto";
import { addVoiceMemo } from "@meerkat/local-store";
import type { SavedVoiceNote, SaveVoiceNoteOptions } from "../types.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Convert a Blob to a Uint8Array. Works in browser and in tests.
 */
async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * The full voice note save pipeline.
 *
 * Steps:
 *   1. Run on-device analysis (transcribe + classify emotion).
 *   2. Convert the raw blob to bytes.
 *   3. Encrypt the bytes with the den's namespace key.
 *   4. Upload the encrypted bytes via the provided uploadEncryptedBlob function.
 *   5. Store the memo record (blobRef + analysis) in @meerkat/local-store.
 *
 * The raw audio never leaves this function in plaintext — only the
 * encrypted form is uploaded.
 *
 * @example
 * ```ts
 * const saved = await saveVoiceNote(audioBlob, durationSeconds, {
 *   denId: user.id,
 *   encryptionKey: namespaceKey,
 *   uploadEncryptedBlob: async (data, iv) => {
 *     const res = await trpc.voice.upload.mutate({ data, iv })
 *     return res.blobRef
 *   },
 * })
 * ```
 */
export async function saveVoiceNote(
  blob: Blob,
  durationSeconds: number,
  options: SaveVoiceNoteOptions,
): Promise<SavedVoiceNote> {
  const {
    denId,
    encryptionKey,
    uploadEncryptedBlob,
    allowAnalysisFailure = true,
  } = options;

  // ── Step 1: On-device analysis ──────────────────────────────────────────────
  // Runs entirely in the browser — no network call. If analysis fails and
  // allowAnalysisFailure is true, we save the memo without mood data.

  let analysis: SavedVoiceNote["analysis"] | undefined;

  try {
    const result = await analyzeVoice(blob);
    analysis = {
      transcript: result.transcript,
      mood: result.mood,
      tone: result.tone,
      valence: result.valence,
      arousal: result.arousal,
      confidence: result.confidence,
      analysedAt: result.analysedAt,
    };
  } catch (err) {
    if (!allowAnalysisFailure) {
      throw new Error(
        `[@meerkat/voice] analyzeVoice failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    // Graceful degradation — memo saves without mood metadata
    console.warn("[@meerkat/voice] analyzeVoice failed (non-fatal):", err);
  }

  // ── Step 2: Convert blob to bytes ───────────────────────────────────────────

  const rawBytes = await blobToUint8Array(blob);

  // ── Step 3: Encrypt ─────────────────────────────────────────────────────────
  // encryptBlob produces an EncryptedBlob { alg, iv, data } — all base64.
  // The raw bytes are only held in memory here, never persisted or sent.

  const encryptedBlob = await encryptBlob(rawBytes, encryptionKey);

  // ── Step 4: Upload ──────────────────────────────────────────────────────────
  // The caller provides the upload function. In the app this calls a tRPC route
  // that proxies directly to Supabase Storage. The server never sees plaintext.

  const blobRef = await uploadEncryptedBlob(
    encryptedBlob.data,
    encryptedBlob.iv,
  );

  // ── Step 5: Store in local-store ────────────────────────────────────────────
  // Writes a VoiceMemoData entry into the private Yjs doc (IndexedDB).
  // This is the single source of truth for the app — not Supabase.

  const memo = await addVoiceMemo(
    denId,
    blobRef,
    Math.round(durationSeconds),
    analysis
      ? {
          transcript: analysis.transcript,
          mood: analysis.mood as Parameters<typeof addVoiceMemo>[3] extends {
            mood: infer M;
          }
            ? M
            : string,
          tone: analysis.tone,
          valence: analysis.valence,
          arousal: analysis.arousal,
          confidence: analysis.confidence,
          analysedAt: analysis.analysedAt,
        }
      : undefined,
  );

  return {
    memoId: memo.id,
    blobRef,
    durationSeconds: memo.durationSeconds,
    analysis,
  };
}
