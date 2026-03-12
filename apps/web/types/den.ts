// ─── Shared types used across den components ──────────────────────────────────

export interface Den {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  members?: [{ count: number }];
}

export interface DenMember {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profiles?: {
    full_name: string | null;
    preferred_name?: string | null;
    email: string;
  };
}

export type MessageType = "text" | "voice" | "image" | "document";

/**
 * Discrete mood labels from @meerkat/analyzer.
 * Must be kept in sync with MoodLabel in packages/analyzer/src/types.ts.
 *
 * 3-class system replaces previous 7-class (happy/sad/angry/…) per the
 * multi-modal analysis plan.
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

export interface Message {
  id: string;
  den_id: string;
  user_id: string;
  type: MessageType;
  content: string | null; // text content or null for pure media
  voice_url: string | null; // storage URL for voice notes
  voice_duration: number | null; // seconds
  // Optional attachment fields for image/document messages
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  attachment_data?: string | null; // base64 data for local-first storage
  created_at: string;
  sender?: {
    full_name: string | null;
    preferred_name?: string | null;
    email: string;
  };
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

export type ModalType =
  | "rename"
  | "invite"
  | "members"
  | "mute"
  | "leave"
  | "delete"
  | "voice_recorder"
  | "text_message"
  | "image_picker"
  | "document_picker"
  | null;
