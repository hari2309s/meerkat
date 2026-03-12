/**
 * @meerkat/analyzer — constants
 *
 * Model IDs, cache names, and tuning constants.
 * All model identifiers reference Hugging Face Hub paths — transformers.js
 * fetches and caches them in the browser's OPFS (Origin Private File System).
 */

/**
 * Whisper tiny (English) — ~75MB WASM build.
 * Cached in browser OPFS after first load; subsequent loads are instant.
 *
 * Using the quantised (int8) variant for minimal memory footprint.
 */
export const TRANSCRIPTION_MODEL_ID = "onnx-community/whisper-tiny.en" as const;

/**
 * DistilBERT fine-tuned on SST-2 sentiment classification.
 * Binary positive/negative sentiment — maps directly to valence.
 * Size: ~67MB ONNX (q8 quantised).
 *
 * Output: POSITIVE or NEGATIVE label + score (0–1 probability).
 * Valence mapping: POSITIVE → +score, NEGATIVE → -score.
 *
 * Replaces the previous 7-class emotion model with a more accurate
 * binary sentiment model per the multi-modal analysis plan.
 */
export const EMOTION_MODEL_ID =
  "Xenova/distilbert-base-uncased-finetuned-sst-2-english" as const;

/** Minimum transcript length (chars) before running text sentiment. */
export const MIN_TRANSCRIPT_LENGTH = 3;

/**
 * Valence/arousal defaults for the 3-class mood system.
 * Used when mapping fused valence to a mood label's dimensional representation.
 *
 * Sourced from the Russell circumplex model of affect (1980).
 */
export const MOOD_DIMENSIONS: Record<
  string,
  { valence: number; arousal: number }
> = {
  positive: { valence: 0.75, arousal: 0.5 },
  negative: { valence: -0.65, arousal: 0.3 },
  neutral: { valence: 0.0, arousal: 0.0 },
};

/**
 * Valence thresholds for 3-class mood categorisation.
 * Per the multi-modal analysis plan:
 *   Positive: valence > 0.3
 *   Negative: valence < -0.3
 *   Neutral:  -0.3 ≤ valence ≤ 0.3
 */
export const MOOD_VALENCE_THRESHOLDS = {
  positiveMin: 0.3,
  negativeMax: -0.3,
} as const;

/**
 * Arousal thresholds for 9-tone quadrant mapping (Russell circumplex).
 *
 * High arousal (>0.6):  energetic | tense | animated
 * Low arousal (<0.4):   calm | subdued | monotone
 * Mid arousal (0.4–0.6): pleasant | serious | conversational
 */
export const TONE_THRESHOLDS = {
  /** Below this absolute valence → considered valence-neutral for tone */
  neutralValence: 0.3,
  /** Below this arousal → low-energy tone category */
  lowArousal: 0.4,
  /** Above this arousal → high-energy tone category */
  highArousal: 0.6,
} as const;

/** Whisper max audio clip length to process in one pass (seconds). */
export const MAX_AUDIO_SECONDS = 30;

/** Sample rate Whisper expects (16kHz). */
export const WHISPER_SAMPLE_RATE = 16_000;
