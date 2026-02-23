// ─── @meerkat/voice types ────────────────────────────────────────────────────

/**
 * State machine phases for useVoiceRecorder.
 *
 *   idle → requesting → recording → stopping → preview → saving → done
 *                ↓                                  ↓
 *              error ←──────────────────────────── error
 */
export type RecorderPhase =
  | "idle"
  | "requesting" // waiting for mic permission
  | "recording" // actively recording
  | "stopping" // MediaRecorder stopping, assembling blob
  | "preview" // blob ready, awaiting user action
  | "saving" // analyse → encrypt → upload → store
  | "done" // saved successfully
  | "error";

export interface RecorderState {
  phase: RecorderPhase;
  /** Elapsed seconds since recording started. Only valid during "recording". */
  seconds: number;
  /** Available after recording stops. Needed for playback preview. */
  audioBlob: Blob | null;
  /** Object URL for the audioBlob — revoke when done. */
  audioUrl: string | null;
  /** Human-readable error message when phase === "error". */
  errorMessage: string | null;
}

/**
 * Returned by useVoiceRecorder.
 */
export interface UseVoiceRecorderReturn extends RecorderState {
  start: () => Promise<void>;
  stop: () => void;
  discard: () => void;
  save: (denId: string, encryptionKey: CryptoKey) => Promise<SavedVoiceNote>;
}

/**
 * The result of a successful save — returned from saveVoiceNote and
 * the save() method on useVoiceRecorder.
 */
export interface SavedVoiceNote {
  /** The id of the VoiceMemoData entry in @meerkat/local-store. */
  memoId: string;
  /** Supabase Storage path for the encrypted blob. */
  blobRef: string;
  /** Duration in whole seconds. */
  durationSeconds: number;
  /** Analysis result — may be undefined if analysis failed gracefully. */
  analysis?: {
    transcript: string;
    mood: string;
    tone: string;
    valence: number;
    arousal: number;
    confidence: number;
    analysedAt: number;
  };
}

/**
 * Options for saveVoiceNote.
 */
export interface SaveVoiceNoteOptions {
  /** The den to save the memo into. */
  denId: string;
  /** AES-GCM key from @meerkat/crypto — used to encrypt the blob. */
  encryptionKey: CryptoKey;
  /** A function that uploads an encrypted blob and returns its storage path. */
  uploadEncryptedBlob: (encryptedData: string, iv: string) => Promise<string>;
  /** If true, analysis errors are swallowed — the memo saves without analysis. */
  allowAnalysisFailure?: boolean;
}

/**
 * State for useVoicePlayer.
 */
export interface PlayerState {
  isPlaying: boolean;
  /** Current playback position in seconds. */
  currentSeconds: number;
  /** Total duration in seconds (0 until metadata loaded). */
  durationSeconds: number;
  /** 0–1 progress ratio. */
  progress: number;
  isLoading: boolean;
  error: string | null;
}

export interface UseVoicePlayerReturn extends PlayerState {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  togglePlayPause: () => void;
}
