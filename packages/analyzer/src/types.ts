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

// ─── Analysis result ──────────────────────────────────────────────────────────

/**
 * The complete on-device analysis result for a voice note.
 *
 * All fields are populated by analyzeVoice(). Individual fields can also
 * be obtained via the lower-level transcribe() and classifyEmotion() calls
 * if you want to pipeline them separately.
 */
export interface AnalysisResult {
  /** Whisper-WASM transcript of the audio. */
  transcript: string;
  /** Discrete mood label from the emotion classifier. */
  mood: MoodLabel;
  /** Qualitative tone derived from valence + arousal. */
  tone: ToneLabel;
  /**
   * Valence — how positive (1.0) or negative (-1.0) the emotion is.
   * Range: -1.0 to 1.0
   */
  valence: number;
  /**
   * Arousal — how high-energy (1.0) or low-energy (0.0) the emotion is.
   * Range: 0.0 to 1.0
   */
  arousal: number;
  /** Model confidence in the mood classification. Range: 0.0 to 1.0 */
  confidence: number;
  /** Unix ms timestamp of when the analysis completed. */
  analysedAt: number;
}

/**
 * The result of emotion classification alone (without transcription).
 */
export interface EmotionResult {
  mood: MoodLabel;
  tone: ToneLabel;
  valence: number;
  arousal: number;
  confidence: number;
}

// ─── Model loading state ──────────────────────────────────────────────────────

/**
 * Granular loading status for each model component.
 * Used by the UI to show a one-time "downloading models" progress indicator.
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
  /**
   * Language hint for Whisper. Defaults to "en".
   * Pass "auto" to let the model detect the language.
   */
  language?: string;
  /**
   * Progress callback for model loading.
   * Called once during the first analyzeVoice() or preloadModels() call.
   */
  onProgress?: ModelProgressCallback;
}
