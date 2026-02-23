# @meerkat/crdt

Orchestration layer for Meerkat's local-first data model.

Wires **`@meerkat/local-store`** (IndexedDB + Yjs) and **`@meerkat/p2p`** (WebRTC, Phase 4) together into a unified API. Manages the sync state machine (`offline → connecting → synced → hosting`). Exposes `useDen()` and `DenProvider` as the primary React interface for the app.

> **The app imports from this package. Never directly from `@meerkat/local-store` or `@meerkat/p2p`.**

---

## What was removed

The old `@meerkat/crdt` had Supabase Realtime wired directly into it. All of that is gone:

| Old                                              | New                                                         |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `supabase.channel().on('postgres_changes', ...)` | Yjs observers on `privateDen.notes`                         |
| `useDenMessages()` querying Supabase             | `useDen().notes` — live from IndexedDB                      |
| `useDenPresence()` via Supabase Presence         | `useDen().visitors` — from `shared.ydoc` presence namespace |
| `useYDoc()` — untyped single Y.Doc               | `useDen()` — fully typed, hydrated `DenState`               |

---

## Architecture

```
@meerkat/crdt
│
├── DenProvider        ← initialises local-store docs + P2P
│   └── DenContext     ← distributes DenState to all children
│
├── useDen()           ← reads from context OR runs standalone
│
├── DenSyncMachine     ← state machine: offline → connecting → synced → hosting
│   └── P2PAdapter     ← interface; implemented by @meerkat/p2p (Phase 4)
│                         falls back to offlineAdapter in Phase 1–3
│
└── @meerkat/local-store  ← IndexedDB + Yjs (imported, not bundled)
```

### Sync state machine

```
    offline ──► connecting ──► synced ──► hosting
       ▲             │             │         │
       └─────────────┘             └────┬────┘
         timeout/fail             last visitor disconnects
```

---

## Usage

### Option A — DenProvider (recommended for pages)

```tsx
// app/den/[denId]/layout.tsx
import { DenProvider } from "@meerkat/crdt";

export default function DenLayout({
  params,
  children,
}: {
  params: { denId: string };
  children: React.ReactNode;
}) {
  return <DenProvider denId={params.denId}>{children}</DenProvider>;
}
```

```tsx
// Any component inside the provider:
import { useDenContext } from "@meerkat/crdt";

function NoteList() {
  const { notes, syncStatus, isLoading, actions } = useDenContext();

  if (isLoading) return <DenSkeleton />;

  return (
    <>
      <SyncBadge status={syncStatus} />
      {notes.map((n) => (
        <NoteCard
          key={n.id}
          note={n}
          onDelete={() => actions.deleteNote(n.id)}
        />
      ))}
      <NewNoteButton onCreate={actions.createNote} />
    </>
  );
}
```

### Option B — useDen standalone

```tsx
import { useDen } from "@meerkat/crdt";

function DenWidget({ denId }: { denId: string }) {
  const { notes, visitors, syncStatus } = useDen(denId);
  return (
    <div>
      {notes.length} notes · {visitors.length} visitors · {syncStatus}
    </div>
  );
}
```

### Replacing den-page-client.tsx

```tsx
// BEFORE (old Supabase Realtime pattern — DELETED):
import { useDenMessages } from "~/hooks/use-den-messages";
import { useDenPresence } from "~/hooks/use-den-presence";

export function DenPageClient({ denId }) {
  const { data: messages } = useDenMessages(denId); // ← Supabase query
  const presences = useDenPresence(denId); // ← Supabase Presence
  // ...
}

// AFTER (local-first — no Supabase for content):
import { DenProvider, useDenContext } from "@meerkat/crdt";

export function DenPageClient({ denId }) {
  return (
    <DenProvider denId={denId}>
      <DenPageInner />
    </DenProvider>
  );
}

function DenPageInner() {
  const { notes, visitors, syncStatus, actions } = useDenContext();
  // notes comes from IndexedDB (Yjs) — works offline
  // visitors comes from shared.ydoc presence — set by @meerkat/p2p
  // syncStatus: 'offline' | 'connecting' | 'synced' | 'hosting'
}
```

---

## API Reference

### Components

| Export                          | Description                                                |
| ------------------------------- | ---------------------------------------------------------- |
| `<DenProvider denId readOnly?>` | Opens den docs, wires P2P, provides `DenState` via context |

### Hooks

| Hook                  | Description                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| `useDen(denId)`       | Returns `DenState`. Reads from context if inside `DenProvider`, otherwise standalone. |
| `useDenContext()`     | Reads `DenState` from the nearest `DenProvider`. Throws if no provider found.         |
| `useDenContextSafe()` | Returns `DenState                                                                     | null`. Safe to call anywhere. |

### DenState

```ts
interface DenState {
  notes: NoteData[]; // Private notes, newest-first, live-updating
  voiceMemos: VoiceMemoData[]; // Private voice memos, newest-first
  shared: {
    notes: NoteData[]; // Shared notes (visible to visitors)
    voiceThread: VoiceMemoData[];
    dropbox: DropboxItem[]; // Visitor drops
  };
  visitors: PresenceInfo[]; // Currently-connected visitors (set by @meerkat/p2p)
  syncStatus: SyncStatus; // 'offline' | 'connecting' | 'synced' | 'hosting'
  isLoading: boolean; // True while opening IndexedDB for the first time
  error: Error | null;
  actions: {
    createNote(input: CreateNoteInput): Promise<NoteData>;
    updateNote(id: string, input: UpdateNoteInput): Promise<NoteData>;
    deleteNote(id: string): Promise<void>;
    searchNotes(options: SearchNotesOptions): Promise<NoteData[]>;
  };
}
```

### Advanced / Testing

| Export                               | Description                               |
| ------------------------------------ | ----------------------------------------- |
| `DenSyncMachine`                     | The sync state machine class              |
| `getOrCreateMachine(denId, adapter)` | Per-den machine singleton                 |
| `destroyMachine(denId)`              | Stops and removes a machine               |
| `resetAllMachines()`                 | Clears all machines (use in tests)        |
| `offlineAdapter`                     | No-op P2P adapter (always 'offline')      |
| `setP2PAdapter(adapter)`             | Override adapter (use in tests/Storybook) |
| `resetP2PAdapter()`                  | Reset adapter override                    |

---

## P2P Adapter (Phase 4)

In Phase 1–3, `@meerkat/p2p` doesn't exist yet. The package gracefully falls back to `offlineAdapter` — all local content works, no sync.

In Phase 4, install `@meerkat/p2p`. The `resolveP2PAdapter()` function dynamically imports it and calls `createP2PAdapter()`. The `P2PAdapter` interface is:

```ts
interface P2PAdapter {
  hostDen(denId: string): () => void;
  getStatus(denId: string): SyncStatus;
  onStatusChange(
    denId: string,
    handler: (status: SyncStatus) => void,
  ): () => void;
}
```

---

## Dependencies

- `@meerkat/local-store` (required) — IndexedDB + Yjs storage
- `@meerkat/p2p` (optional, Phase 4) — WebRTC sync
- `react` (peer) — for hooks and context
- `yjs` (peer) — CRDT document model
