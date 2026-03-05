/**
 * @meerkat/burrows — test suite
 *
 * Tests the burrow store: lifecycle, CRUD, soft-delete, block content docs,
 * and active-burrow tracking.
 *
 * Uses fake-indexeddb so tests run in Node without a real browser.
 */

import { describe, it, expect, afterEach } from "vitest";

// ─── IndexedDB polyfill ───────────────────────────────────────────────────────
import "fake-indexeddb/auto";

// ─── Modules under test ───────────────────────────────────────────────────────
import {
  openBurrowsDoc,
  closeBurrowsDoc,
  openBurrowContentDoc,
  closeBurrowContentDoc,
  createBurrow,
  getBurrow,
  getAllBurrows,
  getBurrowsByDen,
  updateBurrow,
  archiveBurrow,
  restoreBurrow,
  deleteBurrow,
  setCurrentBurrow,
  getCurrentBurrowId,
  getBurrowMetadata,
  setBurrowMetadata,
} from "../store.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEN_ID = "test-burrows-den-001";
const USER_ID = "user-abc";

function uniqueDen() {
  return `test-den-${Math.random().toString(36).slice(2, 8)}`;
}

afterEach(() => {
  closeBurrowsDoc(DEN_ID);
});

// ─── openBurrowsDoc ───────────────────────────────────────────────────────────

describe("openBurrowsDoc", () => {
  it("opens and caches the doc", async () => {
    const doc1 = await openBurrowsDoc(DEN_ID);
    const doc2 = await openBurrowsDoc(DEN_ID);
    expect(doc1).toBe(doc2);
  });

  it("exposes burrows and metadata maps", async () => {
    const { burrows, metadata } = await openBurrowsDoc(DEN_ID);
    expect(burrows).toBeDefined();
    expect(metadata).toBeDefined();
  });
});

// ─── createBurrow ─────────────────────────────────────────────────────────────

describe("createBurrow", () => {
  it("creates a burrow with correct defaults", async () => {
    const denId = uniqueDen();
    const b = await createBurrow({ denId, title: "My Page", createdBy: USER_ID });

    expect(b.id).toBeTruthy();
    expect(b.title).toBe("My Page");
    expect(b.denId).toBe(denId);
    expect(b.createdBy).toBe(USER_ID);
    expect(b.archived).toBe(false);
    expect(b.collaborators).toContain(USER_ID);
    expect(b.yjsDocId).toBeTruthy();
    expect(b.order).toBeGreaterThan(0);
    expect(b.createdAt).toBeGreaterThan(0);
    expect(b.updatedAt).toBeGreaterThan(0);

    closeBurrowsDoc(denId);
  });

  it("creates multiple burrows with increasing order", async () => {
    const denId = uniqueDen();
    const b1 = await createBurrow({ denId, title: "First", createdBy: USER_ID });
    const b2 = await createBurrow({ denId, title: "Second", createdBy: USER_ID });
    const b3 = await createBurrow({ denId, title: "Third", createdBy: USER_ID });

    expect(b2.order).toBeGreaterThan(b1.order);
    expect(b3.order).toBeGreaterThan(b2.order);

    closeBurrowsDoc(denId);
  });

  it("pre-opens the content doc", async () => {
    const denId = uniqueDen();
    const b = await createBurrow({ denId, title: "Page", createdBy: USER_ID });

    const contentDoc = await openBurrowContentDoc(b.yjsDocId);
    expect(contentDoc.ydoc).toBeDefined();
    expect(contentDoc.fragment).toBeDefined();

    closeBurrowContentDoc(b.yjsDocId);
    closeBurrowsDoc(denId);
  });
});

// ─── getBurrow / getAllBurrows ─────────────────────────────────────────────────

describe("getBurrow", () => {
  it("returns the burrow by id", async () => {
    const denId = uniqueDen();
    const created = await createBurrow({ denId, title: "Lookup", createdBy: USER_ID });
    const found = await getBurrow(denId, created.id);

    expect(found?.id).toBe(created.id);
    expect(found?.title).toBe("Lookup");
    closeBurrowsDoc(denId);
  });

  it("returns undefined for unknown id", async () => {
    const denId = uniqueDen();
    const found = await getBurrow(denId, "nonexistent");
    expect(found).toBeUndefined();
    closeBurrowsDoc(denId);
  });
});

describe("getAllBurrows / getBurrowsByDen", () => {
  it("returns non-archived burrows sorted by order", async () => {
    const denId = uniqueDen();
    await createBurrow({ denId, title: "A", createdBy: USER_ID });
    await createBurrow({ denId, title: "B", createdBy: USER_ID });
    await createBurrow({ denId, title: "C", createdBy: USER_ID });

    const all = await getAllBurrows(denId);
    expect(all).toHaveLength(3);
    expect(all[0]?.order).toBeLessThan(all[1]?.order ?? Infinity);
    expect(all[1]?.order).toBeLessThan(all[2]?.order ?? Infinity);

    closeBurrowsDoc(denId);
  });

  it("getBurrowsByDen is an alias for getAllBurrows", async () => {
    const denId = uniqueDen();
    await createBurrow({ denId, title: "X", createdBy: USER_ID });

    const a = await getAllBurrows(denId);
    const b = await getBurrowsByDen(denId);
    expect(a).toEqual(b);

    closeBurrowsDoc(denId);
  });
});

