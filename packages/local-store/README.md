# @meerkat/local-store

Local-first storage layer for Meerkat. Owns the two Yjs documents (`private.ydoc` + `shared.ydoc`), persists them to IndexedDB via `y-indexeddb`, and provides React hooks and imperative functions for all content types.

> **All reads in the app go through this package — never directly to Supabase for content.**

---

## Architecture

Each den is two Yjs documents:

| Document       | Contents                                    | Who can access                                            |
| -------------- | ------------------------------------------- | --------------------------------------------------------- |
| `private.ydoc` | notes, voiceMemos, moodJournal, settings    | Device owner only — never leaves the device               |
| `shared.ydoc`  | sharedNotes, voiceThread, dropbox, presence | Served over WebRTC to visitors with valid capability keys |

Both documents are persisted to IndexedDB. On first load the den opens from IndexedDB instantly — no loading state for offline reads.

```
private.ydoc (IndexedDB)
  ├── notes         Y.Map<NoteData>
  ├── voiceMemos    Y.Array<VoiceMemoData>
  ├── moodJournal   Y.Array<MoodEntry>
  └── settings      Y.Map<unknown>

shared.ydoc (IndexedDB → WebRTC → visitors)
  ├── sharedNotes   Y.Map<NoteData>
  ├── voiceThread   Y.Array<VoiceMemoData>
  ├── dropbox       Y.Array<DropboxItem>
  └── presence      Y.Map<PresenceInfo>
```

---

## Installation

```bash
pnpm add @meerkat/local-store
# Peer dependencies
pnpm add yjs
```

---

## Usage

### React components (hooks)

```tsx
import {
  useAllNotes,
  useNote,
  useVoiceMemo,
  usePresence,
  useDen,
} from "@meerkat/local-store";

function NoteList({ denId }: { denId: string }) {
  const notes = useAllNotes(denId);
  return (
    <>
      {notes.map((n) => (
        <NoteCard key={n.id} note={n} />
      ))}
    </>
  );
}

function NoteDetail({ denId, noteId }: { denId: string; noteId: string }) {
  const note = useNote(denId, noteId);
  if (!note) return <Skeleton />;
  return <div>{note.content}</div>;
}
```

### Imperative (server components, background work)

```ts
import {
  openDen,
  createNote,
  updateNote,
  deleteNote,
  getAllNotes,
  searchNotes,
} from "@meerkat/local-store";

// Open (cached — safe to call multiple times)
const { privateDen, sharedDen } = await openDen(userId);

// CRUD
const note = await createNote(userId, {
  content: "First thought",
  tags: ["morning"],
});
const updated = await updateNote(userId, note.id, { content: "Revised" });
await deleteNote(userId, note.id);

// Query
const all = await getAllNotes(userId);
const results = await searchNotes(userId, {
  query: "coffee",
  tags: ["morning"],
});
```

### Visitor dropbox (write-only for visitors)

```ts
import { addToDropbox, getDropboxItems } from "@meerkat/local-store";

// Visitor side — payload should be encrypted with host's public key
await addToDropbox(hostDenId, myVisitorId, encryptedPayload);

// Host side
const drops = await getDropboxItems(myDenId);
```

### Settings

```ts
import { getSetting, setSetting } from "@meerkat/local-store";

await setSetting(denId, "theme", "dark");
const theme = await getSetting<"light" | "dark">(denId, "theme");
```

### Backup & restore

```ts
import {
  exportDen,
  importDenState,
  clearDenLocalData,
} from "@meerkat/local-store";

// Export (encrypt before storing!)
const exported = await exportDen(denId);

// Restore on another device
await importDenState(denId, exported);

// Wipe on logout
await clearDenLocalData(denId);
```

---

## API Reference

### Den lifecycle

| Function           | Description                           |
| ------------------ | ------------------------------------- |
| `openDen(denId)`   | Opens or returns cached den docs      |
| `closeDen(denId)`  | Closes and uncaches a den             |
| `isDenOpen(denId)` | Returns true if den is currently open |

