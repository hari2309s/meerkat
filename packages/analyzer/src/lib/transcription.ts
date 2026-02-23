/**
 * @meerkat/analyzer — transcription
 *
 * Wraps the Whisper tiny WASM model for on-device speech-to-text.
 *
 * This module is the thin glue between raw audio bytes and a text transcript.
 * All model loading is delegated to the model-registry so the pipeline
 * instance is shared across callers and never loaded twice.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Privacy guarantee
 * ──────────────────────────────────────────────────────────────────────────────
 * Audio never leaves the device. The Whisper model runs entirely in the
 * browser via WebAssembly. No network request is made during transcription.
 * (Model weights are downloaded once and cached in OPFS.)
 */

import { getTranscriptionPipeline } from "./model-registry";
import { blobToFloat32, isSilent } from "../utils";
import type { ModelProgressCallback } from "../types";
import { WHISPER_SAMPLE_RATE } from "../constants";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Transcribes an audio Blob to text using Whisper tiny (on-device, WASM).
 *
 * The first call will download and cache the model (~75MB).
 * Subsequent calls are fast — the model stays in memory.
 *
 * Returns an empty string for silent audio.
 *
 * @param audioBlob  — Raw audio blob (WebM, WAV, MP4, OGG…)
 * @param language   — BCP-47 language hint, e.g. "en". Defaults to "en".
 * @param onProgress — Optional download progress callback.
 *
 * @example
 * ```ts
 * const transcript = await transcribe(voiceBlob, "en");
 * console.log(transcript); // "I recorded this note at midnight"
 * ```
 */
export async function transcribe(
  audioBlob: Blob,
  language = "en",
  onProgress?: ModelProgressCallback,
): Promise<string> {
  // Decode the blob to 16kHz mono PCM.
  const samples = await blobToFloat32(audioBlob);

  // Skip empty/silent recordings — Whisper outputs garbage on silence.
  if (isSilent(samples)) {
    return "";
  }

  const pipe = await getTranscriptionPipeline(onProgress);

  // Run Whisper inference.
  const output = await pipe(samples, {
    language,
    task: "transcribe",
    // chunk_length_s splits long audio into overlapping 30s chunks.
    // This is how Whisper handles audio longer than its attention window.
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
    sampling_rate: WHISPER_SAMPLE_RATE,
  });

  return output.text.trim();
}

/**
 * Convenience variant for when you already have a Float32Array
 * (e.g. from an AudioWorklet or a direct recording pipeline).
 *
 * @param samples    — 16kHz mono PCM Float32Array.
 * @param language   — BCP-47 language hint.
 * @param onProgress — Optional download progress callback.
 */
export async function transcribeSamples(
  samples: Float32Array,
  language = "en",
  onProgress?: ModelProgressCallback,
): Promise<string> {
  if (isSilent(samples)) return "";

  const pipe = await getTranscriptionPipeline(onProgress);

  const output = await pipe(samples, {
    language,
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
    sampling_rate: WHISPER_SAMPLE_RATE,
  });

  return output.text.trim();
}
