"use client";

/**
 * useVaultNotes — transparent encrypt/decrypt wrapper around @meerkat/local-store notes.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Notes are stored as plain strings in the Yjs Y.Map<NoteData> inside IndexedDB.
 * @meerkat/local-store has no concept of vault sessions — it stays dependency-free
 * so it can be used in any context (tests, workers, server components).
 *
 * This hook lives in the web app and adds the encryption layer on top:
 *
 *   write path:  plaintext content → encryptString(vaultKey) → EncryptedBlob
 *                                  → JSON-serialised → stored as NoteData.content
 *
 *   read  path:  NoteData.content → detect sentinel prefix "__enc:" → JSON-parse
 *                                 → decryptString(vaultKey) → plaintext NoteData
 *
 * The sentinel prefix "__enc:" lets the hook distinguish encrypted notes from
 * plaintext notes created before encryption was enabled — those are returned
 * as-is, ensuring full backward compatibility.
 *
 * DESIGN DECISIONS
 * ────────────────
 * • Encryption is best-effort: if no vault session is active (v1 Supabase user
 *   or mnemonic was cleared), notes are written and read as plain text.
 *   This preserves the legacy flow and avoids a hard crash.
 *
 * • The vault key is derived once per render cycle via loadVaultKey() and cached
 *   in a ref so it is not re-derived on every keystroke.
 *
 * • This hook DOES NOT subscribe to Yjs changes — it is imperative (create /
 *   update / delete / getAll). For live subscriptions use useDecryptedAllNotes()
 *   below, which wraps useAllNotes() from local-store.
 *
 * PUBLIC API
 * ──────────
 *   useVaultNotes(denId)        — imperative CRUD (create, update, delete, getAll)
 *   useDecryptedAllNotes(denId) — reactive hook, re-renders on Yjs changes,
 *                                 decrypts all notes before returning
 */

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createNote,
  updateNote,
  deleteNote,
  getAllNotes,
  useAllNotes,
} from "@meerkat/local-store";
import { encryptString, decryptString } from "@meerkat/crypto";
import { loadVaultKey } from "@/lib/vault-credentials";
import type {
  NoteData,
  CreateNoteInput,
  UpdateNoteInput,
} from "@meerkat/local-store";

// ---------------------------------------------------------------------------
// Encryption sentinel
// ---------------------------------------------------------------------------
// Notes with encrypted content are stored with this prefix so we can detect
// them reliably without inspecting JSON structure.
const ENC_PREFIX = "__enc:";

function isEncrypted(content: string): boolean {
  return content.startsWith(ENC_PREFIX);
}

function wrap(blob: string): string {
  return ENC_PREFIX + blob;
}

