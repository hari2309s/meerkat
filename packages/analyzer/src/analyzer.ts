/**
 * @meerkat/analyzer — core analyzer
 *
 * The main analyzeVoice() function orchestrates:
 *   1. Decode audio blob → 16kHz mono PCM
 *   2. Transcribe with Whisper (on-device, WASM)
 *   3. Classify emotion from transcript (on-device, ONNX)
 *   4. Return a fully-typed AnalysisResult
 *
 * Both models run entirely in the browser. No data leaves the device.
 * Results are stored in the local Yjs doc alongside the voice memo.
 */

import { transcribe } from "./lib/transcription";
import { classifyEmotion, buildNeutralResult } from "./lib/emotion";
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
 * Analyses a voice note end-to-end: transcribe → classify emotion → build result.
 *
 * This is the function @meerkat/voice calls after a recording is stopped.
 * The result is stored in the VoiceMemoData.analysis field in local-store.
 *
 * Both models are loaded lazily on first call (download once, cached in OPFS).
 *
 * @param audioBlob — Raw audio blob from the browser MediaRecorder API.
 * @param options   — Optional language hint and progress callback.
 * @returns         — AnalysisResult with transcript, mood, tone, valence, arousal.
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
 * console.log(result.transcript);  // "I'm feeling pretty good today"
 * console.log(result.mood);        // "happy"
 * console.log(result.valence);     // 0.8
 * ```
 */
export async function analyzeVoice(
  audioBlob: Blob,
  options: AnalyzerOptions = {},
): Promise<AnalysisResult> {
  const { language = "en", onProgress } = options;

  // Step 1: Transcribe.
  const transcript = await transcribe(audioBlob, language, onProgress);

  // Step 2: Classify emotion from transcript.
  const emotion = transcript
    ? await classifyEmotion(transcript, onProgress)
    : null;

  const { mood, tone, valence, arousal, confidence } =
    emotion ?? buildNeutralResult();

  return {
    transcript,
    mood,
    tone,
    valence,
    arousal,
    confidence,
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
 * // In your app's onboarding or settings screen
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
 * Safe to call at any time — returns false during or before model load.
 *
 * @example
 * ```ts
 * if (!isModelLoaded()) {
 *   await preloadModels();
 * }
 * ```
 */
export const isModelLoaded = _isModelLoaded;

/**
 * Returns the current load status of each model.
 * Useful for rendering a loading indicator in the UI.
 */
export const getModelStatus = _getModelStatus;

/**
 * Subscribe to model status changes.
 * Fires whenever a model's load status transitions.
 * Returns an unsubscribe function.
 *
 * @example
 * ```ts
 * const unsubscribe = onModelStatusChange((status) => {
 *   if (status.transcription === "ready" && status.emotion === "ready") {
 *     console.log("Both models ready!");
 *   }
 * });
 * ```
 */
export const onModelStatusChange = _onModelStatusChange;

/**
 * Resets all model state. For testing only — do not call in production.
 * @internal
 */
export const resetModels = _resetModels;
