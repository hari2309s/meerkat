# Vault notes -- call-site migration guide

Two files to add to apps/web/hooks/:

apps/web/hooks/use-vault-notes.ts (already delivered)
apps/web/hooks/use-vault-den-context.ts (already delivered)

---

## The rule in one line

> Every place in apps/web that reads or writes note content must go through
> the vault-aware hooks so notes are encrypted at rest and decrypted on read.

---

## Pattern 1 -- components inside a DenProvider (most common)

This covers den pages and any component tree rooted at DenProvider.

```diff
-import { useDenContext } from "@meerkat/crdt";
+import { useVaultDenContextForDen } from "@/hooks/use-vault-den-context";

 function DenPageInner({ denId }: { denId: string }) {
-  const { notes, actions, syncStatus, isLoading } = useDenContext();
+  const { notes, actions, syncStatus, isLoading } =
+    useVaultDenContextForDen(denId);

   // notes is now decrypted plaintext.
   // actions.createNote and actions.updateNote encrypt automatically.
   // Everything else is identical.
 }
```

File(s) to update: any component that calls `useDenContext()`.

---

## Pattern 2 -- components that call useAllNotes directly

If a component imports `useAllNotes` from `@meerkat/local-store` or
`@meerkat/crdt` to render note content, swap it.

```diff
-import { useAllNotes } from "@meerkat/local-store";
+import { useDecryptedAllNotes } from "@/hooks/use-vault-notes";

 function NoteList({ denId }: { denId: string }) {
-  const notes = useAllNotes(denId);
+  const notes = useDecryptedAllNotes(denId);
   // notes is now decrypted plaintext. Shape is identical: NoteData[].
 }
```

---

## Pattern 3 -- components that call createNote / updateNote imperatively

If a component calls the store functions directly (outside a DenProvider):

```diff
-import { createNote, updateNote, deleteNote } from "@meerkat/local-store";
+import { useVaultNotes } from "@/hooks/use-vault-notes";

 function QuickNoteWidget({ denId }: { denId: string }) {
+  const { createNote, updateNote, deleteNote } = useVaultNotes(denId);

   const handleSave = async (content: string) => {
-    await createNote(denId, { content });
+    await createNote({ content });   // encrypts automatically
   };
 }
```

---

## Pattern 4 -- search

`actions.searchNotes` and the raw `searchNotes` from local-store both operate
on the stored string. For vault users that string is ciphertext, so a plaintext
query will not match.

Replace with a client-side filter over the already-decrypted notes array:

```diff
-const results = await actions.searchNotes({ query });
+const results = notes.filter(n =>
+  n.content.toLowerCase().includes(query.toLowerCase())
+);
```

For tag and isShared filtering, the same pattern applies -- those fields are
never encrypted so they can be used directly.

---

## Pattern 5 -- useDen standalone (outside DenProvider)

`useDen` is the standalone version of `useDenContext`. It does not have a
vault-aware counterpart because it is mainly used in isolated widgets that
don't render note content. If one of those widgets does render notes:

```diff
-import { useDen } from "@meerkat/crdt";
+import { useDen } from "@meerkat/crdt";
+import { useDecryptedAllNotes, useVaultNotes } from "@/hooks/use-vault-notes";

 function Widget({ denId }: { denId: string }) {
   const den = useDen(denId);
+  const notes = useDecryptedAllNotes(denId);     // replaces den.notes
+  const { createNote } = useVaultNotes(denId);   // replaces den.actions.createNote
 }
```

---

## Summary table

| Old call                       | New call                                     | File                       |
| ------------------------------ | -------------------------------------------- | -------------------------- |
| `useDenContext()`              | `useVaultDenContextForDen(denId)`            | `use-vault-den-context.ts` |
| `useAllNotes(denId)`           | `useDecryptedAllNotes(denId)`                | `use-vault-notes.ts`       |
| `createNote(denId, input)`     | `useVaultNotes(denId).createNote(input)`     | `use-vault-notes.ts`       |
| `updateNote(denId, id, input)` | `useVaultNotes(denId).updateNote(id, input)` | `use-vault-notes.ts`       |
| `deleteNote(denId, id)`        | unchanged -- no content                      | --                         |
| `searchNotes(denId, opts)`     | filter over decrypted `notes` array          | --                         |

---

## What does NOT need to change

- `actions.deleteNote` -- no content involved
- `VoiceMemoData` -- voice content is encrypted separately via `use-voice-memo-upload.ts`
- `DropboxItem` -- payload is already encrypted with asymmetric key
- `MoodEntry` -- contains no private text content
- `PresenceInfo` -- ephemeral, not persisted
- `NoteData.id`, `.tags`, `.isShared`, `.createdAt`, `.updatedAt` -- none of these
  fields are encrypted; only `.content` is
