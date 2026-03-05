/**
 * @meerkat/editor — test suite
 *
 * Tests the slash command utilities, block type filtering, and the
 * BurrowEditor component render lifecycle.
 *
 * Tiptap's ProseMirror internals require jsdom. Heavy collaboration
 * features (Yjs sync, cursors) are integration-tested at the app level.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import * as Y from "yjs";

// ─── IndexedDB polyfill (needed if Yjs accesses IDB during tests) ─────────────
import "fake-indexeddb/auto";

// ─── Modules under test ───────────────────────────────────────────────────────
import {
  buildSlashItems,
  filterSlashItems,
} from "../extensions/slash-commands.js";
import { BurrowEditor } from "../block-editor.js";

// ─── Slash command utilities ──────────────────────────────────────────────────

describe("buildSlashItems", () => {
  it("returns all built-in block types", () => {
    const items = buildSlashItems();
    expect(items.length).toBeGreaterThan(0);

    const titles = items.map((i) => i.title);
    expect(titles).toContain("Text");
    expect(titles).toContain("Heading 1");
    expect(titles).toContain("Bullet list");
    expect(titles).toContain("To-do list");
    expect(titles).toContain("Code block");
    expect(titles).toContain("Voice note");
    expect(titles).toContain("Image");
  });

  it("each item has a command function", () => {
    const items = buildSlashItems();
    for (const item of items) {
      expect(typeof item.command).toBe("function");
    }
  });
});

describe("filterSlashItems", () => {
  const all = buildSlashItems();

  it("returns all items when query is empty", () => {
    expect(filterSlashItems(all, "")).toEqual(all);
  });

  it("filters by title (case-insensitive)", () => {
    const results = filterSlashItems(all, "head");
    expect(results.every((i) => i.title.toLowerCase().includes("head"))).toBe(true);
    expect(results.length).toBe(3); // Heading 1, 2, 3
  });

  it("filters by description", () => {
    const results = filterSlashItems(all, "checkbox");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("To-do list");
  });

  it("returns empty array for unmatched query", () => {
    const results = filterSlashItems(all, "zzz-no-match");
    expect(results).toHaveLength(0);
  });
});

// ─── BurrowEditor component ───────────────────────────────────────────────────

describe("BurrowEditor", () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders without crashing with a fresh Y.Doc", () => {
    render(
      <BurrowEditor
        doc={doc}
        user={{ name: "Alice", color: "#7c3aed" }}
        title="Test Page"
      />,
    );
    // The title div should be present
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });

  it("renders the page title", () => {
    render(
      <BurrowEditor
        doc={doc}
        user={{ name: "Alice", color: "#7c3aed" }}
        title="My Burrow"
      />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("My Burrow");
  });

  it("renders in read-only mode without crashing", () => {
    render(
      <BurrowEditor
        doc={doc}
        user={{ name: "Alice", color: "#7c3aed" }}
        title="Read Only"
        readOnly
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });

  it("calls onTitleChange when title input fires", async () => {
    const onTitleChange = vi.fn();
    render(
      <BurrowEditor
        doc={doc}
        user={{ name: "Alice", color: "#7c3aed" }}
        title="Old"
        onTitleChange={onTitleChange}
      />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    heading.textContent = "New Title";
    heading.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onTitleChange).toHaveBeenCalledWith("New Title");
  });
});
