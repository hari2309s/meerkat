export type BlockType =
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "numberedList"
  | "todo"
  | "quote"
  | "code"
  | "divider"
  | "image"
  | "voice"
  | "embed";

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  attrs?: Record<string, unknown>;
  children?: Block[];
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  workspaceId: string;
  ownerId: string;
  blocks: Block[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  iconUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CursorPosition {
  blockId: string;
  offset: number;
}

export interface UserPresence {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  color: string;
  cursor?: CursorPosition;
  lastSeen: string;
}
