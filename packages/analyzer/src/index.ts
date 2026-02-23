/**
 * @meerkat/analyzer
 *
 * On-device voice transcription and emotion analysis.
 *
 * ─── Privacy guarantee ────────────────────────────────────────────────────────
 * No audio or text ever leaves the device. Whisper (transcription) and
 * the emotion classifier both run entirely in the browser via WebAssembly.
 * Model weights are downloaded once (~115MB total) and cached in OPFS.
 *
 * ─── Quick start ──────────────────────────────────────────────────────────────
 *
 *   // Analyse a voice recording (full pipeline):
 *   const result = await analyzeVoice(blob, { language: "en" });
 *   // → { transcript, mood, tone, valence, arousal, confidence, analysedAt }
 *
 *   // Transcribe only:
 *   const text = await transcribe(blob);
 *
 *   // Classify emotion from any text:
 *   const emotion = await classifyEmotion("I feel fantastic today!");
 *
 *   // Warm up models before the first recording:
 *   await preloadModels({ onProgress: (e) => setProgress(e.progress) });
 *
 * ─── React hooks ──────────────────────────────────────────────────────────────
 *
 *   const { transcription, emotion } = useModelStatus();
 *   const { analyze, result, isAnalyzing } = useAnalyzeVoice();
 *   const { isReady } = usePreloadModels();
 */

// ─── Primary API ───────────────────────────────────────────────────────────────
export {
  analyzeVoice,
  transcribe,
  transcribeSamples,
  classifyEmotion,
  preloadModels,
  isModelLoaded,
  getModelStatus,
  onModelStatusChange,
  resetModels,
} from "./analyzer";

// ─── React hooks ───────────────────────────────────────────────────────────────
export { useModelStatus, usePreloadModels, useAnalyzeVoice } from "./hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  AnalysisResult,
  EmotionResult,
  MoodLabel,
  ToneLabel,
  ModelLoadStatus,
  ModelStatus,
  ModelProgressEvent,
  ModelProgressCallback,
  AnalyzerOptions,
} from "./types.js";
