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
  _language = "en",
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
  // return_timestamps must be true in transformers.js v3 for chunk_length_s
  // to trigger chunked long-form transcription. With false, v3 skips chunking
  // and runs single-pass, which can silently produce empty output on WASM.
  // output.text always contains the assembled transcript regardless of the
  // timestamp setting — extractTranscriptText reads that field first.
  const output = await pipe(samples, {
    // whisper-tiny.en is English-only — omit `language` and `task` to avoid
    // "Cannot specify task or language for an English-only model" error.
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    sampling_rate: WHISPER_SAMPLE_RATE,
  });

  return extractTranscriptText(output);
}

/**
 * Extracts transcript text from Whisper pipeline output.
 * Handles varying output shapes across pipeline versions.
 *
 * With return_timestamps: true (v3 chunked path), output is:
 *   { text: " full transcript", chunks: [{timestamp, text}, ...] }
 * We prefer output.text (the assembled result) and fall back to
 * concatenating all chunks — never just chunks[0] which truncates.
 */
function extractTranscriptText(output: unknown): string {
  if (typeof output === "string") return output.trim();
  const out = output as { text?: string; chunks?: { text?: string }[] };
  if (typeof out?.text === "string") return out.text.trim();
  if (Array.isArray(out?.chunks) && out.chunks.length > 0) {
    return out.chunks
      .map((c) => c.text ?? "")
      .join("")
      .trim();
  }
  return "";
}

/**
 * Convenience variant for when you already have a Float32Array
 * (e.g. from an AudioWorklet or a direct recording pipeline).
 *
 * @param samples    — 16kHz mono PCM Float32Array.
 * @param language   — BCP-47 language hint (unused for English-only model).
 * @param onProgress — Optional download progress callback.
 */
export async function transcribeSamples(
  samples: Float32Array,
  _language = "en",
  onProgress?: ModelProgressCallback,
): Promise<string> {
  if (isSilent(samples)) return "";

  const pipe = await getTranscriptionPipeline(onProgress);

  const output = await pipe(samples, {
    // Omit language/task — English-only model rejects those options.
    // return_timestamps: true required in transformers.js v3 for chunked
    // long-form transcription (see transcribe() above for details).
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    sampling_rate: WHISPER_SAMPLE_RATE,
  });

  return extractTranscriptText(output);
}