function unwrap(content: string): string {
  return content.slice(ENC_PREFIX.length);
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt a single note's content
// ---------------------------------------------------------------------------
async function encryptContent(
  content: string,
  vaultKey: CryptoKey | null,
): Promise<string> {
  if (!vaultKey) return content; // No vault session — store plaintext
  const blob = await encryptString(content, vaultKey);
  return wrap(JSON.stringify(blob));
}

async function decryptContent(
  content: string,
  vaultKey: CryptoKey | null,
): Promise<string> {
  if (!isEncrypted(content)) return content; // Legacy plaintext note
  if (!vaultKey) {
    // Vault session gone — can't decrypt; return a safe placeholder so the
    // UI doesn't crash. The raw ciphertext is not surfaced to the user.
    return "[Encrypted — sign in with your Key to view]";
  }
  try {
    const blob = JSON.parse(unwrap(content));
    return await decryptString(blob, vaultKey);
  } catch {
    return "[Could not decrypt note]";
  }
}

async function decryptNote(
  note: NoteData,
  vaultKey: CryptoKey | null,
): Promise<NoteData> {
  return {
    ...note,
    content: await decryptContent(note.content, vaultKey),
  };
}

async function decryptNotes(
  notes: NoteData[],
  vaultKey: CryptoKey | null,
): Promise<NoteData[]> {
  return Promise.all(notes.map((n) => decryptNote(n, vaultKey)));
}

// ---------------------------------------------------------------------------
// useVaultNotes — imperative CRUD
// ---------------------------------------------------------------------------

export interface VaultNoteActions {
  /**
   * Create a note. Content is encrypted before writing to IndexedDB if a
   * vault session is active.
   */
  createNote: (input: CreateNoteInput) => Promise<NoteData>;
  /**
   * Update a note. If content is included it is re-encrypted with the vault key.
   */
  updateNote: (id: string, input: UpdateNoteInput) => Promise<NoteData>;
  /** Delete a note (no encryption involved — just removes the entry). */
  deleteNote: (id: string) => Promise<void>;
  /**
   * Fetch and decrypt all notes. Useful for one-shot reads outside a
   * reactive context.
   */
  getAllNotes: () => Promise<NoteData[]>;
}

/**
 * Returns stable CRUD actions for encrypted note operations.
 *
 * The vault key is derived once and cached — safe to call on every render.
 *
 * @example
 * ```tsx
 * const notes = useDecryptedAllNotes(denId);
 * const { createNote } = useVaultNotes(denId);
 * await createNote({ content: "Secret thought" });
 * ```
 */
export function useVaultNotes(denId: string): VaultNoteActions {
  // Cache the vault key for the lifetime of this hook instance.
  // Re-derive if it hasn't been loaded yet (e.g. after a hot-reload).
  const vaultKeyRef = useRef<CryptoKey | null | "pending">("pending");

  useEffect(() => {
    loadVaultKey().then((key) => {
      vaultKeyRef.current = key;
    });
  }, []);

  const getKey = useCallback(async (): Promise<CryptoKey | null> => {
    if (vaultKeyRef.current === "pending") {
      const key = await loadVaultKey();
      vaultKeyRef.current = key;
      return key;
    }
    return vaultKeyRef.current;
  }, []);

  const create = useCallback(
    async (input: CreateNoteInput): Promise<NoteData> => {
      const key = await getKey();
      const encryptedContent = await encryptContent(input.content, key);
      const note = await createNote(denId, {
        ...input,
        content: encryptedContent,
      });
      // Return the note with decrypted content so callers see plaintext.
      return { ...note, content: input.content };
    },
    [denId, getKey],
  );

  const update = useCallback(
    async (id: string, input: UpdateNoteInput): Promise<NoteData> => {
      const key = await getKey();
      const patch: UpdateNoteInput = { ...input };
      if (input.content !== undefined) {
        patch.content = await encryptContent(input.content, key);
      }
      const note = await updateNote(denId, id, patch);
      // Decrypt before returning so callers always get plaintext.
      return decryptNote(note, key);
    },
    [denId, getKey],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteNote(denId, id);
    },
    [denId],
  );

  const getAll = useCallback(async (): Promise<NoteData[]> => {
    const key = await getKey();
    const notes = await getAllNotes(denId);
    return decryptNotes(notes, key);
  }, [denId, getKey]);

  return {
    createNote: create,
    updateNote: update,
    deleteNote: remove,
    getAllNotes: getAll,
  };
}

// ---------------------------------------------------------------------------
// useDecryptedAllNotes — reactive Yjs subscription with decryption
// ---------------------------------------------------------------------------

/**
 * Subscribes to all private notes in the den and decrypts their content
 * before returning. Re-renders whenever the Yjs Y.Map changes.
 *
 * Decryption is asynchronous but the hook avoids flickering: it keeps the
 * previous decrypted values visible while the new batch is being processed,
 * then atomically swaps them in.
 *
 * @example
 * ```tsx
 * function NoteList({ denId }: { denId: string }) {
 *   const notes = useDecryptedAllNotes(denId);
 *   return notes.map(n => <NoteCard key={n.id} note={n} />);
 * }
 * ```
 */
export function useDecryptedAllNotes(denId: string): NoteData[] {
  // useAllNotes subscribes to Yjs and returns raw (possibly encrypted) notes.
  const rawNotes = useAllNotes(denId);
  const [decryptedNotes, setDecryptedNotes] = useState<NoteData[]>([]);
  const vaultKeyRef = useRef<CryptoKey | null | "pending">("pending");

  // Prime the vault key cache once on mount.
  useEffect(() => {
    loadVaultKey().then((key) => {
      vaultKeyRef.current = key;
    });
  }, []);

  // Whenever rawNotes changes (Yjs update), re-decrypt the whole set.
  useEffect(() => {
    let cancelled = false;

    async function decrypt() {
      let key = vaultKeyRef.current;
      if (key === "pending") {
        key = await loadVaultKey();
        vaultKeyRef.current = key;
      }
      const result = await decryptNotes(rawNotes, key);
      if (!cancelled) setDecryptedNotes(result);
    }

    decrypt();
    return () => {
      cancelled = true;
    };
  }, [rawNotes]);

  return decryptedNotes;
}
