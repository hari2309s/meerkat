/**
 * @meerkat/analyzer — core analyzer
 *
 * The main analyzeVoice() function orchestrates a dual-signal pipeline:
 *
 *   1. Decode audio blob → 16kHz mono PCM
 *   2. Run audio-feature extraction (pitch, energy, speaking rate, spectral)
 *   3. Transcribe with Whisper (on-device, WASM)
 *   4. Classify emotion from transcript (on-device, ONNX)
 *   5. Fuse audio-signal mood estimate with text-based emotion result
 *   6. Return a fully-typed AnalysisResult
 *
 * Steps 2 and 3 run concurrently — audio feature extraction is
 * synchronous and CPU-light, while Whisper loads and runs in parallel.
 *
 * Both models run entirely in the browser. No data leaves the device.
 * Results are stored in the local Yjs doc alongside the voice memo.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Dual-signal approach
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Text-only emotion classification misses acoustic cues that are orthogonal
 * to word choice: a flat, slow "I'm fine" reads as neutral text but reveals
 * low arousal and low valence from pitch and energy analysis. Conversely,
 * very short transcripts (1–2 words, or when a user records a sigh or hum)
 * give the text classifier nothing to work with — the audio signal provides
 * the primary signal in those cases.
 *
 * The fusion function weights text higher (when it has strong confidence)
 * while using audio features to moderate the final result.
 */

import { transcribeSamples } from "./lib/transcription";
import { classifyEmotion, buildNeutralResult } from "./lib/emotion";
import {
  extractAudioFeatures,
  inferMoodFromAudio,
  fuseEmotionSignals,
} from "./lib/audio-features";
import { blobToFloat32 } from "./utils";
import {
  getTranscriptionPipeline,
  getEmotionPipeline,
  isModelLoaded as _isModelLoaded,
  getModelStatus as _getModelStatus,
  onModelStatusChange as _onModelStatusChange,
  resetModels as _resetModels,
} from "./lib/model-registry";
import type { AnalysisResult, AnalyzerOptions } from "./types";

// ─── Primary API ──────────────────────────────────────────────────────────────

/**
 * Analyses a voice note end-to-end using a dual-signal pipeline:
 * acoustic feature analysis of the audio + text-based emotion classification
 * from the Whisper transcript, fused into a single AnalysisResult.
 *
 * This is the function @meerkat/voice calls after a recording is stopped.
 * The result is stored in the VoiceMemoData.analysis field in local-store.
 *
 * Both models are loaded lazily on first call (download once, cached in OPFS).
 * Audio feature extraction runs synchronously with no model dependency.
 *
 * @param audioBlob — Raw audio blob from the browser MediaRecorder API.
 * @param options   — Optional language hint and progress callback.
 * @returns         — AnalysisResult with transcript, mood, tone, valence,
 *                    arousal, confidence, audioFeatures, and analysedAt.
 *
 * @example
 * ```ts
 * import { analyzeVoice } from "@meerkat/analyzer";
 *
 * const result = await analyzeVoice(recordedBlob, {
 *   language: "en",
 *   onProgress: (event) => console.log(event.status, event.progress),
 * });
 *
 * console.log(result.transcript);              // "I'm feeling pretty good today"
 * console.log(result.mood);                    // "happy"
 * console.log(result.valence);                 // 0.78
 * console.log(result.audioFeatures?.pitchMedianHz); // 182
 * ```
 */
