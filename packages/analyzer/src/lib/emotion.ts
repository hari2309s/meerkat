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

// ─── Output normalisation ─────────────────────────────────────────────────────

/**
 * Normalise transformers.js text-classification output to a flat
 * RawClassification[] regardless of library version.
 *
 * @huggingface/transformers changed the output shape between v2 and v3:
 *
 *   v2  pipe(string)              → RawClassification[]
 *   v3  pipe(string)              → RawClassification          ← BREAKS .replace()
 *   v3  pipe([string],{top_k:N})  → RawClassification[][]      ← correct path
 *
 * We always call pipe([string], { top_k: null }) (see below) to stay on the
 * v3 batched path, but normalise here defensively to handle any shape.
 */
function normaliseClassificationOutput(raw: unknown): RawClassification[] {
  if (!raw) return [];

  // v3 batched: RawClassification[][] — outer array is the batch
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    return (raw as RawClassification[][])[0] ?? [];
  }

  // v2 / v3 flat: RawClassification[] with { label, score } items
  if (
    Array.isArray(raw) &&
    raw.length > 0 &&
    typeof (raw[0] as RawClassification).label === "string"
  ) {
    return raw as RawClassification[];
  }

  // v3 single-item fallback: bare RawClassification object
  if (typeof (raw as RawClassification).label === "string") {
    return [raw as RawClassification];
  }

  return [];
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
  // Coerce to plain string. The tokenizer calls .replace() on its input
  // internally — passing anything other than a string throws
  // "TypeError: e.replace is not a function" deep inside transformers.js.
  const str = typeof text === "string" ? text : String(text ?? "");
  const trimmed = str.trim();

  // Bail out on very short text — the model produces noise on single words.
  if (trimmed.length < MIN_TRANSCRIPT_LENGTH) {
    return null;
  }

  const pipe = await getEmotionPipeline(onProgress);

  // ─── Critical: use array input + top_k to stay on the v3 batched path ───
  //
  // In @huggingface/transformers v3, calling pipe(string) routes through a
  // code path where the pipeline wraps the input in an object before passing
  // it to the tokenizer. The tokenizer then calls .replace() on that object
  // instead of a string → TypeError.
  //
  // Calling pipe([string], { top_k: null }) forces the batched path which
  // always receives a plain string[], avoiding the bug. top_k: null returns
  // all labels sorted by score descending (same as old v2 default).
  const raw = await (
    pipe as (
      input: string[],
      options: { top_k: number | null },
    ) => Promise<unknown>
  )([trimmed], { top_k: null });

  const results = normaliseClassificationOutput(raw);

  if (results.length === 0) {
    return buildNeutralResult();
  }

  // Results are sorted descending by score — take the top prediction.
  const top = results[0]!;
  const mood = normaliseMoodLabel(top.label);
  const { valence, arousal } = moodToDimensions(mood);
  const tone = deriveTone(valence, arousal);
  const confidence = scaleConfidence(top.score);

  return { mood, tone, valence, arousal, confidence };
}

/**
 * Returns an EmotionResult with all values set to neutral/zero.
 * Used as a safe fallback when classification fails or input is empty.
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
