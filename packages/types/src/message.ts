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
  // Optional attachment fields for image/document messages
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
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
    description?: string;
    contradiction?: string | null;
    analysedAt: number; // Unix ms
  };
}

/**
 * Discrete mood labels from @meerkat/analyzer.
 * Must be kept in sync with MoodLabel in packages/analyzer/src/types.ts.
 *
 * 3-class system replaces previous 7-class (happy/sad/angry/…) per the
 * multi-modal analysis plan. Higher accuracy and more useful for users.
 */
export type MoodLabel = "positive" | "negative" | "neutral";

/**
 * Tone labels derived from valence + arousal dimensions (Russell circumplex).
 * Must be kept in sync with ToneLabel in packages/analyzer/src/types.ts.
 *
 * 9-tone system per the multi-modal analysis plan:
 *   High arousal: energetic (pos) | tense (neg) | animated (neutral)
 *   Low arousal:  calm (pos) | subdued (neg) | monotone (neutral)
 *   Mid arousal:  pleasant (pos) | serious (neg) | conversational (neutral)
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
