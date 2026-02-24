/**
 * @meerkat/analyzer — types
 *
 * All types in this file represent the public contract of the on-device
 * analyzer. The app imports from @meerkat/analyzer, never from transformers.js
 * directly.
 */

// ─── Mood & emotion labels ────────────────────────────────────────────────────

/**
 * Discrete mood labels emitted by the emotion classifier.
 * Mapped from the underlying model's output labels.
 */
export type MoodLabel =
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "neutral";

/**
 * Tone labels capturing the qualitative feel of the voice note.
 * Derived from valence + arousal dimensions.
 */
export type ToneLabel =
  | "positive"
  | "negative"
  | "neutral"
  | "energetic"
  | "calm"
  | "tense";

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
}

// ─── Analysis result ──────────────────────────────────────────────────────────

/**
 * The complete on-device analysis result for a voice note.
 *
 * Produced by the dual-signal pipeline in analyzeVoice():
 *   – Acoustic features (always computed, no model needed)
 *   – Text-based emotion classification (Whisper + ONNX)
 *   – Fusion of both signals into final mood/tone/valence/arousal
 *
 * All fields are populated by analyzeVoice(). Individual fields can also
 * be obtained via the lower-level transcribe(), classifyEmotion(), and
 * extractAudioFeatures() calls if you want to pipeline them separately.
 */
export interface AnalysisResult {
  /** Whisper-WASM transcript of the audio. Empty string if audio was silent. */
  transcript: string;
  /** Discrete mood label — fused from text classification and audio signal. */
  mood: MoodLabel;
  /** Qualitative tone derived from fused valence + arousal. */
  tone: ToneLabel;
  /**
   * Valence — how positive (1.0) or negative (-1.0) the emotion is.
   * Fused from text classifier output and acoustic feature analysis.
   * Range: -1.0 to 1.0
   */
  valence: number;
  /**
   * Arousal — how high-energy (1.0) or low-energy (0.0) the emotion is.
   * Fused from text classifier output and acoustic feature analysis.
   * Range: 0.0 to 1.0
   */
  arousal: number;
  /**
   * Confidence in the final mood classification (0–1).
   * Reflects agreement between audio and text signals.
   * Higher when both signals agree; lower when they diverge.
   */
  confidence: number;
  /**
   * Raw acoustic features extracted from the audio waveform.
   * Always present unless audio could not be decoded.
   * Useful for display (e.g. pitch visualisation) or custom fusion logic.
   */
  audioFeatures?: AudioFeatures;
  /** Unix ms timestamp of when the analysis completed. */
  analysedAt: number;
}

/**
 * The result of text-based emotion classification alone (without transcription).
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
