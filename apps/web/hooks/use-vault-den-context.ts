"use client";

/**
 * useVaultDenContextForDen
 *
 * Web-app-level wrapper around useDenContext() that transparently wires
 * vault encryption into the den state.
 *
 * WHY THIS EXISTS
 * ---------------
 * @meerkat/crdt's DenProvider calls @meerkat/local-store directly for note
 * CRUD. It lives in a workspace package and must not import vault logic from
 * apps/web. The encryption layer is therefore added here, at the web-app
 * boundary.
 *
 * This hook does exactly two things on top of useDenContext():
 *
 *   1. Replaces den.notes with useDecryptedAllNotes(denId) so every
 *      component always receives plaintext, regardless of whether notes
 *      were written before or after encryption was enabled.
 *
 *   2. Replaces actions.createNote and actions.updateNote with
 *      vault-encrypting versions from useVaultNotes(denId).
 *      actions.deleteNote and actions.searchNotes pass through unchanged
 *      (no content to encrypt/decrypt for delete; search limitation noted
 *      below).
 *
 * USAGE
 * -----
 * Replace every call to useDenContext() in apps/web with this hook.
 * The return shape is identical to DenState -- no other component changes.
 *
 *   // Before
 *   import { useDenContext } from "@meerkat/crdt";
 *   const { notes, actions } = useDenContext();
 *
 *   // After
 *   import { useVaultDenContextForDen } from "@/hooks/use-vault-den-context";
 *   const { notes, actions } = useVaultDenContextForDen(denId);
 *
 * Must be used inside a <DenProvider denId={...}> -- same requirement as
 * useDenContext().
 *
 * SEARCH LIMITATION
 * -----------------
 * actions.searchNotes operates on raw stored content. For vault users that
 * content is ciphertext, so plaintext search queries will not match encrypted
 * notes. Use a client-side filter over the already-decrypted `notes` array
 * instead:
 *
 *   const { notes } = useVaultDenContextForDen(denId);
 *   const results = notes.filter(n =>
 *     n.content.toLowerCase().includes(query.toLowerCase())
 *   );
 */

import { useMemo } from "react";
import { useDenContext } from "@meerkat/crdt";
import type { DenState } from "@meerkat/crdt";
import { useDecryptedAllNotes, useVaultNotes } from "./use-vault-notes";

/**
 * Returns the full DenState with vault encryption transparently wired in.
 *
 * - den.notes                 -- decrypted via useDecryptedAllNotes (Yjs-reactive)
 * - den.actions.createNote    -- encrypts content before writing to IndexedDB
 * - den.actions.updateNote    -- re-encrypts content before writing to IndexedDB
 * - den.actions.deleteNote    -- unchanged (no content involved)
 * - den.actions.searchNotes   -- unchanged (searches raw stored strings; see limitation above)
 * - everything else           -- passed through unchanged from useDenContext()
 *
 * @param denId  The den ID, same value passed to the enclosing <DenProvider>.
 *               DenState does not expose denId so it must be passed here.
 *
 * @throws if called outside a <DenProvider>
 *
 * @example
 * ```tsx
 * // Inside any component that is a descendant of <DenProvider denId={denId}>:
 * const { notes, actions, syncStatus, isLoading } =
 *   useVaultDenContextForDen(denId);
 *
 * // notes is NoteData[] -- plaintext, live-updating from Yjs
 * // actions.createNote({ content: "..." }) -- encrypted before write
 * ```
 */
export function useVaultDenContextForDen(denId: string): DenState {
  const den = useDenContext();

  // 1. Decrypted notes -- live Yjs subscription with transparent decrypt.
  //    Replaces den.notes which contains raw possibly-encrypted strings.
  const decryptedNotes = useDecryptedAllNotes(denId);

  // 2. Vault-encrypting CRUD actions (stable useCallback refs).
  const vaultActions = useVaultNotes(denId);

  // 3. Compose the patched DenState. useMemo keeps the object reference
  //    stable across renders where unrelated parts of den change, avoiding
  //    unnecessary re-renders of descendants that only read notes/actions.
  return useMemo<DenState>(
    () => ({
      ...den,
      notes: decryptedNotes,
      actions: {
        ...den.actions,
        createNote: vaultActions.createNote,
        updateNote: vaultActions.updateNote,
        // deleteNote: no content -- pass through
        deleteNote: den.actions.deleteNote,
        // searchNotes: see SEARCH LIMITATION in module docblock above
        searchNotes: den.actions.searchNotes,
      },
    }),
    // den reference changes when any part of DenState changes (Yjs observer).
    // decryptedNotes changes when Yjs fires and the decrypt batch completes.
    // vaultActions refs are stable (useCallback in useVaultNotes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [den, decryptedNotes, vaultActions.createNote, vaultActions.updateNote],
  );
}
