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
 * Distilled emotion classifier — ~83MB ONNX (q8 quantised).
 * Fine-tuned for 7-class emotion output: anger/disgust/fear/joy/neutral/sadness/surprise.
 *
 * MicahB/emotion_text_classifier is a Transformers.js-compatible fork of the
 * original michellejieli model with proper ONNX exports (onnx/model_quantized.onnx).
 * The original michellejieli repo only has PyTorch weights — no ONNX files.
 */
export const EMOTION_MODEL_ID = "MicahB/emotion_text_classifier" as const;

/** Minimum transcript length (chars) before running emotion classification. */
export const MIN_TRANSCRIPT_LENGTH = 3;

/**
 * Valence/arousal table for each mood label.
 * Sourced from the Russell circumplex model of affect (1980).
 *
 * Used to compute the dimensional emotion values from the discrete label,
 * since the classifier outputs a label+confidence, not raw dimensions.
 */
export const MOOD_DIMENSIONS: Record<
  string,
  { valence: number; arousal: number }
> = {
  happy: { valence: 0.8, arousal: 0.6 },
  sad: { valence: -0.7, arousal: -0.4 },
  angry: { valence: -0.6, arousal: 0.8 },
  fearful: { valence: -0.6, arousal: 0.6 },
  disgusted: { valence: -0.5, arousal: 0.2 },
  surprised: { valence: 0.2, arousal: 0.8 },
  neutral: { valence: 0.0, arousal: 0.0 },
  // Aliases from some model variants
  joy: { valence: 0.8, arousal: 0.6 },
  fear: { valence: -0.6, arousal: 0.6 },
  disgust: { valence: -0.5, arousal: 0.2 },
  surprise: { valence: 0.2, arousal: 0.8 },
  sadness: { valence: -0.7, arousal: -0.4 },
  anger: { valence: -0.6, arousal: 0.8 },
};

/**
 * Derive a ToneLabel from the valence+arousal dimensions.
 *
 * Russell quadrant mapping:
 *   High valence + high arousal → energetic
 *   High valence + low arousal  → calm / positive
 *   Low valence + high arousal  → tense
 *   Low valence + low arousal   → negative
 *   Near origin                 → neutral
 */
export const TONE_THRESHOLDS = {
  /** Below this absolute valence, considered neutral */
  neutralValence: 0.15,
  /** Below this arousal, considered low-energy */
  lowArousal: 0.3,
  /** Above this arousal, considered high-energy */
  highArousal: 0.55,
} as const;

/** Whisper max audio clip length to process in one pass (seconds). */
export const MAX_AUDIO_SECONDS = 30;

/** Sample rate Whisper expects (16kHz). */
export const WHISPER_SAMPLE_RATE = 16_000;
