export type MessageType = "text" | "voice" | "image" | "document";

export interface Message {
  id: string;
  den_id: string;
  user_id: string;
  type: MessageType;
  content: string | null;
  voice_url: string | null;
  voice_duration: number | null;
  created_at: string;
  sender?: { full_name: string | null; email: string };
  /**
   * On-device analysis result, present on voice messages after
   * @meerkat/analyzer has run. Stored in the local Yjs doc, not Supabase.
   */
  analysis?: {
    transcript: string;
    mood: MoodLabel;
    tone: ToneLabel;
    valence: number;
    arousal: number;
    confidence: number;
    analysedAt: number; // Unix ms
  };
}

/**
 * Discrete mood labels from @meerkat/analyzer.
 * Must be kept in sync with MoodLabel in packages/analyzer/src/types.ts.
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
 * Tone labels derived from valence + arousal dimensions (Russell circumplex).
 * Must be kept in sync with ToneLabel in packages/analyzer/src/types.ts.
 *
 * Note: the previous ToneLabel values ("formal", "casual", "assertive", etc.)
 * were server-side labels from the old mood-analyzer package and did not
 * correspond to what the on-device model produces. These are the correct values.
 */
export type ToneLabel =
  | "positive"
  | "negative"
  | "neutral"
  | "energetic"
  | "calm"
  | "tense";

/**
 * @deprecated Use AnalysisResult from @meerkat/analyzer instead.
 * Kept temporarily for any code that still references it.
 * analysedAt is now number (Unix ms), not string.
 */
export interface VoiceAnalysisResult {
  mood: MoodLabel;
  tone: ToneLabel;
  confidence: number;
  analysedAt: number;
}
