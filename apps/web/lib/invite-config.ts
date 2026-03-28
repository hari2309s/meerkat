/**
 * Shared invite / DenKey configuration constants.
 * Used by both the invite modal (host side) and the invite acceptance page (visitor side).
 */

import type { KeyType } from "@meerkat/keys";

// ── Key type — visitor-facing copy ───────────────────────────────────────────
// Shown on the invite acceptance page.

export const KEY_TYPE_CONFIG: Record<
  string,
  { emoji: string; label: string; description: string; joinCta: string }
> = {
  "house-sit": {
    emoji: "🏠",
    label: "House-sit",
    description:
      "Full read & write access, even offline. You're a trusted member here.",
    joinCta: "Accept and enter den",
  },
  "come-over": {
    emoji: "👋",
    label: "Come Over",
    description:
      "Read and write together in real-time. Access ends when the session ends.",
    joinCta: "Join the session",
  },
  peek: {
    emoji: "👀",
    label: "Peek",
    description:
      "Read everything in this den. You won't be able to make changes — like being handed a notebook to read.",
    joinCta: "View the den",
  },
  letterbox: {
    emoji: "📬",
    label: "Letterbox",
    description:
      "Leave encrypted messages even when they're not online. They'll collect them next time they open their den.",
    joinCta: "Start dropping messages",
  },
};

export const DEFAULT_KEY_TYPE_CONFIG = KEY_TYPE_CONFIG["house-sit"]!;

// ── Key type — host-facing selector options ───────────────────────────────────
// Shown in the invite modal when the host picks an access level.

export const KEY_TYPE_OPTIONS: {
  value: Exclude<KeyType, "custom">;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    value: "house-sit",
    label: "House-sit",
    description: "Full access, offline capable. Best for trusted members.",
    emoji: "🏠",
  },
  {
    value: "come-over",
    label: "Come Over",
    description: "Real-time read & write. Live sessions only.",
    emoji: "👋",
  },
  {
    value: "peek",
    label: "Peek",
    description: "Read-only access to shared notes. No changes.",
    emoji: "👀",
  },
  {
    value: "letterbox",
    label: "Letterbox",
    description: "Drop messages when you're not home. Works offline.",
    emoji: "📬",
  },
];

// ── Sender guidance per key type ─────────────────────────────────────────────

export const SENDER_GUIDANCE: Record<Exclude<KeyType, "custom">, string> = {
  "house-sit":
    "Best for family members, long-term collaborators, people you fully trust. They can read, write, and work offline. Treat this like giving someone a key to your home.",
  "come-over":
    "Best for working together right now — a shared writing session, a quick collaboration. Access ends when the session ends. Nothing persists after they leave.",
  peek: "Best for sharing notes with someone who just needs to read — a family member checking the holiday plan, a friend reviewing something you wrote. They can't change anything.",
  letterbox:
    "Best for someone who wants to leave you messages when you're not around. You'll collect them next time you're in the den. Works even when neither of you is online.",
};

// ── Duration hints per key type ───────────────────────────────────────────────

export const DURATION_HINTS: Record<Exclude<KeyType, "custom">, string> = {
  "house-sit":
    "Suggested: No expiry or 1 year — permanent members shouldn't need to re-accept.",
  "come-over": "Suggested: 7 days — single session use, short is cleaner.",
  peek: "Suggested: 30–90 days — match how long the content stays relevant.",
  letterbox:
    "Suggested: 90 days or 1 year — async communication needs longevity.",
};

// ── Default duration per key type ─────────────────────────────────────────────
// Pre-selected when the user picks an access type.

export const DEFAULT_DURATION_MS: Record<
  Exclude<KeyType, "custom">,
  number | null
> = {
  "house-sit": null, // No expiry
  "come-over": 7 * 24 * 60 * 60 * 1000, // 7 days
  peek: 30 * 24 * 60 * 60 * 1000, // 30 days
  letterbox: 365 * 24 * 60 * 60 * 1000, // 1 year
};

// ── Duration options list ─────────────────────────────────────────────────────

export const DURATION_OPTIONS: { label: string; durationMs: number | null }[] =
  [
    { label: "7 days", durationMs: 7 * 24 * 60 * 60 * 1000 },
    { label: "30 days", durationMs: 30 * 24 * 60 * 60 * 1000 },
    { label: "90 days", durationMs: 90 * 24 * 60 * 60 * 1000 },
    { label: "1 year", durationMs: 365 * 24 * 60 * 60 * 1000 },
    { label: "No expiry", durationMs: null },
  ];
