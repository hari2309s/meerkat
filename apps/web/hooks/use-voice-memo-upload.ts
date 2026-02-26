"use client";

import { useCallback, useState } from "react";
import { analyzeVoice } from "@meerkat/analyzer";
import { createClient } from "@/lib/supabase/client";

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
 * Hook for uploading voice memos with on-device analysis.
 *
 * This hook provides the upload functionality needed by the voice recorder.
 * It handles:
 * 1. On-device transcription and emotion analysis
 * 2. Upload to Supabase Storage
 * 3. Returns analysis results for storage in the database
 *
 * Phase 1: Works with legacy Supabase storage (unencrypted)
 * Phase 2+: Will integrate with @meerkat/voice for encryption and local-first
 *
 * @param denId - The den ID to upload voice memos to
 * @param userId - The current user ID
 *
 * @example
 * ```tsx
 * const { uploadVoiceMemo, isAnalyzing } = useVoiceMemoUpload(denId, userId);
 * const { voiceUrl, analysis } = await uploadVoiceMemo(audioBlob, durationSeconds);
 * ```
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
    }> => {
      const supabase = createClient();

      // Step 1: Analyze the voice note on-device (runs in parallel with upload)
      setIsAnalyzing(true);
      const analysisPromise: Promise<AnalysisResult | null> = analyzeVoice(
        audioBlob,
        { language: "en" },
      ).catch((err: unknown) => {
        console.warn("[@meerkat/web] Voice analysis failed (non-fatal):", err);
        return null; // Graceful degradation
      });

      // Step 2: Upload the audio blob to Supabase Storage
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileName = `${denId}/${userId}/${timestamp}-${random}.webm`;

      const { error: uploadErr } = await supabase.storage
        .from("voice-notes")
        .upload(fileName, audioBlob, {
          contentType: "audio/webm",
        });

      if (uploadErr) {
        setIsAnalyzing(false);
        console.error("[@meerkat/web] Voice upload error:", uploadErr);
        throw new Error(
          `Failed to upload voice memo: ${uploadErr.message}. ` +
            `Make sure the 'voice-notes' bucket exists in Supabase Storage.`,
        );
      }

      // Since the bucket is private, we'll store the file path
      // The signed URL will be generated when needed for playback
      // For now, we just store the path in Supabase format
      const voiceUrl = `${denId}/${userId}/${timestamp}-${random}.webm`;

      // Wait for analysis to complete
      const analysisResult = await analysisPromise;
      setIsAnalyzing(false);

      return {
        voiceUrl,
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
      };
    },
    [denId, userId],
  );

  return { uploadVoiceMemo, isAnalyzing };
}
