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

export type ModalType =
  | "rename"
  | "invite"
  | "members"
  | "mute"
  | "leave"
  | "delete"
  | "voice_recorder"
  | null;
