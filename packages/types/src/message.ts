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
}

export type MoodLabel =
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "neutral";

export type ToneLabel =
  | "formal"
  | "casual"
  | "assertive"
  | "empathetic"
  | "humorous"
  | "serious";

export interface VoiceAnalysisResult {
  mood: MoodLabel;
  tone: ToneLabel;
  confidence: number;
  analysedAt: string;
}
