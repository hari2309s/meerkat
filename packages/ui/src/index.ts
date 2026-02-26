// ─── Base Components ──────────────────────────────────────────────────────────
export { Button, buttonVariants, type ButtonProps } from "./components/button";
export { Input, type InputProps } from "./components/input";
export { Label } from "./components/label";

export { HoverButton } from "./components/hover-button";
export { MenuRow } from "./components/menu-row";
export { ModalShell } from "./components/modal-shell";

// ─── Meerkat Components ───────────────────────────────────────────────────────
export {
  SyncStatusBadge,
  syncStatusBadgeVariants,
  type SyncStatusBadgeProps,
  type SyncStatus,
} from "./components/sync-status-badge";

export {
  MoodBadge,
  moodBadgeVariants,
  type MoodBadgeProps,
  type MoodLabel,
} from "./components/mood-badge";

export {
  VisitorPresenceList,
  type VisitorPresenceListProps,
  type VisitorInfo,
} from "./components/visitor-presence-list";

export {
  VoiceRecorderButton,
  type VoiceRecorderButtonProps,
  type VoiceRecorderPhase,
} from "./components/voice-recorder-button";

// ─── Utilities ────────────────────────────────────────────────────────────────
export { cn } from "./lib/utils";