export async function analyzeVoice(
  audioBlob: Blob,
  options: AnalyzerOptions = {},
): Promise<AnalysisResult> {
  const { language = "en", onProgress } = options;

  // Ensure language is a string (tokenizer may call .replace internally)
  const lang = typeof language === "string" ? language : "en";

  // Step 1: Decode to PCM once — reused by both audio features and Whisper.
  const samples = await blobToFloat32(audioBlob);

  // Steps 2 & 3 run concurrently:
  //   - Audio feature extraction is synchronous; wrap in Promise.resolve for
  //     consistent error handling in Promise.all.
  //   - Transcription is async (WASM model).
  const [audioFeatures, transcript] = await Promise.all([
    Promise.resolve(extractAudioFeatures(samples)),
    transcribeSamples(samples, lang, onProgress),
  ]);

  // Step 4: Infer mood from audio signal (no model needed).
  const audioMood = inferMoodFromAudio(audioFeatures);

  // Step 5: Text-based emotion classification (ONNX model).
  // Wrap in try-catch — tokenizer may call .replace() on input; ensure string
  let textEmotion: Awaited<ReturnType<typeof classifyEmotion>> = null;
  if (transcript && typeof transcript === "string" && transcript.trim()) {
    try {
      textEmotion = await classifyEmotion(
        String(transcript).trim(),
        onProgress,
      );
    } catch {
      // Non-fatal — fall back to audio-only mood
    }
  }

  // Step 6: Fuse audio signal + text classification into final result.
  let finalMood: ReturnType<typeof buildNeutralResult>;

  if (textEmotion) {
    // Both signals available — fuse them.
    finalMood = fuseEmotionSignals(textEmotion, audioMood);
  } else {
    // No usable transcript — fall back to audio-only signal.
    // If the audio signal is also weak, use neutral.
    finalMood = audioMood.confidence > 0.2 ? audioMood : buildNeutralResult();
  }

  return {
    transcript,
    mood: finalMood.mood,
    tone: finalMood.tone,
    valence: finalMood.valence,
    arousal: finalMood.arousal,
    confidence: finalMood.confidence,
    audioFeatures,
    analysedAt: Date.now(),
  };
}

// ─── Lower-level exports ──────────────────────────────────────────────────────

/**
 * Transcribes audio to text without emotion classification.
 * Useful when you only need the transcript and want to classify later.
 *
 * @example
 * ```ts
 * const text = await transcribe(blob, "en");
 * ```
 */
export { transcribe } from "./lib/transcription";
export { transcribeSamples } from "./lib/transcription";

/**
 * Classifies emotion from a text string.
 * Call this with a transcript to get mood/valence/arousal without re-transcribing.
 *
 * @example
 * ```ts
 * const emotion = await classifyEmotion("I feel great today!");
 * ```
 */
export { classifyEmotion } from "./lib/emotion";

/**
 * Extracts raw acoustic features from PCM samples.
 * Lower-level function; most callers should use analyzeVoice() instead.
 *
 * @example
 * ```ts
 * import { blobToFloat32 } from "@meerkat/analyzer/utils";
 * const samples = await blobToFloat32(blob);
 * const features = extractAudioFeatures(samples);
 * ```
 */
export {
  extractAudioFeatures,
  inferMoodFromAudio,
  fuseEmotionSignals,
} from "./lib/audio-features";

// ─── Model management ─────────────────────────────────────────────────────────

/**
 * Preloads both models proactively.
 *
 * Call this on app start (after the user's first interaction) to warm up
 * the models before the first voice note is recorded. This avoids the
 * delay at recording-stop time.
 *
 * Calling this multiple times is safe — it returns immediately if models
 * are already loaded.
 *
 * @example
 * ```ts
 * await preloadModels({
 *   onProgress: (e) => setProgress(e.progress ?? 0),
 * });
 * ```
 */
export async function preloadModels(
  options: Pick<AnalyzerOptions, "onProgress"> = {},
): Promise<void> {
  const { onProgress } = options;
  await Promise.all([
    getTranscriptionPipeline(onProgress),
    getEmotionPipeline(onProgress),
  ]);
}

/**
 * Returns true if both models are loaded and ready.
 * Note: audio feature extraction is always available — it requires no model.
 */
export const isModelLoaded = _isModelLoaded;

/** Returns the current load status of each model. */
export const getModelStatus = _getModelStatus;

/** Subscribe to model status changes. Returns an unsubscribe function. */
export const onModelStatusChange = _onModelStatusChange;

/**
 * Resets all model state. For testing only — do not call in production.
 * @internal
 */
export const resetModels = _resetModels;
