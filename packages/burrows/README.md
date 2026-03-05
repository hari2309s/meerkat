# @meerkat/burrows

Pages (burrows) system for Meerkat dens — block-based documents backed by Yjs + IndexedDB.

> **A burrow is a named page within a den.** Content is stored in a dedicated Yjs document per burrow, giving each page full CRDT collaboration support via `@meerkat/editor`.

---

## Architecture

```
Den metadata doc  ("meerkat-burrows-{denId}")
  ├── burrows   Y.Map<BurrowData>      — page list: title, icon, order, etc.
  └── metadata  Y.Map<BurrowMetadata>  — computed stats per burrow

Burrow content docs  ("meerkat-burrow-content-{yjsDocId}")
  └── "default"  Y.XmlFragment  — block content read/written by Tiptap
```

Each burrow has a `yjsDocId` field pointing to its own Yjs document. The metadata doc stays small (list view), while the content doc is only loaded when the user opens a page for editing.

---

## Usage

### List all pages in a den

```tsx
import { useBurrows } from "@meerkat/burrows";

function Sidebar({ denId, userId }: { denId: string; userId: string }) {
  const { burrows, isLoading, actions } = useBurrows(denId);

  return (
    <>
      {burrows.map((b) => (
        <PageRow key={b.id} burrow={b} />
      ))}
      <button onClick={() => actions.createBurrow({ title: "Untitled", createdBy: userId })}>
        + New page
      </button>
    </>
  );
}
```

### Open a page for editing

```tsx
import { useBurrow, useBurrowDoc } from "@meerkat/burrows";
import { BurrowEditor } from "@meerkat/editor";

function EditorPage({ denId, burrowId }: { denId: string; burrowId: string }) {
  const { burrow, actions } = useBurrow(denId, burrowId);
  const { doc, isLoading } = useBurrowDoc(burrow?.yjsDocId);

  if (isLoading || !burrow || !doc) return <Spinner />;

  return (
    <BurrowEditor
      doc={doc}
      user={{ name: "Alice", color: "#7c3aed" }}
      title={burrow.title}
      icon={burrow.icon}
      onTitleChange={(title) => actions.updateBurrow({ title })}
    />
  );
}
```

---

## API Reference

### React hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useBurrows(denId)` | `{ burrows, isLoading, error, actions }` | All non-archived burrows, sorted by `order`. Live-updating. |
| `useBurrow(denId, burrowId)` | `{ burrow, metadata, isLoading, error, actions }` | Single burrow + computed stats. |
| `useBurrowDoc(yjsDocId?)` | `{ doc, isLoading, error }` | Loads the `Y.Doc` for a burrow's content. Pass to `<BurrowEditor>`. |

### `useBurrows` actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `createBurrow` | `(input: CreateBurrowInput) => Promise<BurrowData>` | Creates a new page. |
| `updateBurrow` | `(id, input: UpdateBurrowInput) => Promise<BurrowData>` | Updates title, icon, or order. |
| `archiveBurrow` | `(id) => Promise<void>` | Soft-deletes (hidden from list, preserved in IndexedDB). |
| `restoreBurrow` | `(id) => Promise<void>` | Un-archives a soft-deleted burrow. |
| `deleteBurrow` | `(id) => Promise<void>` | Permanently removes the burrow and its content doc. |
| `setCurrentBurrow` | `(id \| null) => void` | Tracks the active (focused) burrow ID. |

### `useBurrow` actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `updateBurrow` | `(input: UpdateBurrowInput) => Promise<BurrowData>` | Updates this burrow's title, icon, or order. |
| `archiveBurrow` | `() => Promise<void>` | Soft-deletes this burrow. |
| `deleteBurrow` | `() => Promise<void>` | Permanently removes this burrow. |

### Imperative API

```ts
import {
  openBurrowsDoc,
  closeBurrowsDoc,
  openBurrowContentDoc,
  closeBurrowContentDoc,
  createBurrow,
  getBurrow,
  getAllBurrows,   // alias: getBurrowsByDen
  updateBurrow,
  archiveBurrow,
  restoreBurrow,
  deleteBurrow,
  setCurrentBurrow,
  getCurrentBurrowId,
  getBurrowMetadata,
  setBurrowMetadata,
} from "@meerkat/burrows";
```

### Types

```ts
interface BurrowData {
  id: string;
  denId: string;
  title: string;
  icon?: string;
  yjsDocId: string;      // ID of the content Y.Doc
  createdBy: string;     // user ID
  archived: boolean;
  collaborators: string[];
  order: number;         // fractional sort key
  createdAt: number;     // Unix ms
  updatedAt: number;     // Unix ms
}

interface BurrowMetadata {
  wordCount: number;
  lastEditedBy: string | null;
  hasVoiceNotes: boolean;
  hasImages: boolean;
}
```

---

## Dependencies

- `yjs` — CRDT document model
- `y-indexeddb` — Yjs persistence to IndexedDB
- `react` (peer, optional) — for hooks
