/**
 * @meerkat/analyzer
 *
 * On-device voice transcription, audio-signal analysis, and emotion/mood/tone
 * detection. Dual-signal pipeline: acoustic features + text classification.
 *
 * ─── Privacy guarantee ────────────────────────────────────────────────────────
 * No audio or text ever leaves the device. Whisper (transcription) and the
 * emotion classifier both run entirely in the browser via WebAssembly/ONNX.
 * Audio feature extraction runs synchronously from decoded PCM — no network.
 * Model weights are downloaded once (~115MB total) and cached in OPFS.
 *
 * ─── Dual-signal pipeline ────────────────────────────────────────────────────
 *
 *   audioBlob
 *     ├── extractAudioFeatures()   ← pitch, energy, speaking rate, spectral
 *     │     └── inferMoodFromAudio() ← rule-based acoustic mood signal
 *     │
 *     └── transcribe()             ← Whisper WASM
 *           └── classifyEmotion()  ← ONNX text classifier
 *
 *   fuseEmotionSignals(textResult, audioSignal) → final AnalysisResult
 *
 * ─── Quick start ──────────────────────────────────────────────────────────────
 *
 *   // Full dual-signal pipeline (recommended):
 *   const result = await analyzeVoice(blob, { language: "en" });
 *   // → { transcript, mood, tone, valence, arousal, confidence, audioFeatures, analysedAt }
 *
 *   // Transcribe only:
 *   const text = await transcribe(blob);
 *
 *   // Classify emotion from any text:
 *   const emotion = await classifyEmotion("I feel fantastic today!");
 *
 *   // Audio-only mood (no model needed, synchronous):
 *   const samples = await blobToFloat32(blob);
 *   const features = extractAudioFeatures(samples);
 *   const audioMood = inferMoodFromAudio(features);
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
  extractAudioFeatures,
  inferMoodFromAudio,
  fuseEmotionSignals,
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
  AudioFeatures,
  AudioMoodSignal,
  MoodLabel,
  ToneLabel,
  ModelLoadStatus,
  ModelStatus,
  ModelProgressEvent,
  ModelProgressCallback,
  AnalyzerOptions,
} from "./types.js";
