/**
 * Voice memo operations for @meerkat/local-store.
 *
 * A VoiceMemo entry is a lightweight record stored in the Yjs doc.
 * The actual audio lives in Supabase Storage (encrypted) — the entry
 * here holds the blobRef (Storage path) and any on-device analysis
 * results from @meerkat/analyzer.
 *
 * This module is intentionally thin. Heavy lifting (recording,
 * encryption, upload) belongs in @meerkat/voice. This module is
 * the data layer: store the ref, retrieve the ref.
 */

import { openDen } from "./den.js";
import type { VoiceMemoData, MoodEntry } from "./types.js";

function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Adds a new voice memo record to the private den.
 *
 * Call this after the encrypted blob has been uploaded to Supabase Storage
 * and you have its path/URL (blobRef).
 *
 * @param denId         — Den owner's ID.
 * @param blobRef       — The Supabase Storage path for the encrypted blob.
 * @param durationSeconds — Duration of the recording.
 * @param analysis      — Optional on-device analysis from @meerkat/analyzer.
 */
export async function addVoiceMemo(
  denId: string,
  blobRef: string,
  durationSeconds: number,
  analysis?: VoiceMemoData["analysis"],
): Promise<VoiceMemoData> {
  const { privateDen } = await openDen(denId);

  const memo: VoiceMemoData = {
    id: generateId(),
    blobRef,
    durationSeconds,
    createdAt: Date.now(),
    analysis,
  };

  privateDen.ydoc.transact(() => {
    privateDen.voiceMemos.push([memo]);
  });

  // If there's mood data, also append to the mood journal
  if (analysis) {
    await appendMoodEntry(denId, {
      voiceMemoId: memo.id,
      mood: analysis.mood,
      valence: analysis.valence,
      arousal: analysis.arousal,
    });
  }

  return memo;
}

/**
 * Returns all voice memos for a den, newest-first.
 */
export async function getAllVoiceMemos(
  denId: string,
): Promise<VoiceMemoData[]> {
  const { privateDen } = await openDen(denId);
  const memos = privateDen.voiceMemos.toArray();
  return [...memos].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Returns a single voice memo by ID, or undefined.
 */
export async function getVoiceMemo(
  denId: string,
  memoId: string,
): Promise<VoiceMemoData | undefined> {
  const { privateDen } = await openDen(denId);
  return privateDen.voiceMemos.toArray().find((m) => m.id === memoId);
}

/**
 * Attaches (or updates) analysis results on an existing voice memo.
 * Call this when @meerkat/analyzer completes its analysis asynchronously
 * after the initial save.
 *
 * @throws {Error} if the memo is not found.
 */
export async function attachAnalysis(
  denId: string,
  memoId: string,
  analysis: NonNullable<VoiceMemoData["analysis"]>,
): Promise<VoiceMemoData> {
  const { privateDen } = await openDen(denId);
  const memos = privateDen.voiceMemos.toArray();
  const idx = memos.findIndex((m) => m.id === memoId);

  if (idx === -1) {
    throw new Error(`Voice memo not found: ${memoId}`);
  }

  const updated: VoiceMemoData = { ...memos[idx]!, analysis };

  // Yjs arrays don't support in-place update — delete and re-insert
  privateDen.ydoc.transact(() => {
    privateDen.voiceMemos.delete(idx, 1);
    privateDen.voiceMemos.insert(idx, [updated]);
  });

  // Append mood journal entry
  await appendMoodEntry(denId, {
    voiceMemoId: memoId,
    mood: analysis.mood,
    valence: analysis.valence,
    arousal: analysis.arousal,
  });

  return updated;
}

// ─── Mood journal (private, append-only) ─────────────────────────────────────

type MoodEntryInput = Omit<MoodEntry, "id" | "recordedAt">;

async function appendMoodEntry(
  denId: string,
  input: MoodEntryInput,
): Promise<MoodEntry> {
  const { privateDen } = await openDen(denId);

  const entry: MoodEntry = {
    id: generateId(),
    recordedAt: Date.now(),
    ...input,
  };

  privateDen.ydoc.transact(() => {
    privateDen.moodJournal.push([entry]);
  });

  return entry;
}

/**
 * Returns all mood journal entries, oldest-first.
 * Useful for charting emotion history over time.
 */
export async function getMoodJournal(denId: string): Promise<MoodEntry[]> {
  const { privateDen } = await openDen(denId);
  return privateDen.moodJournal.toArray();
}
