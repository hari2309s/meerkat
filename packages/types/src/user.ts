export type UserRole = "owner" | "admin" | "member" | "viewer";

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {}

export interface SessionInfo {
  id: string;
  browser: string;
  os: string;
  device: string;
  location: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}
