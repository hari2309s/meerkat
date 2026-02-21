// Shared types for the settings page

export interface SettingsUser {
  id: string;
  name: string;
  preferredName: string;
  email: string;
  notifPrefs?: NotifPrefs;
}

export interface NotifPrefs {
  emailActivity: boolean;
  emailDigest: boolean;
  pushMessages: boolean;
  pushMentions: boolean;
}

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

export type Section = "profile" | "notifications" | "appearance" | "security";