### Notes

| Function                           | Description                                               |
| ---------------------------------- | --------------------------------------------------------- |
| `createNote(denId, input)`         | Creates a note; mirrors to shared doc if `isShared: true` |
| `getNote(denId, noteId)`           | Returns a note or `undefined`                             |
| `getAllNotes(denId)`               | Returns all notes, newest-first                           |
| `searchNotes(denId, options)`      | Searches content, tags, shared flag                       |
| `updateNote(denId, noteId, input)` | Updates fields; syncs shared doc                          |
| `deleteNote(denId, noteId)`        | Removes from private and shared docs                      |

### Voice memos

| Function                                            | Description                        |
| --------------------------------------------------- | ---------------------------------- |
| `addVoiceMemo(denId, blobRef, duration, analysis?)` | Adds a memo record                 |
| `getVoiceMemo(denId, memoId)`                       | Returns a memo or `undefined`      |
| `getAllVoiceMemos(denId)`                           | Returns all memos, newest-first    |
| `attachAnalysis(denId, memoId, analysis)`           | Attaches on-device analysis result |
| `getMoodJournal(denId)`                             | Returns mood history oldest-first  |

### Dropbox

| Function                                  | Description                      |
| ----------------------------------------- | -------------------------------- |
| `addToDropbox(denId, visitorId, payload)` | Visitor writes an encrypted drop |
| `getDropboxItems(denId)`                  | Host reads all drops             |
| `clearDropbox(denId)`                     | Host clears all drops            |
| `deleteDropboxItem(denId, itemId)`        | Host removes one drop            |

### Settings

| Function                           | Description                            |
| ---------------------------------- | -------------------------------------- |
| `getSetting<T>(denId, key)`        | Reads a setting value                  |
| `setSetting<T>(denId, key, value)` | Writes a setting value                 |
| `deleteSetting(denId, key)`        | Removes a setting key                  |
| `getAllSettings(denId)`            | Returns all settings as a plain object |

### Persistence

| Function                          | Description                                     |
| --------------------------------- | ----------------------------------------------- |
| `denHasLocalData(denId)`          | Checks whether IDB data exists for this den     |
| `exportDen(denId)`                | Exports raw Yjs state (encrypt before storing!) |
| `importDenState(denId, exported)` | Merges exported state (safe on existing dens)   |
| `clearDenLocalData(denId)`        | Wipes all IDB data for a den                    |
| `getDenStateVector(denId, doc)`   | Returns the Yjs state vector for diffing        |

### React hooks

| Hook                                 | Description                                   |
| ------------------------------------ | --------------------------------------------- |
| `useDen(denId)`                      | Open a den; returns `{ docs, status, error }` |
| `useNote(denId, noteId)`             | Subscribe to a single note                    |
| `useAllNotes(denId)`                 | Subscribe to all private notes                |
| `useSharedNotes(denId)`              | Subscribe to shared notes                     |
| `useVoiceMemo(denId, memoId)`        | Subscribe to a single memo                    |
| `useAllVoiceMemos(denId)`            | Subscribe to all memos                        |
| `useMoodJournal(denId)`              | Subscribe to mood history                     |
| `useDropbox(denId)`                  | Subscribe to visitor drops                    |
| `usePresence(denId)`                 | Subscribe to visitor presence                 |
| `useSetting<T>(denId, key, default)` | Subscribe to a setting value                  |
| `useSetSetting<T>(denId, key)`       | Returns a stable setter for a setting         |

---

## Dependencies

- `yjs` — CRDT document model
- `y-indexeddb` — IndexedDB persistence provider for Yjs
- `react` (peer) — for hooks

## Depends on

- `@meerkat/types` — shared domain types
- `@meerkat/crypto` — encryption (used by callers before storing sensitive payloads)
