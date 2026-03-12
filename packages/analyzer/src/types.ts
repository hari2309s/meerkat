/**
 * @meerkat/analyzer — types
 *
 * All types in this file represent the public contract of the on-device
 * analyzer. The app imports from @meerkat/analyzer, never from transformers.js
 * directly.
 */

// ─── Mood & tone labels ───────────────────────────────────────────────────────

/**
 * Discrete mood labels — positive, negative, or neutral valence.
 * Derived by fusing DistilBERT text sentiment and acoustic valence.
 *
 * Replacing the previous 7-class emotion labels (happy/sad/angry/…) with
 * this 3-class system per the multi-modal analysis plan. The 3-class system
 * is more accurate (88%+ vs 70-85%) and more useful for understanding context.
 */
export type MoodLabel = "positive" | "negative" | "neutral";

/**
 * Tone labels capturing the qualitative feel of the voice note.
 * Derived from the fused valence + arousal dimensions using the
 * arousal-valence quadrant mapping (Russell circumplex model, 1980).
 *
 * High arousal (>0.6):
 *   positive valence → energetic | negative valence → tense | neutral → animated
 *
 * Low arousal (<0.4):
 *   positive valence → calm | negative valence → subdued | neutral → monotone
 *
 * Mid arousal (0.4–0.6):
 *   positive valence → pleasant | negative valence → serious | neutral → conversational
 */
export type ToneLabel =
  | "energetic"
  | "tense"
  | "animated"
  | "calm"
  | "subdued"
  | "monotone"
  | "pleasant"
  | "serious"
  | "conversational";

/**
 * Contradiction type detected during fusion.
 * Indicates a discrepancy between text sentiment and acoustic prosody.
 */
export type ContradictionType = "sarcasm" | "masking" | "stress" | null;

// ─── Audio features ───────────────────────────────────────────────────────────

/**
 * Acoustic features extracted directly from the audio waveform.
 * Computed in the browser with no ML model or network dependency.
 * Included in AnalysisResult for optional display or downstream use.
 *
 * @see extractAudioFeatures in lib/audio-features.ts
 */
export interface AudioFeatures {
  /**
   * Median fundamental frequency (F0) of voiced segments in Hz.
   * Null when no voiced frames are detected (silence or whisper).
   */
  pitchMedianHz: number | null;
  /** Standard deviation of F0 across voiced frames. High → expressive speech. */
  pitchStdDev: number;
  /** Mean RMS energy across all frames, normalised 0–1. */
  energyMean: number;
  /** Standard deviation of frame-level RMS energy. High → dynamic speech. */
  energyStdDev: number;
  /** Voiced-onset rate (syllable proxy) in onsets-per-second. */
  speakingRateFPS: number;
  /** Mean spectral centroid of voiced frames in Hz. High → brighter timbre. */
  spectralCentroidHz: number;
  /** Mean 85th-percentile spectral rolloff of voiced frames in Hz. */
  spectralRolloffHz: number;
  /** Fraction of frames classified as voiced (0–1). */
  voicedFraction: number;
  /**
   * Relative pitch period variation (jitter).
   * pitchStdDev / pitchMedianHz — proxy for voice tremor.
   * > 0.02 indicates elevated jitter (stress, tension, tremor).
   * 0 when no pitched frames are detected.
   */
  jitter: number;
  /**
   * Relative amplitude variation between frames (shimmer).
   * energyStdDev / energyMean — proxy for voice shakiness.
   * > 0.05 indicates elevated shimmer (emotional distress, trembling).
   * 0 for silent audio.
   */
  shimmer: number;
  /**
   * Fraction of total duration occupied by unvoiced/silent frames.
   * High → many long pauses (tired, hesitant, stressed).
   * Range: 0–1.
   */
  pauseDuration: number;
}

// ─── Analysis result ──────────────────────────────────────────────────────────

/**
 * The complete on-device analysis result for a voice note.
 *
 * Produced by the three-stream pipeline in analyzeVoice():
 *   Stream 1: Acoustic features (pitch, energy, jitter, shimmer…)
 *   Stream 2: Acoustic mood signal (rule-based valence from features)
 *   Stream 3: Text sentiment (DistilBERT binary sentiment on Whisper transcript)
 *   Fusion: weighted combination with contradiction detection
 *
 * All fields are populated by analyzeVoice(). Individual fields can also
 * be obtained via the lower-level transcribe(), classifyEmotion(), and
 * extractAudioFeatures() calls if you want to pipeline them separately.
 */
