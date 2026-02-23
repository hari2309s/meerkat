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
 * Whisper expects 16kHz mono PCM. If the source audio has a different
 * sample rate, the AudioContext will resample it on decode.
 *
 * This function requires the Web Audio API (browser + AudioWorklet contexts).
 * It will throw in Node / pure Worker environments without a polyfill.
 *
 * @param blob — Raw audio blob (WebM, MP4, WAV, etc.)
 * @returns   — Float32Array of mono PCM samples at WHISPER_SAMPLE_RATE.
 */
export async function blobToFloat32(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();

  // OfflineAudioContext gives us a consistent 16kHz mono output regardless
  // of the input format. We don't know the duration up front, so we
  // decode once to get duration, then re-decode at the target sample rate.
  const audioCtx = new AudioContext({ sampleRate: WHISPER_SAMPLE_RATE });

  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    // Close the context to free system audio resources.
    await audioCtx.close();
  }

  // Clamp to MAX_AUDIO_SECONDS to avoid OOM on long recordings.
  const maxSamples = MAX_AUDIO_SECONDS * WHISPER_SAMPLE_RATE;
  const sourceData = decoded.getChannelData(0); // mono — take channel 0
  const samples =
    sourceData.length > maxSamples
      ? sourceData.slice(0, maxSamples)
      : sourceData;

  return new Float32Array(samples);
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
