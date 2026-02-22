/**
 * @meerkat/local-store — test suite
 *
 * Uses vitest with a fake-indexeddb polyfill so tests run in Node
 * without a real browser environment.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── IndexedDB polyfill ───────────────────────────────────────────────────────
// y-indexeddb requires a real IDB environment. We polyfill it in Node.
// Install: npm install -D fake-indexeddb
import "fake-indexeddb/auto";

// ─── Imports under test ───────────────────────────────────────────────────────
import {
  openDen,
  closeDen,
  isDenOpen,
  createNote,
  getNote,
  getAllNotes,
  searchNotes,
  updateNote,
  deleteNote,
  addVoiceMemo,
  getAllVoiceMemos,
  getVoiceMemo,
  attachAnalysis,
  getMoodJournal,
  addToDropbox,
  getDropboxItems,
  clearDropbox,
  deleteDropboxItem,
  getSetting,
  setSetting,
  deleteSetting,
  getAllSettings,
  clearDenLocalData,
  exportDen,
  importDenState,
} from "../index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEN_ID = "test-den-001";
const DEN_ID_2 = "test-den-002";

async function freshDen(id = DEN_ID) {
  // Ensure we start with a truly blank slate by wiping IndexedDB
  await clearDenLocalData(id);
  return openDen(id);
}

// ─── Den lifecycle ────────────────────────────────────────────────────────────

describe("openDen / closeDen", () => {
  afterEach(() => {
    closeDen(DEN_ID);
    closeDen(DEN_ID_2);
  });

  it("opens a den and returns private and shared docs", async () => {
    const { privateDen, sharedDen } = await openDen(DEN_ID);
    expect(privateDen).toBeDefined();
    expect(sharedDen).toBeDefined();
    expect(privateDen.ydoc).toBeDefined();
    expect(sharedDen.ydoc).toBeDefined();
  });

  it("returns the same cached instance on repeated calls", async () => {
    const a = await openDen(DEN_ID);
    const b = await openDen(DEN_ID);
    expect(a.privateDen).toBe(b.privateDen);
  });

  it("isDenOpen reflects open/closed state", async () => {
    expect(isDenOpen(DEN_ID)).toBe(false);
    await openDen(DEN_ID);
    expect(isDenOpen(DEN_ID)).toBe(true);
    closeDen(DEN_ID);
    expect(isDenOpen(DEN_ID)).toBe(false);
  });

  it("multiple dens can be open simultaneously", async () => {
    await openDen(DEN_ID);
    await openDen(DEN_ID_2);
    expect(isDenOpen(DEN_ID)).toBe(true);
    expect(isDenOpen(DEN_ID_2)).toBe(true);
  });
});

// ─── Notes ───────────────────────────────────────────────────────────────────

describe("notes", () => {
  beforeEach(async () => {
    await freshDen();
  });
  afterEach(() => {
    closeDen(DEN_ID);
  });

  it("creates a note and reads it back", async () => {
    const note = await createNote(DEN_ID, { content: "Hello, Meerkat" });
    expect(note.id).toBeTruthy();
    expect(note.content).toBe("Hello, Meerkat");
    expect(note.isShared).toBe(false);
    expect(note.tags).toEqual([]);

    const fetched = await getNote(DEN_ID, note.id);
    expect(fetched).toEqual(note);
  });

  it("creates a shared note and mirrors it to the shared doc", async () => {
    const note = await createNote(DEN_ID, {
      content: "Visible to visitors",
      isShared: true,
    });

    const { sharedDen } = await openDen(DEN_ID);
    expect(sharedDen.sharedNotes.has(note.id)).toBe(true);
  });

  it("getAllNotes returns all notes sorted newest-first", async () => {
    await createNote(DEN_ID, { content: "First" });
    await createNote(DEN_ID, { content: "Second" });
    await createNote(DEN_ID, { content: "Third" });

    const notes = await getAllNotes(DEN_ID);
    expect(notes).toHaveLength(3);
    // Newest updatedAt should be first
    expect(notes[0]!.updatedAt >= notes[1]!.updatedAt).toBe(true);
  });

  it("getNote returns undefined for missing IDs", async () => {
    const result = await getNote(DEN_ID, "does-not-exist");
    expect(result).toBeUndefined();
  });

  it("updateNote changes only the provided fields", async () => {
    const note = await createNote(DEN_ID, { content: "Original" });
    const updated = await updateNote(DEN_ID, note.id, { content: "Revised" });

    expect(updated.content).toBe("Revised");
    expect(updated.id).toBe(note.id);
    expect(updated.createdAt).toBe(note.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(note.updatedAt);
  });

  it("updateNote sharing a note adds it to shared doc", async () => {
    const note = await createNote(DEN_ID, { content: "Private" });
    await updateNote(DEN_ID, note.id, { isShared: true });

    const { sharedDen } = await openDen(DEN_ID);
    expect(sharedDen.sharedNotes.has(note.id)).toBe(true);
  });

  it("updateNote un-sharing a note removes it from shared doc", async () => {
    const note = await createNote(DEN_ID, {
      content: "Was shared",
      isShared: true,
    });
    await updateNote(DEN_ID, note.id, { isShared: false });

    const { sharedDen } = await openDen(DEN_ID);
    expect(sharedDen.sharedNotes.has(note.id)).toBe(false);
  });

  it("updateNote throws for missing ID", async () => {
    await expect(updateNote(DEN_ID, "ghost", { content: "x" })).rejects.toThrow(
      "Note not found: ghost",
    );
  });

  it("deleteNote removes from private and shared docs", async () => {
    const note = await createNote(DEN_ID, {
      content: "Delete me",
      isShared: true,
    });
    await deleteNote(DEN_ID, note.id);

    expect(await getNote(DEN_ID, note.id)).toBeUndefined();

    const { sharedDen } = await openDen(DEN_ID);
    expect(sharedDen.sharedNotes.has(note.id)).toBe(false);
  });

  it("deleteNote throws for missing ID", async () => {
    await expect(deleteNote(DEN_ID, "ghost")).rejects.toThrow(
      "Note not found: ghost",
    );
  });
});

// ─── searchNotes ─────────────────────────────────────────────────────────────

describe("searchNotes", () => {
  beforeEach(async () => {
    await freshDen();
    await createNote(DEN_ID, {
      content: "Morning coffee ritual",
      tags: ["morning"],
    });
    await createNote(DEN_ID, {
      content: "Evening walk thoughts",
      tags: ["evening"],
    });
    await createNote(DEN_ID, {
      content: "Shared coffee notes",
      isShared: true,
      tags: ["coffee"],
    });
  });
  afterEach(() => closeDen(DEN_ID));

  it("returns notes matching a query string", async () => {
    const results = await searchNotes(DEN_ID, { query: "coffee" });
    expect(results).toHaveLength(2);
  });

  it("filters by tags", async () => {
    const results = await searchNotes(DEN_ID, { query: "", tags: ["morning"] });
    expect(results).toHaveLength(1);
    expect(results[0]!.content).toContain("Morning");
  });

  it("filters sharedOnly notes", async () => {
    const results = await searchNotes(DEN_ID, { query: "", sharedOnly: true });
    expect(results.every((n) => n.isShared)).toBe(true);
  });

  it("respects the limit option", async () => {
    const results = await searchNotes(DEN_ID, { query: "", limit: 1 });
    expect(results).toHaveLength(1);
  });
});

// ─── Voice memos ─────────────────────────────────────────────────────────────

describe("voice memos", () => {
  beforeEach(async () => {
    await freshDen();
  });
  afterEach(() => {
    closeDen(DEN_ID);
  });

  it("adds a voice memo and retrieves it", async () => {
    const memo = await addVoiceMemo(DEN_ID, "blobs/test.enc", 42);
    expect(memo.id).toBeTruthy();
    expect(memo.blobRef).toBe("blobs/test.enc");
    expect(memo.durationSeconds).toBe(42);
    expect(memo.analysis).toBeUndefined();

    const fetched = await getVoiceMemo(DEN_ID, memo.id);
    expect(fetched).toEqual(memo);
  });

  it("adds a mood journal entry when analysis is provided", async () => {
    const analysis = {
      transcript: "Feeling good today",
      mood: "happy",
      tone: "positive",
      valence: 0.8,
      arousal: 0.6,
      confidence: 0.92,
      analysedAt: Date.now(),
    };

    await addVoiceMemo(DEN_ID, "blobs/a.enc", 30, analysis);
    const journal = await getMoodJournal(DEN_ID);
    expect(journal).toHaveLength(1);
    expect(journal[0]!.mood).toBe("happy");
  });

  it("getAllVoiceMemos returns newest-first", async () => {
    await addVoiceMemo(DEN_ID, "a.enc", 10);
    await addVoiceMemo(DEN_ID, "b.enc", 20);
    const memos = await getAllVoiceMemos(DEN_ID);
    expect(memos[0]!.createdAt >= memos[1]!.createdAt).toBe(true);
  });

  it("attachAnalysis updates an existing memo", async () => {
    const memo = await addVoiceMemo(DEN_ID, "test.enc", 15);
    expect(memo.analysis).toBeUndefined();

    const analysis = {
      transcript: "Hello world",
      mood: "neutral",
      tone: "calm",
      valence: 0.5,
      arousal: 0.3,
      confidence: 0.85,
      analysedAt: Date.now(),
    };

    const updated = await attachAnalysis(DEN_ID, memo.id, analysis);
    expect(updated.analysis).toEqual(analysis);
  });

  it("attachAnalysis throws for missing ID", async () => {
    await expect(
      attachAnalysis(DEN_ID, "ghost", {
        transcript: "",
        mood: "x",
        tone: "x",
        valence: 0,
        arousal: 0,
        confidence: 0,
        analysedAt: 0,
      }),
    ).rejects.toThrow("Voice memo not found: ghost");
  });
});

// ─── Dropbox ─────────────────────────────────────────────────────────────────

describe("dropbox", () => {
  beforeEach(async () => {
    await freshDen();
  });
  afterEach(() => {
    closeDen(DEN_ID);
  });

  it("adds items and retrieves them", async () => {
    const item = await addToDropbox(DEN_ID, "visitor-001", "encrypted-payload");
    expect(item.id).toBeTruthy();
    expect(item.visitorId).toBe("visitor-001");

    const items = await getDropboxItems(DEN_ID);
    expect(items).toHaveLength(1);
  });

  it("clearDropbox removes all items", async () => {
    await addToDropbox(DEN_ID, "v1", "payload1");
    await addToDropbox(DEN_ID, "v2", "payload2");
    await clearDropbox(DEN_ID);

    const items = await getDropboxItems(DEN_ID);
    expect(items).toHaveLength(0);
  });

  it("clearDropbox is a no-op when empty", async () => {
    await expect(clearDropbox(DEN_ID)).resolves.toBeUndefined();
  });

  it("deleteDropboxItem removes a single item", async () => {
    const a = await addToDropbox(DEN_ID, "v1", "p1");
    await addToDropbox(DEN_ID, "v2", "p2");

    await deleteDropboxItem(DEN_ID, a.id);
    const remaining = await getDropboxItems(DEN_ID);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.visitorId).toBe("v2");
  });

  it("deleteDropboxItem throws for missing ID", async () => {
    await expect(deleteDropboxItem(DEN_ID, "ghost")).rejects.toThrow(
      "Dropbox item not found: ghost",
    );
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

describe("settings", () => {
  beforeEach(async () => {
    await freshDen();
  });
  afterEach(() => {
    closeDen(DEN_ID);
  });

  it("sets and gets a setting", async () => {
    await setSetting(DEN_ID, "theme", "dark");
    const value = await getSetting(DEN_ID, "theme");
    expect(value).toBe("dark");
  });

  it("returns undefined for unset keys", async () => {
    const value = await getSetting(DEN_ID, "nope");
    expect(value).toBeUndefined();
  });

  it("deleteSetting removes a key", async () => {
    await setSetting(DEN_ID, "temp", 42);
    await deleteSetting(DEN_ID, "temp");
    const value = await getSetting(DEN_ID, "temp");
    expect(value).toBeUndefined();
  });

  it("getAllSettings returns all key-value pairs", async () => {
    await setSetting(DEN_ID, "a", 1);
    await setSetting(DEN_ID, "b", "hello");
    const all = await getAllSettings(DEN_ID);
    expect(all).toMatchObject({ a: 1, b: "hello" });
  });
});

// ─── Export / Import ──────────────────────────────────────────────────────────

describe("exportDen / importDenState", () => {
  afterEach(() => {
    closeDen(DEN_ID);
    closeDen(DEN_ID_2);
  });

  it("exports state and imports it into another den", async () => {
    await freshDen(DEN_ID);
    const note = await createNote(DEN_ID, { content: "Export test" });

    const exported = await exportDen(DEN_ID);
    expect(exported.denId).toBe(DEN_ID);
    expect(exported.privateState).toBeInstanceOf(Uint8Array);
    expect(exported.sharedState).toBeInstanceOf(Uint8Array);

    // Import into a fresh second den
    closeDen(DEN_ID_2);
    await openDen(DEN_ID_2);
    await importDenState(DEN_ID_2, { ...exported, denId: DEN_ID_2 });

    const notes = await getAllNotes(DEN_ID_2);
    expect(notes.find((n) => n.id === note.id)).toBeDefined();
  });

  it("importDenState throws on mismatched den ID", async () => {
    await freshDen(DEN_ID);
    const exported = await exportDen(DEN_ID);

    await openDen(DEN_ID_2);
    await expect(importDenState(DEN_ID_2, exported)).rejects.toThrow(
      "Export den ID mismatch",
    );
  });
});
