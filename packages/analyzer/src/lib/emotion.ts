/**
 * @meerkat/analyzer — emotion classification
 *
 * On-device text → emotion/mood classification using a distilled ONNX model.
 *
 * Input:  transcript string
 * Output: EmotionResult — mood label, valence, arousal, tone, confidence
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Privacy guarantee
 * ──────────────────────────────────────────────────────────────────────────────
 * Text is never sent to a server. The ONNX model runs locally via WASM.
 * No network request is made during classification.
 */

import { getEmotionPipeline } from "./model-registry";
import {
  normaliseMoodLabel,
  moodToDimensions,
  deriveTone,
  scaleConfidence,
} from "../utils";
import { MIN_TRANSCRIPT_LENGTH } from "../constants";
import type { EmotionResult, ModelProgressCallback } from "../types";

// ─── Raw model output shape ───────────────────────────────────────────────────

interface RawClassification {
  label: string;
  score: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classifies the emotional content of a text string.
 *
 * Returns `null` if the transcript is too short to classify meaningfully.
 *
 * The first call will load the model (~40MB, cached in OPFS afterwards).
 *
 * @param text       — Transcript or any text to classify.
 * @param onProgress — Optional model download progress callback.
 *
 * @example
 * ```ts
 * const result = await classifyEmotion("I'm really excited about this!");
 * // { mood: "happy", tone: "energetic", valence: 0.8, arousal: 0.6, confidence: 0.91 }
 * ```
 */
export async function classifyEmotion(
  text: string,
  onProgress?: ModelProgressCallback,
): Promise<EmotionResult | null> {
  const trimmed = text.trim();

  // Bail out on very short text — the model produces noise on single words.
  if (trimmed.length < MIN_TRANSCRIPT_LENGTH) {
    return null;
  }

  const pipe = await getEmotionPipeline(onProgress);

  // The text-classification pipeline returns an array of { label, score } objects,
  // sorted by score descending. We take the top result.
  const raw = (await pipe(trimmed)) as
    | RawClassification[]
    | RawClassification[][];

  // Flatten: some pipeline versions wrap in an extra array.
  const results: RawClassification[] = Array.isArray(raw[0])
    ? (raw as RawClassification[][])[0]!
    : (raw as RawClassification[]);

  if (!results || results.length === 0) {
    return buildNeutralResult();
  }

  const top = results[0]!;
  const mood = normaliseMoodLabel(top.label);
  const { valence, arousal } = moodToDimensions(mood);
  const tone = deriveTone(valence, arousal);
  const confidence = scaleConfidence(top.score);

  return { mood, tone, valence, arousal, confidence };
}

/**
 * Returns an EmotionResult with all values set to neutral/zero.
 * Used when transcription produced no usable text.
 */
export function buildNeutralResult(): EmotionResult {
  return {
    mood: "neutral",
    tone: "neutral",
    valence: 0,
    arousal: 0,
    confidence: 0,
  };
}