export interface AnalysisResult {
  /** Whisper-WASM transcript of the audio. Empty string if audio was silent. */
  transcript: string;
  /** Discrete mood label — fused from text sentiment and acoustic signal. */
  mood: MoodLabel;
  /** Qualitative tone derived from fused valence + arousal quadrant. */
  tone: ToneLabel;
  /**
   * Valence — how positive (1.0) or negative (-1.0) the mood is.
   * Fused from DistilBERT text sentiment output and acoustic feature analysis.
   * Range: -1.0 to 1.0
   */
  valence: number;
  /**
   * Arousal — how high-energy (1.0) or low-energy (0.0) the mood is.
   * Primarily derived from acoustic features (energy, pitch, speaking rate).
   * Range: 0.0 to 1.0
   */
  arousal: number;
  /**
   * Confidence in the final mood classification (0–1).
   * Starts at 50%, increases when signals agree, decreases for contradictions.
   * Higher when both signals agree; lower when they diverge.
   */
  confidence: number;
  /**
   * Natural language description of the mood analysis.
   * E.g. "Positive mood, energetic tone, high pitched, speaking quickly"
   * E.g. "Neutral mood, tense tone, with long pauses (voice shows tension)"
   */
  description: string;
  /**
   * Contradiction detected between text sentiment and acoustic prosody.
   * - sarcasm: positive words + negative prosody
   * - masking: negative words + positive/neutral prosody
   * - stress: neutral words + high jitter/shimmer
   * - null: no contradiction detected
   */
  contradiction: ContradictionType;
  /**
   * Raw acoustic features extracted from the audio waveform.
   * Always present unless audio could not be decoded.
   */
  audioFeatures?: AudioFeatures;
  /** Unix ms timestamp of when the analysis completed. */
  analysedAt: number;
}

/**
 * The result of text-based sentiment classification alone (without transcription).
 * Uses DistilBERT SST-2 for binary positive/negative sentiment.
 */
export interface EmotionResult {
  mood: MoodLabel;
  tone: ToneLabel;
  valence: number;
  arousal: number;
  confidence: number;
}

/**
 * Mood/emotion signal inferred from acoustic features alone.
 * Used internally by the fusion step; also exported for advanced use.
 */
export interface AudioMoodSignal {
  mood: MoodLabel;
  tone: ToneLabel;
  valence: number;
  arousal: number;
  /**
   * Confidence in the audio-only estimate.
   * Generally lower than text confidence for longer speech;
   * becomes the primary signal when transcript is empty.
   */
  confidence: number;
}

// ─── Model loading state ──────────────────────────────────────────────────────

/**
 * Granular loading status for each model component.
 * Used by the UI to show a one-time "downloading models" progress indicator.
 *
 * Note: audio feature extraction is always available — it requires no model
 * and does not have a load status.
 */
export type ModelLoadStatus = "idle" | "loading" | "ready" | "error";

export interface ModelStatus {
  /** Whisper transcription model (WASM). */
  transcription: ModelLoadStatus;
  /** Emotion classification model (ONNX). */
  emotion: ModelLoadStatus;
}

// ─── Progress callback ────────────────────────────────────────────────────────

/**
 * Progress callback fired during model download / WASM initialisation.
 * Used to drive the one-time model download progress indicator.
 */
export interface ModelProgressEvent {
  /** Which model is loading. */
  model: "transcription" | "emotion";
  /** Download progress 0–100, or null if indeterminate. */
  progress: number | null;
  /** Human-readable status message. */
  status: string;
}

export type ModelProgressCallback = (event: ModelProgressEvent) => void;

// ─── Analyzer options ─────────────────────────────────────────────────────────

export interface AnalyzerOptions {
  /** BCP-47 language hint for Whisper (default: "en"). */
  language?: string;
  /** Progress callback fired during model loading. */
  onProgress?: ModelProgressCallback;
}
