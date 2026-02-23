# @meerkat/voice

Voice note lifecycle for Meerkat. Owns the full pipeline from mic to local store — nothing leaves the device unencrypted.

> **The app imports from this package for anything voice-related. Never call `@meerkat/analyzer`, `@meerkat/crypto`, or `@meerkat/local-store` directly from UI components for voice.**

---

## Pipeline

```
record (MediaRecorder)
    │
    ▼
analyzeVoice()          ← @meerkat/analyzer — Whisper + emotion, on-device
    │
    ▼
encryptBlob()           ← @meerkat/crypto — AES-GCM-256
    │
    ▼
uploadEncryptedBlob()   ← caller-provided (tRPC → Supabase Storage)
    │
    ▼
addVoiceMemo()          ← @meerkat/local-store — stored in private.ydoc (IndexedDB)
```

The raw audio blob is only ever in memory — it is never written to disk unencrypted, never sent to a server, and is released as soon as the encrypted copy is uploaded.

---

## Installation

This is a private monorepo package. Add it to your `package.json`:

```json
"@meerkat/voice": "workspace:*"
```

---

## API

### `useVoiceRecorder()`

React hook. Manages the full recording state machine.

```tsx
import { useVoiceRecorder } from "@meerkat/voice";

function RecorderButton({ denId, encryptionKey, uploadFn }) {
  const { phase, seconds, audioUrl, start, stop, discard, save } =
    useVoiceRecorder();

  if (phase === "idle") {
    return <button onClick={start}>🎙 Record</button>;
  }

  if (phase === "recording") {
    return <button onClick={stop}>⏹ Stop ({seconds}s)</button>;
  }

  if (phase === "preview") {
    return (
      <div>
        <audio src={audioUrl} controls />
        <button onClick={() => save(denId, encryptionKey, uploadFn)}>
          Send
        </button>
        <button onClick={discard}>Discard</button>
      </div>
    );
  }

  if (phase === "saving") {
    return <span>Analysing & saving…</span>;
  }

  if (phase === "error") {
    return <span>Error — try again</span>;
  }

  return null; // done
}
```

#### Phase state machine

```
idle → requesting → recording → stopping → preview → saving → done
           ↓              ↓                    ↓          ↓
         error          error                error      error
```

| Phase        | Meaning                                              |
| ------------ | ---------------------------------------------------- |
| `idle`       | Nothing happening                                    |
| `requesting` | Waiting for mic permission                           |
| `recording`  | Actively recording, `seconds` ticking                |
| `stopping`   | MediaRecorder stopping, assembling blob              |
| `preview`    | `audioBlob` + `audioUrl` ready, awaiting user action |
| `saving`     | Running analyse → encrypt → upload → store           |
| `done`       | Saved successfully                                   |
| `error`      | See `errorMessage`                                   |

---

### `useVoicePlayer()`

React hook for playing back voice memos. Works in two modes.

**Preview mode** (freshly recorded, object URL already available):

```tsx
import { useVoicePlayer } from "@meerkat/voice";

function PreviewPlayer({ audioUrl }: { audioUrl: string }) {
  const {
    isPlaying,
    progress,
    currentSeconds,
    durationSeconds,
    togglePlayPause,
  } = useVoicePlayer({ audioUrl });

  return (
    <div>
      <button onClick={togglePlayPause}>{isPlaying ? "⏸" : "▶"}</button>
      <progress value={progress} max={1} />
      <span>
        {Math.floor(currentSeconds)}s / {Math.floor(durationSeconds)}s
      </span>
    </div>
  );
}
```

**Stored memo mode** (needs decryption before playback):

```tsx
import { useVoicePlayer } from "@meerkat/voice";
import { decryptBlob, importAesKey } from "@meerkat/crypto";

function StoredMemoPlayer({ blobRef, namespaceKey }) {
  const { isPlaying, progress, isLoading, togglePlayPause } = useVoicePlayer({
    fetchUrl: async () => {
      // 1. Fetch encrypted bytes from Supabase Storage (via tRPC)
      const { data, iv } = await trpc.voice.getEncryptedBlob.query({ blobRef });
      // 2. Decrypt on-device
      const bytes = await decryptBlob(
        { alg: "AES-GCM-256", data, iv },
        namespaceKey,
      );
      // 3. Create a temporary object URL
      const blob = new Blob([bytes], { type: "audio/webm" });
      return URL.createObjectURL(blob);
    },
  });

  if (isLoading) return <span>Loading…</span>;

  return <button onClick={togglePlayPause}>{isPlaying ? "⏸" : "▶"}</button>;
}
```

---

### `saveVoiceNote()` (imperative)

Use directly in tests, server actions, or any non-React context.

```ts
import { saveVoiceNote } from "@meerkat/voice";

const saved = await saveVoiceNote(audioBlob, durationSeconds, {
  denId: user.id,
  encryptionKey: namespaceKey,
  uploadEncryptedBlob: async (data, iv) => {
    // data and iv are base64 strings
    const { blobRef } = await trpc.voice.upload.mutate({ data, iv });
    return blobRef;
  },
  allowAnalysisFailure: true, // default — saves without mood if analysis fails
});

console.log(saved.memoId); // ID in local-store
console.log(saved.blobRef); // Supabase Storage path
console.log(saved.analysis?.mood); // "happy" | "sad" | etc.
```

---

## Privacy guarantees

| What                        | Where it goes                                               |
| --------------------------- | ----------------------------------------------------------- |
| Raw audio blob              | Only in memory — never persisted unencrypted                |
| Analysis (transcript, mood) | IndexedDB via `private.ydoc` — never leaves device          |
| Encrypted audio             | Supabase Storage — server cannot decrypt                    |
| `encryptionKey`             | Never sent to server — derived from the den's namespace key |

The `uploadEncryptedBlob` function is **caller-provided** intentionally — this package has no Supabase import. The server receives only ciphertext.

---

## Integration

```ts
// Inside the app's tRPC voice router (server-side — never sees plaintext)
voice.upload.mutate(async ({ data, iv }) => {
  // data and iv are the base64 fields from EncryptedBlob
  // Store them in Supabase Storage — server cannot decrypt
  const path = `dens/${denId}/audio/${crypto.randomUUID()}.enc`;
  await supabase.storage
    .from("blobs")
    .upload(path, Buffer.from(data, "base64"), {
      contentType: "application/octet-stream",
      metadata: { iv }, // store iv alongside for retrieval
    });
  return { blobRef: path };
});
```

---

## Architecture

```
@meerkat/voice
├── saveVoiceNote()          ← core pipeline (imperative)
│
├── lib/
│   ├── save.ts              ← orchestrates analyse → encrypt → upload → store
│   ├── use-voice-recorder.ts ← React hook: state machine + mic management
│   └── use-voice-player.ts  ← React hook: audio playback + progress tracking
│
└── types.ts                 ← RecorderPhase, SavedVoiceNote, etc.
```

### Dependencies

| Package                | Used for                                         |
| ---------------------- | ------------------------------------------------ |
| `@meerkat/analyzer`    | On-device transcription + emotion classification |
| `@meerkat/crypto`      | `encryptBlob()` — AES-GCM-256 encryption         |
| `@meerkat/local-store` | `addVoiceMemo()` — IndexedDB persistence via Yjs |
| `@meerkat/types`       | Shared domain types                              |

This package has **no Supabase dependency**. The upload function is injected by the caller, keeping the server boundary clean.
