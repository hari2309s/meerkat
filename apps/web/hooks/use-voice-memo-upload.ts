"use client";

import { useCallback, useState } from "react";
import { analyzeVoice } from "@meerkat/analyzer";
import { encryptBlob } from "@meerkat/crypto";
import { createClient } from "@/lib/supabase/client";
import { loadVaultKey } from "@/lib/vault-credentials";

interface AnalysisResult {
  transcript: string;
  mood: string;
  tone: string;
  valence: number;
  arousal: number;
  confidence: number;
  analysedAt: number;
}

/**
 * Hook for uploading voice memos with on-device analysis and client-side
 * encryption.
 *
 * Pipeline:
 *   1. Analyse the audio on-device (Whisper + emotion classifier).
 *   2. If a vault session is active, encrypt the raw bytes with the
 *      mnemonic-derived AES-GCM-256 key (HKDF-SHA-256) before upload.
 *      Supabase Storage only ever receives ciphertext.
 *   3. Upload the (encrypted) payload. The stored path uses the ".enc"
 *      extension so callers know decryption is required on playback.
 *   4. Return the storage path and analysis results.
 *
 * Fallback: if no vault session exists (legacy v1 Supabase user), the raw
 * audio is uploaded unencrypted and the path keeps the ".webm" extension.
 * This preserves backward-compatibility — existing unencrypted recordings
 * continue to play back without changes.
 *
 * @param denId  - The den ID, used as the storage folder prefix.
 * @param userId - The current user ID, used as the storage sub-folder.
 */
export function useVoiceMemoUpload(denId: string, userId: string) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const uploadVoiceMemo = useCallback(
    async (
      audioBlob: Blob,
      _duration: number, // Kept for API compatibility; duration is tracked when saving to DB
    ): Promise<{
      voiceUrl: string;
      analysis: AnalysisResult | null;
      encrypted: boolean;
    }> => {
      const supabase = createClient();

      // ── Step 1: On-device analysis (runs concurrently with key derivation) ──
      setIsAnalyzing(true);
      const analysisPromise: Promise<AnalysisResult | null> = analyzeVoice(
        audioBlob,
        { language: "en" },
      ).catch((err: unknown) => {
        console.warn("[@meerkat/web] Voice analysis failed (non-fatal):", err);
        return null; // Graceful degradation — memo saves without mood data
      });

      // ── Step 2: Derive vault key (if a vault session is active) ─────────────
      // This is cheap — HKDF is a single hash operation — and runs while the
      // analysis model is warming up.
      const vaultKey = await loadVaultKey();

      // ── Step 3: Convert blob to bytes ────────────────────────────────────────
      const rawBytes = new Uint8Array(await audioBlob.arrayBuffer());

      // ── Step 4: Encrypt if we have a vault key ───────────────────────────────
      let uploadPayload: Blob;
      let fileExt: string;
      let contentType: string;

      if (vaultKey) {
        // Encrypt the raw audio bytes. encryptBlob returns an EncryptedBlob
        // { alg, iv, data } — all base64-encoded and JSON-serialisable.
        // We serialise it to JSON and upload as application/octet-stream so
        // the storage bucket doesn't try to serve it as audio.
        const encryptedBlob = await encryptBlob(rawBytes, vaultKey);
        const encryptedJson = JSON.stringify(encryptedBlob);
        uploadPayload = new Blob([encryptedJson], {
          type: "application/octet-stream",
        });
        fileExt = "enc";
        contentType = "application/octet-stream";
      } else {
        // No vault session — legacy v1 flow. Upload raw audio.
        uploadPayload = audioBlob;
        fileExt = "webm";
        contentType = "audio/webm";
      }

      // ── Step 5: Upload to Supabase Storage ───────────────────────────────────
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileName = `${denId}/${userId}/${timestamp}-${random}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("voice-notes")
        .upload(fileName, uploadPayload, { contentType });

      if (uploadErr) {
        setIsAnalyzing(false);
        console.error("[@meerkat/web] Voice upload error:", uploadErr);
        throw new Error(
          `Failed to upload voice memo: ${uploadErr.message}. ` +
            `Make sure the 'voice-notes' bucket exists in Supabase Storage.`,
        );
      }

      // ── Step 6: Await analysis ────────────────────────────────────────────────
      const analysisResult = await analysisPromise;
      setIsAnalyzing(false);

      return {
        voiceUrl: fileName,
        analysis: analysisResult
          ? {
              transcript: analysisResult.transcript,
              mood: analysisResult.mood,
              tone: analysisResult.tone,
              valence: analysisResult.valence,
              arousal: analysisResult.arousal,
              confidence: analysisResult.confidence,
              analysedAt: analysisResult.analysedAt,
            }
          : null,
        encrypted: !!vaultKey,
      };
    },
    [denId, userId],
  );

  return { uploadVoiceMemo, isAnalyzing };
}
