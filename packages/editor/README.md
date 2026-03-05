# @meerkat/editor

Block-based page editor for Meerkat — Tiptap + Yjs collaboration, slash commands, voice and image blocks.

> **Powered by Tiptap.** Content is stored in a `Y.XmlFragment` inside a `Y.Doc` from `@meerkat/burrows`. Two users editing the same page see each other's changes in real-time via the existing P2P layer.

---

## Setup

Import the base CSS once in your app root (required for ProseMirror + collaboration cursors):

```ts
// apps/web/app/layout.tsx
import "@meerkat/editor/editor.css";
```

---

## Usage

### Basic (single-user)

```tsx
import { BurrowEditor } from "@meerkat/editor";
import { useBurrow, useBurrowDoc } from "@meerkat/burrows";

function EditorPage({ denId, burrowId }: { denId: string; burrowId: string }) {
  const { burrow, actions } = useBurrow(denId, burrowId);
  const { doc, isLoading } = useBurrowDoc(burrow?.yjsDocId);

  if (isLoading || !doc) return <Spinner />;

  return (
    <BurrowEditor
      doc={doc}
      user={{ name: "Alice", color: "#7c3aed" }}
      title={burrow.title}
      icon={burrow.icon}
      onTitleChange={(title) => actions.updateBurrow({ title })}
      onUpdate={({ wordCount, hasVoiceNotes, hasImages }) =>
        setBurrowMetadata(denId, burrowId, {
          wordCount,
          hasVoiceNotes,
          hasImages,
          lastEditedBy: userId,
        })
      }
    />
  );
}
```

### With collaboration cursors (P2P)

Pass the P2P provider's awareness to show other users' cursors:

```tsx
import { BurrowEditor, type CollaborationProvider } from "@meerkat/editor";

// The awareness object comes from the existing P2P layer
const provider: CollaborationProvider = { awareness };

<BurrowEditor
  doc={doc}
  provider={provider}
  user={{ name: currentUser.name, color: userColor(currentUser.id) }}
  ...
/>
```

### Custom voice block renderer

Supply `renderVoiceBlock` to replace the default `<audio>` element with `@meerkat/voice` player:

```tsx
import { BurrowEditor } from "@meerkat/editor";
import { VoicePlayer } from "@meerkat/voice";

<BurrowEditor
  doc={doc}
  user={user}
  renderVoiceBlock={({ node }) => (
    <VoicePlayer audioUrl={node.attrs.audioUrl} duration={node.attrs.duration} />
  )}
/>
```

---

## Slash commands

Type `/` anywhere in the editor to open the command palette:

| Command | Shortcut | Description |
|---------|----------|-------------|
| Text | `/text` | Plain paragraph |
| Heading 1–3 | `/h1` `/h2` `/h3` | Section headings |
| Bullet list | `/bullet` | Unordered list |
| Numbered list | `/numbered` | Ordered list |
| To-do list | `/todo` | Checkbox items |
| Quote | `/quote` | Blockquote |
| Code block | `/code` | Monospace code |
| Divider | `/divider` | Horizontal rule |
| Image | `/image` | Inline image (prompts for URL) |
| Voice note | `/voice` | Inserts a voice block |

---

## API Reference

### `<BurrowEditor>`

| Prop | Type | Description |
|------|------|-------------|
| `doc` | `Y.Doc` | The content document from `useBurrowDoc`. **Required.** |
| `provider` | `CollaborationProvider?` | Awareness provider for collaboration cursors. |
| `user` | `{ name: string; color: string }` | Current user for cursor display. **Required.** |
| `title` | `string?` | Page title shown above the editor. |
| `icon` | `string?` | Page icon (emoji). |
| `onTitleChange` | `(title: string) => void` | Called when title is edited. |
| `onIconChange` | `(icon: string) => void` | Called when icon is changed. |
| `onUpdate` | `(stats) => void` | Called ~500ms after each edit. |
| `renderVoiceBlock` | `React.ComponentType<NodeViewProps>?` | Custom voice block renderer. |
| `readOnly` | `boolean?` | Disables all editing. |
| `className` | `string?` | Extra class on the wrapper div. |

### Exported extensions (for custom editor setups)

| Export | Description |
|--------|-------------|
| `VoiceBlock` | Pre-built Tiptap node with default audio renderer |
| `createVoiceBlockExtension(renderer?)` | Factory to supply a custom node view |
| `ImageBlock` | Tiptap node with editable caption |
| `createSlashCommandsExtension(render)` | Factory that wires slash commands + Tippy renderer |
| `buildSlashItems()` | Returns all built-in slash command items |
| `filterSlashItems(items, query)` | Filters items by query string |
| `createSlashMenuRenderer()` | Returns the Tiptap Suggestion `render` function |

---

## Dependencies

- `@tiptap/react` + `@tiptap/starter-kit` — rich text editing
- `@tiptap/extension-collaboration` — Yjs document sync
- `@tiptap/extension-collaboration-cursor` — live cursors
- `@tiptap/suggestion` + `tippy.js` — slash command popup
- `yjs` — CRDT document model
- `react` (peer)
