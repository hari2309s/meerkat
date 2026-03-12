/**
 * @meerkat/analyzer — text sentiment classification
 *
 * On-device text → sentiment/mood classification using DistilBERT SST-2.
 * Binary positive/negative sentiment maps directly to valence score.
 *
 * Input:  transcript string
 * Output: EmotionResult — mood label, valence, arousal, tone, confidence
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Privacy guarantee
 * ──────────────────────────────────────────────────────────────────────────────
 * Text is never sent to a server. The ONNX model runs locally via WASM.
 * No network request is made during classification.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Model: Xenova/distilbert-base-uncased-finetuned-sst-2-english
 * ──────────────────────────────────────────────────────────────────────────────
 * Binary SST-2 sentiment classifier.
 * Output labels: POSITIVE or NEGATIVE with a 0–1 probability score.
 * Valence mapping: POSITIVE → +score, NEGATIVE → -score
 * Arousal: not available from text alone (set to 0; dominated by audio signal)
 */

import { getEmotionPipeline } from "./model-registry";
import { deriveTone, classifyMoodFromValence } from "../utils";
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
 * Classifies the sentiment of a text string using DistilBERT SST-2.
 *
 * Returns `null` if the transcript is too short to classify meaningfully.
 *
 * The first call will load the model (~67MB, cached in OPFS afterwards).
 * Output valence: POSITIVE → +score, NEGATIVE → -score
 * Arousal is set to 0 — DistilBERT gives no arousal information.
 * The fusion layer uses audio features to fill in arousal.
 *
 * @param text       — Transcript or any text to classify.
 * @param onProgress — Optional model download progress callback.
 *
 * @example
 * ```ts
 * const result = await classifyEmotion("I'm really excited about this!");
 * // { mood: "positive", tone: "pleasant", valence: 0.96, arousal: 0, confidence: 0.96 }
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
  const labelUpper = top.label.toUpperCase();

  // DistilBERT SST-2 outputs POSITIVE or NEGATIVE.
  // Map to valence: POSITIVE → +score, NEGATIVE → -score
  let valence: number;
  if (labelUpper === "POSITIVE" || labelUpper === "LABEL_1") {
    valence = top.score;
  } else {
    // NEGATIVE or LABEL_0
    valence = -top.score;
  }

  const mood = classifyMoodFromValence(valence);
  // DistilBERT gives no arousal signal — audio features dominate arousal.
  const arousal = 0;
  const tone = deriveTone(valence, arousal);
  const confidence = top.score;

  return { mood, tone, valence, arousal, confidence };
}

/**
 * Returns an EmotionResult with all values set to neutral/zero.
 * Used as a safe fallback when classification fails or input is empty.
 */
export function buildNeutralResult(): EmotionResult {
  return {
    mood: "neutral",
    tone: "conversational",
    valence: 0,
    arousal: 0,
    confidence: 0,
  };
}
