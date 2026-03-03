/**
 * @meerkat/analyzer — utils
 *
 * Audio processing helpers and label-mapping utilities.
 * These are pure functions with no side effects — easy to test in isolation.
 */

import type { MoodLabel, ToneLabel } from "./types.js";
import {
  MOOD_DIMENSIONS,
  TONE_THRESHOLDS,
  WHISPER_SAMPLE_RATE,
  MAX_AUDIO_SECONDS,
} from "./constants.js";

// ─── Label normalisation ──────────────────────────────────────────────────────

/**
 * Normalises a raw model label string into a MoodLabel.
 *
 * Different emotion model checkpoints use slightly different label strings
 * (e.g. "joy" vs "happy", "sadness" vs "sad"). This function maps all known
 * variants to the canonical MoodLabel set.
 */
export function normaliseMoodLabel(raw: string): MoodLabel {
  if (typeof raw !== "string") return "neutral";
  const lower = raw.toLowerCase().trim();

  const map: Record<string, MoodLabel> = {
    happy: "happy",
    joy: "happy",
    joyful: "happy",
    excitement: "happy",
    excited: "happy",
    sad: "sad",
    sadness: "sad",
    grief: "sad",
    depressed: "sad",
    remorse: "sad",
    anger: "angry",
    angry: "angry",
    annoyance: "angry",
    disapproval: "angry",
    fear: "fearful",
    fearful: "fearful",
    nervousness: "fearful",
    anxiety: "fearful",
    disgust: "disgusted",
    disgusted: "disgusted",
    surprise: "surprised",
    surprised: "surprised",
    amusement: "surprised",
    neutral: "neutral",
    calm: "neutral",
    realization: "neutral",
  };

  return map[lower] ?? "neutral";
}

// ─── Dimensional affect ───────────────────────────────────────────────────────

/**
 * Looks up the valence + arousal values for a given mood label.
 * Falls back to { 0, 0 } if the label is unrecognised.
 */
export function moodToDimensions(mood: MoodLabel): {
  valence: number;
  arousal: number;
} {
  return MOOD_DIMENSIONS[mood] ?? { valence: 0, arousal: 0 };
}

/**
 * Derives a ToneLabel from valence + arousal using Russell's circumplex model.
 *
 * Quadrant mapping:
 *   +valence +arousal → energetic (happy, excited)
 *   +valence -arousal → calm (content, relaxed)
 *   -valence +arousal → tense (angry, fearful)
 *   -valence -arousal → negative (sad, depressed)
 *   near origin       → neutral
 */
export function deriveTone(valence: number, arousal: number): ToneLabel {
  const absValence = Math.abs(valence);
  const { neutralValence, lowArousal, highArousal } = TONE_THRESHOLDS;

  if (absValence < neutralValence && arousal < lowArousal) return "neutral";

  if (valence > 0) {
    return arousal >= highArousal ? "energetic" : "positive";
  } else {
    if (arousal >= highArousal) return "tense";
    if (arousal < lowArousal) return "negative";
    return "calm";
  }
}

// ─── Audio blob → Float32Array ────────────────────────────────────────────────

/**
 * Decodes an audio Blob into a mono Float32Array at 16kHz.
 *
 * Whisper expects 16kHz mono PCM. This function:
 *   1. Decodes the blob at its native sample rate using AudioContext.
 *   2. Resamples to exactly 16kHz using OfflineAudioContext.
 *
 * Using a plain AudioContext's decodeAudioData is NOT sufficient —
 * decodeAudioData always returns audio at the source file's native sample
 * rate (typically 48kHz from MediaRecorder WebM), regardless of the
 * AudioContext's own sampleRate setting. Without the resample step,
 * Whisper receives 48kHz data labelled as 16kHz, making audio appear
 * 3x too slow, producing empty or garbage transcripts.
 *
 * @param blob — Raw audio blob (WebM, MP4, WAV, etc.)
 * @returns   — Float32Array of mono PCM samples at WHISPER_SAMPLE_RATE (16kHz).
 */
export async function blobToFloat32(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();

  // Step 1: Decode to native sample rate to get an AudioBuffer.
  const decodeCtx = new AudioContext();
  let nativeBuffer: AudioBuffer;
  try {
    nativeBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    await decodeCtx.close();
  }

  // Step 2: Resample to WHISPER_SAMPLE_RATE (16kHz) using OfflineAudioContext.
  // OfflineAudioContext renders to a buffer at the specified sample rate,
  // performing resampling automatically via its internal scheduler.
  const nativeDuration = nativeBuffer.duration;
  const targetLength = Math.ceil(nativeDuration * WHISPER_SAMPLE_RATE);

  // Clamp to MAX_AUDIO_SECONDS to avoid OOM on long recordings.
  const maxSamples = MAX_AUDIO_SECONDS * WHISPER_SAMPLE_RATE;
  const outputLength = Math.min(targetLength, maxSamples);
  const renderDuration = outputLength / WHISPER_SAMPLE_RATE;

  const offlineCtx = new OfflineAudioContext(
    1, // mono output
    outputLength,
    WHISPER_SAMPLE_RATE,
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = nativeBuffer;
  // Downmix to mono: if stereo, connect both channels to the single output.
  source.connect(offlineCtx.destination);
  source.start(0);
  // Only render up to renderDuration in case we clamped to MAX_AUDIO_SECONDS.
  source.stop(renderDuration);

  const resampled = await offlineCtx.startRendering();

  // getChannelData(0) is mono — OfflineAudioContext was created with 1 channel.
  return new Float32Array(resampled.getChannelData(0));
}

// ─── Confidence scaling ───────────────────────────────────────────────────────

/**
 * Converts a raw model probability (0–1) to a display-friendly confidence.
 *
 * Low-confidence predictions are penalised slightly so the UI doesn't
 * show "87% confident" for a 5-word transcript that barely triggered the model.
 *
 * Applies a logarithmic squish: confidence = sqrt(raw * 0.95)
 * This keeps high-confidence scores near 1.0 while reducing low scores.
 */
export function scaleConfidence(rawProbability: number): number {
  return Math.sqrt(Math.min(rawProbability, 1.0) * 0.95);
}

// ─── Silence detection ────────────────────────────────────────────────────────

/**
 * Returns true if the audio samples are effectively silent.
 *
 * Used to short-circuit transcription + analysis on empty recordings,
 * which would otherwise produce garbled Whisper outputs.
 *
 * Computes RMS amplitude; considers < 0.001 as silence.
 */
export function isSilent(samples: Float32Array): boolean {
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += (samples[i] ?? 0) ** 2;
  }
  const rms = Math.sqrt(sumSq / samples.length);
  return rms < 0.001;
}
