/**
 * @meerkat/analyzer — core analyzer
 *
 * The main analyzeVoice() function orchestrates a three-stream pipeline:
 *
 *   Stream 1: Acoustic Feature Extraction (signal processing, no model)
 *     - Pitch, energy, speaking rate, spectral features
 *     - Jitter, shimmer, pause duration
 *
 *   Stream 2: Acoustic Mood Signal (rule-based from features)
 *     - Valence from pitch/energy/spectral
 *     - Arousal from energy/rate/pitch variance
 *
 *   Stream 3: Text Sentiment (DistilBERT SST-2 on Whisper transcript)
 *     - Binary POSITIVE/NEGATIVE → valence score
 *
 *   Fusion Layer:
 *     - Dynamic signal weighting (50/50 default, shifts by context)
 *     - Contradiction detection (sarcasm, masking, stress)
 *     - Confidence calculation (starts at 50%)
 *     - Natural language description generation
 *     - Final AnalysisResult with mood/tone/valence/arousal/confidence
 *
 * Streams 1 and 3 run concurrently — audio feature extraction is
 * synchronous and CPU-light, while Whisper loads and runs in parallel.
 *
 * Both models run entirely in the browser. No data leaves the device.
 * Results are stored in the local Yjs doc alongside the voice memo.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Multi-modal approach
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Text-only sentiment misses acoustic cues: a flat "I'm fine" reads as neutral
 * but reveals low arousal/valence from pitch and energy. Jitter/shimmer reveal
 * stress even when words say everything is okay. Conversely, very short
 * transcripts give text nothing to work with — audio provides the primary
 * signal in those cases.
 *
 * The fusion function dynamically weights text vs. audio based on signal
 * quality, detects contradictions (sarcasm, masking, stress), and generates
 * a natural language description of the result.
 */

import { transcribeSamples } from "./lib/transcription";
import { classifyEmotion, buildNeutralResult } from "./lib/emotion";
import {
  extractAudioFeatures,
  inferMoodFromAudio,
  fuseEmotionSignals,
} from "./lib/audio-features";
import { blobToFloat32, generateDescription } from "./utils";
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
 * Analyses a voice note end-to-end using a three-stream multi-modal pipeline:
 * acoustic feature analysis + acoustic mood signal + text-based sentiment
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
 *                    arousal, confidence, description, contradiction,
 *                    audioFeatures, and analysedAt.
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
 * console.log(result.transcript);   // "I'm feeling pretty good today"
 * console.log(result.mood);         // "positive"
 * console.log(result.tone);         // "pleasant"
 * console.log(result.description);  // "Positive mood, pleasant tone, high pitched"
 * console.log(result.valence);      // 0.72
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
  //   - Transcription is async (WASM model). Errors are caught here so a
  //     model load failure or WASM runtime error causes graceful audio-only
  //     fallback rather than rejecting the entire analyzeVoice call.
  const [audioFeatures, transcript] = await Promise.all([
    Promise.resolve(extractAudioFeatures(samples)),
    transcribeSamples(samples, lang, onProgress),
  ]);

  // Step 4: Infer mood from audio signal (no model needed).
  const audioMood = inferMoodFromAudio(audioFeatures);

  // Step 5: Text-based sentiment classification (DistilBERT SST-2).
  // Wrap in try-catch — tokenizer may call .replace() on input; ensure string
  let textEmotion: Awaited<ReturnType<typeof classifyEmotion>> = null;
  if (transcript && typeof transcript === "string" && transcript.trim()) {
    textEmotion = await classifyEmotion(String(transcript).trim(), onProgress);
  }

  // Step 6: Fuse audio signal + text sentiment into final result.
  let finalMood: {
    mood: AnalysisResult["mood"];
    tone: AnalysisResult["tone"];
    valence: number;
    arousal: number;
    confidence: number;
    description: string;
    contradiction: AnalysisResult["contradiction"];
  };

  if (textEmotion) {
    // Both signals available — fuse them with full contradiction detection.
    finalMood = fuseEmotionSignals(textEmotion, audioMood, audioFeatures);
  } else {
    // No usable transcript — fall back to audio-only signal.
    // If the audio signal is also weak, use neutral.
    const audioResult =
      audioMood.confidence > 0.2 ? audioMood : buildNeutralResult();
    finalMood = {
      ...audioResult,
      description: generateDescription(
        audioResult.mood,
        audioResult.tone,
        audioFeatures,
        null,
      ),
      contradiction: null,
    };
  }

  return {
    transcript,
    mood: finalMood.mood,
    tone: finalMood.tone,
    valence: finalMood.valence,
    arousal: finalMood.arousal,
    confidence: finalMood.confidence,
    description: finalMood.description,
    contradiction: finalMood.contradiction,
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
 * Classifies sentiment from a text string using DistilBERT SST-2.
 * Call this with a transcript to get mood/valence/arousal without re-transcribing.
 *
 * @example
 * ```ts
 * const emotion = await classifyEmotion("I feel great today!");
 * // { mood: "positive", valence: 0.96, ... }
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