// ─── updateBurrow ─────────────────────────────────────────────────────────────

describe("updateBurrow", () => {
  it("updates the title", async () => {
    const denId = uniqueDen();
    const b = await createBurrow({ denId, title: "Old Title", createdBy: USER_ID });
    const updated = await updateBurrow(denId, b.id, { title: "New Title" });

    expect(updated.title).toBe("New Title");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(b.updatedAt);

    closeBurrowsDoc(denId);
  });

  it("throws when burrow not found", async () => {
    const denId = uniqueDen();
    await expect(
      updateBurrow(denId, "ghost", { title: "x" }),
    ).rejects.toThrow("Burrow not found");
    closeBurrowsDoc(denId);
  });
});

// ─── archiveBurrow / restoreBurrow ────────────────────────────────────────────

describe("archiveBurrow / restoreBurrow", () => {
  it("sets archived:true and hides from getAllBurrows", async () => {
    const denId = uniqueDen();
    const b = await createBurrow({ denId, title: "Draft", createdBy: USER_ID });
    await archiveBurrow(denId, b.id);

    const all = await getAllBurrows(denId);
    expect(all.find((x) => x.id === b.id)).toBeUndefined();

    const raw = await getBurrow(denId, b.id);
    expect(raw?.archived).toBe(true);

    closeBurrowsDoc(denId);
  });

  it("restoreBurrow makes it visible again", async () => {
    const denId = uniqueDen();
    const b = await createBurrow({ denId, title: "Hidden", createdBy: USER_ID });
    await archiveBurrow(denId, b.id);
    await restoreBurrow(denId, b.id);

    const all = await getAllBurrows(denId);
    expect(all.find((x) => x.id === b.id)).toBeDefined();

    closeBurrowsDoc(denId);
  });
});

// ─── deleteBurrow ─────────────────────────────────────────────────────────────

describe("deleteBurrow", () => {
  it("removes the burrow permanently", async () => {
    const denId = uniqueDen();
    const b = await createBurrow({ denId, title: "Gone", createdBy: USER_ID });
    await deleteBurrow(denId, b.id);

    const found = await getBurrow(denId, b.id);
    expect(found).toBeUndefined();

    closeBurrowsDoc(denId);
  });

  it("throws when burrow not found", async () => {
    const denId = uniqueDen();
    await expect(deleteBurrow(denId, "ghost")).rejects.toThrow("Burrow not found");
    closeBurrowsDoc(denId);
  });
});

// ─── setCurrentBurrow / getCurrentBurrowId ────────────────────────────────────

describe("setCurrentBurrow / getCurrentBurrowId", () => {
  it("tracks the active burrow", () => {
    setCurrentBurrow("den-x", "burrow-1");
    expect(getCurrentBurrowId("den-x")).toBe("burrow-1");
  });

  it("can be cleared to null", () => {
    setCurrentBurrow("den-x", "burrow-1");
    setCurrentBurrow("den-x", null);
    expect(getCurrentBurrowId("den-x")).toBeNull();
  });

  it("returns null for unknown den", () => {
    expect(getCurrentBurrowId("den-unknown")).toBeNull();
  });
});

// ─── getBurrowMetadata / setBurrowMetadata ────────────────────────────────────

describe("getBurrowMetadata / setBurrowMetadata", () => {
  it("round-trips metadata", async () => {
    const denId = uniqueDen();
    const b = await createBurrow({ denId, title: "Doc", createdBy: USER_ID });

    await setBurrowMetadata(denId, b.id, {
      wordCount: 42,
      lastEditedBy: USER_ID,
      hasVoiceNotes: true,
      hasImages: false,
    });

    const meta = await getBurrowMetadata(denId, b.id);
    expect(meta?.wordCount).toBe(42);
    expect(meta?.lastEditedBy).toBe(USER_ID);
    expect(meta?.hasVoiceNotes).toBe(true);
    expect(meta?.hasImages).toBe(false);

    closeBurrowsDoc(denId);
  });

  it("returns undefined before any metadata is set", async () => {
    const denId = uniqueDen();
    const b = await createBurrow({ denId, title: "Empty", createdBy: USER_ID });
    const meta = await getBurrowMetadata(denId, b.id);
    expect(meta).toBeUndefined();
    closeBurrowsDoc(denId);
  });
});

// ─── openBurrowContentDoc ─────────────────────────────────────────────────────

describe("openBurrowContentDoc", () => {
  it("returns a Y.Doc with a default XmlFragment", async () => {
    const contentDoc = await openBurrowContentDoc("test-yjsdoc-id");
    expect(contentDoc.ydoc).toBeDefined();
    expect(contentDoc.fragment).toBeDefined();
    closeBurrowContentDoc("test-yjsdoc-id");
  });

  it("caches the doc on repeated calls", async () => {
    const id = "cached-yjs-id";
    const a = await openBurrowContentDoc(id);
    const b = await openBurrowContentDoc(id);
    expect(a).toBe(b);
    closeBurrowContentDoc(id);
  });
});
