/**
 * @meerkat/analyzer — model registry
 *
 * Manages the lifecycle of the two on-device models:
 *   1. Whisper tiny (transcription)
 *   2. Emotion classifier (emotion/mood classification)
 *
 * Both models are loaded lazily on first use and cached in the browser's
 * OPFS (Origin Private File System) by transformers.js. Subsequent loads
 * are instant — the heavy download only happens once per device.
 *
 * This module is intentionally framework-agnostic. The React hook layer
 * (use-analyzer.ts) subscribes to model status changes via the ModelRegistry
 * event emitter.
 */

import type {
  ModelProgressCallback,
  ModelStatus,
  ModelLoadStatus,
} from "../types";
import { TRANSCRIPTION_MODEL_ID, EMOTION_MODEL_ID } from "../constants";

// ─── Types ────────────────────────────────────────────────────────────────────

// We import transformers.js dynamically to avoid SSR issues in Next.js.
// The types below mirror what we need from the library.
type Pipeline = (input: string | string[]) => Promise<unknown>;
type AutomaticSpeechRecognitionPipeline = (
  input: Float32Array | string,
  options?: Record<string, unknown>,
) => Promise<{ text: string }>;

// ─── Singleton state ──────────────────────────────────────────────────────────

let transcriptionPipeline: AutomaticSpeechRecognitionPipeline | null = null;
let emotionPipeline: Pipeline | null = null;

let transcriptionStatus: ModelLoadStatus = "idle";
let emotionStatus: ModelLoadStatus = "idle";

// Pending promises so concurrent callers await the same load.
let transcriptionLoading: Promise<AutomaticSpeechRecognitionPipeline> | null =
  null;
let emotionLoading: Promise<Pipeline> | null = null;

// Status listeners (for React hooks and UI)
const statusListeners = new Set<(status: ModelStatus) => void>();

function notifyListeners() {
  const status: ModelStatus = {
    transcription: transcriptionStatus,
    emotion: emotionStatus,
  };
  for (const listener of statusListeners) {
    listener(status);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Subscribe to model status changes.
 * Returns an unsubscribe function.
 */
export function onModelStatusChange(
  listener: (status: ModelStatus) => void,
): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/**
 * Returns the current model load status (snapshot, not reactive).
 */
export function getModelStatus(): ModelStatus {
  return {
    transcription: transcriptionStatus,
    emotion: emotionStatus,
  };
}

/**
 * Returns true if both models are loaded and ready.
 */
export function isModelLoaded(): boolean {
  return transcriptionStatus === "ready" && emotionStatus === "ready";
}

/**
 * Lazily loads and returns the Whisper transcription pipeline.
 *
 * The model is cached in OPFS after the first load — subsequent calls
 * return the cached instance immediately.
 *
 * @param onProgress — Optional callback for download progress events.
 */
export async function getTranscriptionPipeline(
  onProgress?: ModelProgressCallback,
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (transcriptionPipeline) return transcriptionPipeline;

  if (transcriptionLoading) return transcriptionLoading;

  transcriptionLoading = (async () => {
    transcriptionStatus = "loading";
    notifyListeners();

    try {
      // Dynamic import keeps transformers.js out of the initial bundle.
      const { pipeline, env } = await import(
        /* webpackChunkName: "transformers" */
        "@huggingface/transformers"
      );

      // Use OPFS for model caching so downloads survive page reloads.
      env.useBrowserCache = true;
      env.allowLocalModels = false;

      const progressCallback = onProgress
        ? (event: { status: string; progress?: number; file?: string }) => {
            onProgress({
              model: "transcription",
              progress: event.progress ?? null,
              status: event.file ? `Downloading ${event.file}…` : event.status,
            });
          }
        : undefined;

      const pipe = (await (pipeline as any)(
        "automatic-speech-recognition",
        TRANSCRIPTION_MODEL_ID,
        {
          dtype: "q8", // quantised int8 — 75MB vs 150MB fp32
          device: "wasm", // WASM fallback (works in all browsers)
          progress_callback: progressCallback,
        },
      )) as AutomaticSpeechRecognitionPipeline;

      transcriptionPipeline = pipe;
      transcriptionStatus = "ready";
      notifyListeners();
      return pipe;
    } catch (err) {
      transcriptionStatus = "error";
      transcriptionLoading = null;
      notifyListeners();
      throw err;
    }
  })();

  return transcriptionLoading;
}

/**
 * Lazily loads and returns the emotion classification pipeline.
 *
 * @param onProgress — Optional callback for download progress events.
 */
export async function getEmotionPipeline(
  onProgress?: ModelProgressCallback,
): Promise<Pipeline> {
  if (emotionPipeline) return emotionPipeline;

  if (emotionLoading) return emotionLoading;

  emotionLoading = (async () => {
    emotionStatus = "loading";
    notifyListeners();

    try {
      const { pipeline, env } = await import(
        /* webpackChunkName: "transformers" */
        "@huggingface/transformers"
      );

      env.useBrowserCache = true;
      env.allowLocalModels = false;

      const progressCallback = onProgress
        ? (event: { status: string; progress?: number; file?: string }) => {
            onProgress({
              model: "emotion",
              progress: event.progress ?? null,
              status: event.file ? `Downloading ${event.file}…` : event.status,
            });
          }
        : undefined;

      const pipe = (await (pipeline as any)(
        "text-classification",
        EMOTION_MODEL_ID,
        {
          dtype: "q8",
          device: "wasm",
          progress_callback: progressCallback,
        },
      )) as Pipeline;

      emotionPipeline = pipe;
      emotionStatus = "ready";
      notifyListeners();
      return pipe;
    } catch (err) {
      emotionStatus = "error";
      emotionLoading = null;
      notifyListeners();
      throw err;
    }
  })();

  return emotionLoading;
}

/**
 * Resets all model state. Primarily for testing.
 * Do NOT call in production — it evicts the in-memory pipeline cache,
 * forcing a full reload on next use.
 */
export function resetModels(): void {
  transcriptionPipeline = null;
  emotionPipeline = null;
  transcriptionLoading = null;
  emotionLoading = null;
  transcriptionStatus = "idle";
  emotionStatus = "idle";
  notifyListeners();
}
