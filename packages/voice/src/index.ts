/**
 * @meerkat/voice
 *
 * Voice note lifecycle for Meerkat.
 *
 * Owns the full pipeline:
 *   record → analyse on-device → encrypt → upload (encrypted) → store in Yjs
 *
 * Nothing leaves the device unencrypted. The raw audio blob is only ever
 * seen by the on-device analyser and encryptBlob() — neither sends it anywhere.
 *
 * Architecture
 * ────────────
 *
 *   useVoiceRecorder()  ← React hook: manages mic, state machine, triggers save
 *       └── saveVoiceNote()  ← core pipeline function (also usable imperative)
 *             ├── analyzeVoice()      ← @meerkat/analyzer (on-device)
 *             ├── encryptBlob()       ← @meerkat/crypto (AES-GCM-256)
 *             ├── uploadEncryptedBlob ← caller-provided (tRPC → Supabase Storage)
 *             └── addVoiceMemo()      ← @meerkat/local-store (IndexedDB Yjs)
 *
 *   useVoicePlayer()    ← React hook: audio playback with progress tracking
 *
 * Usage (typical UI flow)
 * ──────────────────────
 *
 *   const recorder = useVoiceRecorder()
 *
 *   // User taps record
 *   await recorder.start()
 *
 *   // User taps stop
 *   recorder.stop()
 *
 *   // Preview: recorder.audioUrl is now set
 *   const player = useVoicePlayer({ audioUrl: recorder.audioUrl })
 *
 *   // User confirms send
 *   const saved = await recorder.save(denId, namespaceKey, async (data, iv) => {
 *     return trpc.voice.upload.mutate({ data, iv })  // returns blobRef
 *   })
 *
 * Usage (imperative — e.g. in a server action or test)
 * ────────────────────────────────────────────────────
 *
 *   const saved = await saveVoiceNote(audioBlob, durationSeconds, {
 *     denId,
 *     encryptionKey: namespaceKey,
 *     uploadEncryptedBlob: async (data, iv) => uploadToStorage(data, iv),
 *   })
 */

// ─── Core pipeline function ───────────────────────────────────────────────────
export { saveVoiceNote } from "./lib/save";

// ─── React hooks ─────────────────────────────────────────────────────────────
export { useVoiceRecorder } from "./lib/use-voice-recorder";
export { useVoicePlayer } from "./lib/use-voice-player";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  RecorderPhase,
  RecorderState,
  UseVoiceRecorderReturn,
  SavedVoiceNote,
  SaveVoiceNoteOptions,
  PlayerState,
  UseVoicePlayerReturn,
} from "./types";
