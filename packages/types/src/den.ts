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
  profiles?: { full_name: string | null; email: string };
}

export type MessageType = "text" | "voice" | "image" | "document";

/**
 * Mood labels produced by @meerkat/analyzer.
 * Kept in sync with MoodLabel in packages/analyzer/src/types.ts.
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
 * Tone labels derived from valence + arousal (Russell circumplex model).
 * Kept in sync with ToneLabel in packages/analyzer/src/types.ts.
 */
export type ToneLabel =
  | "positive"
  | "negative"
  | "neutral"
  | "energetic"
  | "calm"
  | "tense";

export interface Message {
  id: string;
  den_id: string;
  user_id: string;
  type: MessageType;
  content: string | null; // text content or null for voice/media
  voice_url: string | null; // storage URL for voice notes
  voice_duration: number | null; // seconds
  created_at: string;
  sender?: { full_name: string | null; email: string };
  /**
   * On-device analysis result — present on voice messages once
   * @meerkat/analyzer has completed. Stored in the local Yjs doc.
   * undefined when analysis is still running or failed gracefully.
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

export type ModalType =
  | "rename"
  | "invite"
  | "members"
  | "mute"
  | "leave"
  | "delete"
  | "voice_recorder"
  | null;
