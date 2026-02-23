// ─── presets.ts ──────────────────────────────────────────────────────────────
//
// The four named key presets from the dev plan.
// Each maps to a fixed scope configuration.
//
// | Preset     | Namespaces                                    | read | write | offline |
// |------------|-----------------------------------------------|------|-------|---------|
// | come-over  | sharedNotes + voiceThread + presence          | ✓    | ✓     | ✗       |
// | letterbox  | dropbox                                       | ✗    | ✓     | ✓       |
// | house-sit  | sharedNotes + voiceThread + dropbox + presence| ✓    | ✓     | ✓       |
// | peek       | sharedNotes + presence                        | ✓    | ✗     | ✗       |

import type { KeyScope, KeyType } from "../types";

export interface KeyPreset {
  keyType: KeyType;
  label: string;
  description: string;
  scope: KeyScope;
}

export const KEY_PRESETS: Record<Exclude<KeyType, "custom">, KeyPreset> = {
  "come-over": {
    keyType: "come-over",
    label: "Come Over",
    description:
      "Real-time read & write access to shared notes and voice. Live only.",
    scope: {
      namespaces: ["sharedNotes", "voiceThread", "presence"],
      read: true,
      write: true,
      offline: false,
    },
  },
  letterbox: {
    keyType: "letterbox",
    label: "Letterbox",
    description:
      "Leave voice notes or drops when you're not home. Works offline.",
    scope: {
      namespaces: ["dropbox"],
      read: false,
      write: true,
      offline: true,
    },
  },
  "house-sit": {
    keyType: "house-sit",
    label: "House-sit",
    description:
      "Full access including dropbox. Works offline. Trusted long-term access.",
    scope: {
      namespaces: ["sharedNotes", "voiceThread", "dropbox", "presence"],
      read: true,
      write: true,
      offline: true,
    },
  },
  peek: {
    keyType: "peek",
    label: "Peek",
    description: "Read-only access to shared notes. No changes, live only.",
    scope: {
      namespaces: ["sharedNotes", "presence"],
      read: true,
      write: false,
      offline: false,
    },
  },
};

/**
 * Returns the default human-readable label for a given key type.
 * Used when no custom label is supplied.
 */
export function defaultLabel(keyType: Exclude<KeyType, "custom">): string {
  return KEY_PRESETS[keyType].label;
}
