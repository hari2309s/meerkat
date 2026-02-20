// ─── Shared types used across den components ──────────────────────────────────

export interface Den {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
}

export interface DenMember {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profiles?: { full_name: string | null; email: string };
}

export type MessageType = "text" | "voice" | "image" | "document";

export interface Message {
  id: string;
  den_id: string;
  user_id: string;
  type: MessageType;
  content: string | null;        // text content or null for voice/media
  voice_url: string | null;      // storage URL for voice notes
  voice_duration: number | null; // seconds
  created_at: string;
  sender?: { full_name: string | null; email: string };
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
