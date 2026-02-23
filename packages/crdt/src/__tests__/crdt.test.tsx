/**
 * @meerkat/crdt — test suite
 *
 * Tests the orchestration layer: useDen hook, DenProvider, sync state machine,
 * and P2P adapter injection.
 *
 * Uses fake-indexeddb so tests run in Node without a browser.
 * Uses @testing-library/react for hook and component rendering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

// ─── IndexedDB polyfill ───────────────────────────────────────────────────────
import "fake-indexeddb/auto";

// ─── Modules under test ───────────────────────────────────────────────────────
import { useDen } from "../use-den.js";
import { DenProvider, useDenContext } from "../context.js";
import {
  DenSyncMachine,
  getOrCreateMachine,
  destroyMachine,
  resetAllMachines,
} from "../sync-machine.js";
import {
  offlineAdapter,
  setP2PAdapter,
  resetP2PAdapter,
} from "../p2p-adapter.js";
import type { P2PAdapter, SyncStatus } from "../types.js";

// ─── Local-store ops we'll use to seed data ───────────────────────────────────
import { createNote, closeDen } from "@meerkat/local-store";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const DEN_A = "test-crdt-den-a";
const DEN_B = "test-crdt-den-b";

function getUniqueDenId(base: string) {
  return `${base}-${Math.random().toString(36).substring(7)}`;
}

function cleanup() {
  closeDen(DEN_A);
  closeDen(DEN_B);
  destroyMachine(DEN_A);
  destroyMachine(DEN_B);
  resetAllMachines();
  resetP2PAdapter();
}

/** Builds a controllable mock P2P adapter. */
function makeMockAdapter(): P2PAdapter & {
  emitStatus: (denId: string, status: SyncStatus) => void;
  hostDenCalls: string[];
} {
  const statusHandlers = new Map<string, Set<(s: SyncStatus) => void>>();
  const statusMap = new Map<string, SyncStatus>();
  const hostDenCalls: string[] = [];

  function emitStatus(denId: string, status: SyncStatus) {
    statusMap.set(denId, status);
    for (const handler of statusHandlers.get(denId) ?? []) {
      handler(status);
    }
  }

  return {
    hostDenCalls,
    emitStatus,

    hostDen(denId: string) {
      hostDenCalls.push(denId);
      return () => {
        /* cleanup */
      };
    },

    getStatus(denId: string): SyncStatus {
      return statusMap.get(denId) ?? "offline";
    },

    onStatusChange(denId: string, handler: (s: SyncStatus) => void) {
      if (!statusHandlers.has(denId)) {
        statusHandlers.set(denId, new Set());
      }
      statusHandlers.get(denId)!.add(handler);
      return () => statusHandlers.get(denId)?.delete(handler);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DenSyncMachine
// ─────────────────────────────────────────────────────────────────────────────

describe("DenSyncMachine", () => {
  afterEach(() => {
    resetAllMachines();
    resetP2PAdapter();
  });

  it("starts in offline state when adapter reports offline", () => {
    const adapter = makeMockAdapter();
    const machine = new DenSyncMachine(DEN_A, adapter);
    expect(machine.status).toBe("offline");
  });

  it("transitions to synced when adapter emits synced", () => {
    const adapter = makeMockAdapter();
    const machine = new DenSyncMachine(DEN_A, adapter);
    const stop = machine.start();

    const statuses: SyncStatus[] = [];
    machine.subscribe((s) => statuses.push(s));

    adapter.emitStatus(DEN_A, "connecting");
    adapter.emitStatus(DEN_A, "synced");

    expect(machine.status).toBe("synced");
    expect(statuses).toEqual(["offline", "connecting", "synced"]);

    stop();
  });

  it("notifies subscribers on status change", () => {
    const adapter = makeMockAdapter();
    const machine = new DenSyncMachine(DEN_A, adapter);
    machine.start();

    const received: SyncStatus[] = [];
    const unsub = machine.subscribe((s) => received.push(s));

    adapter.emitStatus(DEN_A, "connecting");
    adapter.emitStatus(DEN_A, "synced");
    adapter.emitStatus(DEN_A, "hosting");

    unsub();
    adapter.emitStatus(DEN_A, "offline"); // should NOT be received

    expect(received).toEqual(["offline", "connecting", "synced", "hosting"]);
    machine.stop();
  });

  it("transitions to offline when stop() is called", () => {
    const adapter = makeMockAdapter();
    const machine = new DenSyncMachine(DEN_A, adapter);
    machine.start();
    adapter.emitStatus(DEN_A, "synced");

    machine.stop();
    expect(machine.status).toBe("offline");
  });

  it("calls hostDen on the adapter when started", () => {
    const adapter = makeMockAdapter();
    const machine = new DenSyncMachine(DEN_A, adapter);
    machine.start();

    expect(adapter.hostDenCalls).toContain(DEN_A);
    machine.stop();
  });

  it("does not emit duplicate status transitions", () => {
    const adapter = makeMockAdapter();
    const machine = new DenSyncMachine(DEN_A, adapter);
    machine.start();

    const received: SyncStatus[] = [];
    machine.subscribe((s) => received.push(s));

    adapter.emitStatus(DEN_A, "connecting");
    adapter.emitStatus(DEN_A, "connecting"); // duplicate
    adapter.emitStatus(DEN_A, "synced");

    expect(received.filter((s) => s === "connecting")).toHaveLength(1);
    machine.stop();
  });

  it("getOrCreateMachine returns the same instance", () => {
    const adapter = makeMockAdapter();
    const m1 = getOrCreateMachine(DEN_A, adapter);
    const m2 = getOrCreateMachine(DEN_A, adapter);
    expect(m1).toBe(m2);
  });

  it("destroyMachine removes the machine and stops it", () => {
    const adapter = makeMockAdapter();
    const machine = getOrCreateMachine(DEN_A, adapter);
    machine.start();
    adapter.emitStatus(DEN_A, "synced");

    destroyMachine(DEN_A);

    // After destroy, a new machine should be created
    const machine2 = getOrCreateMachine(DEN_A, adapter);
    expect(machine2).not.toBe(machine);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Offline adapter
// ─────────────────────────────────────────────────────────────────────────────

describe("offlineAdapter", () => {
  it("always returns offline status", () => {
    expect(offlineAdapter.getStatus("any-den")).toBe("offline");
  });

  it("never fires status change handlers", () => {
    const handler = vi.fn();
    const unsub = offlineAdapter.onStatusChange("any-den", handler);
    unsub();
    expect(handler).not.toHaveBeenCalled();
  });

  it("hostDen returns a no-op cleanup", () => {
    const cleanup = offlineAdapter.hostDen("any-den");
    expect(() => cleanup()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useDen hook — standalone mode
// ─────────────────────────────────────────────────────────────────────────────

describe("useDen — standalone", () => {
  beforeEach(() => {
    cleanup();
    setP2PAdapter(offlineAdapter);
  });
  afterEach(cleanup);

  it("starts loading and then resolves with empty content", async () => {
    const denId = getUniqueDenId(DEN_A);
    const { result } = renderHook(() => useDen(denId));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.notes).toEqual([]);
    expect(result.current.voiceMemos).toEqual([]);
    expect(result.current.shared.notes).toEqual([]);
    expect(result.current.visitors).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("reflects notes created via local-store", async () => {
    const denId = getUniqueDenId(DEN_A);
    const { result } = renderHook(() => useDen(denId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Create a note via local-store (bypassing the hook)
    await act(async () => {
      await createNote(denId, { content: "Hello from test" });
    });

    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    expect(result.current.notes[0]!.content).toBe("Hello from test");
  });

  it("reflects notes created via actions.createNote", async () => {
    const denId = getUniqueDenId(DEN_A);
    const { result } = renderHook(() => useDen(denId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.actions.createNote({ content: "Via actions" });
    });

    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    expect(result.current.notes[0]!.content).toBe("Via actions");
  });

  it("updates a note and reflects in notes array", async () => {
    const denId = getUniqueDenId(DEN_A);
    const { result } = renderHook(() => useDen(denId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let noteId = "";
    await act(async () => {
      const n = await result.current.actions.createNote({ content: "Before" });
      noteId = n.id;
    });
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    await act(async () => {
      await result.current.actions.updateNote(noteId, { content: "After" });
    });
    await waitFor(() => expect(result.current.notes[0]!.content).toBe("After"));
  });

  it("deletes a note and removes it from the array", async () => {
    const denId = getUniqueDenId(DEN_A);
    const { result } = renderHook(() => useDen(denId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let noteId = "";
    await act(async () => {
      const n = await result.current.actions.createNote({
        content: "Delete me",
      });
      noteId = n.id;
    });
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    await act(async () => {
      await result.current.actions.deleteNote(noteId);
    });
    await waitFor(() => expect(result.current.notes).toHaveLength(0));
  });

  it("surfaces a shared note in shared.notes when isShared: true", async () => {
    const denId = getUniqueDenId(DEN_A);
    const { result } = renderHook(() => useDen(denId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.actions.createNote({
        content: "Public note",
        isShared: true,
      });
    });

    await waitFor(() => expect(result.current.shared.notes).toHaveLength(1));
    expect(result.current.shared.notes[0]!.content).toBe("Public note");
    // Private notes also include it
    expect(result.current.notes).toHaveLength(1);
  });

  it("searchNotes filters by query", async () => {
    const denId = getUniqueDenId(DEN_A);
    const { result } = renderHook(() => useDen(denId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.actions.createNote({ content: "Coffee thoughts" });
      await result.current.actions.createNote({ content: "Evening walk" });
    });
    await waitFor(() => expect(result.current.notes).toHaveLength(2));

    const found = await result.current.actions.searchNotes({ query: "coffee" });
    expect(found).toHaveLength(1);
    expect(found[0]!.content).toContain("Coffee");
  });

  it("syncStatus updates when mock adapter emits connecting then synced", async () => {
    const mockAdapter = makeMockAdapter();
    setP2PAdapter(mockAdapter);
    resetAllMachines();

    const denId = getUniqueDenId(DEN_A);
    const { result } = renderHook(() => useDen(denId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      mockAdapter.emitStatus(denId, "connecting");
    });
    await waitFor(() => expect(result.current.syncStatus).toBe("connecting"));

    act(() => {
      mockAdapter.emitStatus(denId, "synced");
    });
    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
  });

  it("actions are stable references across re-renders", async () => {
    const denId = getUniqueDenId(DEN_A);
    const { result, rerender } = renderHook(() => useDen(denId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const firstActions = result.current.actions;
    rerender();
    const secondActions = result.current.actions;

    expect(firstActions.createNote).toBe(secondActions.createNote);
    expect(firstActions.deleteNote).toBe(secondActions.deleteNote);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DenProvider + useDenContext
// ─────────────────────────────────────────────────────────────────────────────

describe("DenProvider / useDenContext", () => {
  beforeEach(() => {
    cleanup();
    setP2PAdapter(offlineAdapter);
  });
  afterEach(cleanup);

  it("provides den state to descendant components", async () => {
    const denId = getUniqueDenId(DEN_B);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DenProvider denId={denId}>{children}</DenProvider>
    );

    const { result } = renderHook(() => useDenContext(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.notes).toEqual([]);
    expect(result.current.syncStatus).toBe("offline");
  });

  it("provides live notes created via actions", async () => {
    const denId = getUniqueDenId(DEN_B);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DenProvider denId={denId}>{children}</DenProvider>
    );

    const { result } = renderHook(() => useDenContext(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.actions.createNote({ content: "Context note" });
    });

    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    expect(result.current.notes[0]!.content).toBe("Context note");
  });

  it("throws when useDenContext is used outside a DenProvider", () => {
    // Suppress the console.error from React for this intentional error
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => {
      renderHook(() => useDenContext());
    }).toThrow("must be called inside a <DenProvider>");

    spy.mockRestore();
  });

  it("useDen reads from DenProvider context when inside one", async () => {
    const denId = getUniqueDenId(DEN_B);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DenProvider denId={denId}>{children}</DenProvider>
    );

    // useDen(denId) inside a DenProvider(denId) should return the context value
    const { result } = renderHook(() => useDen(denId), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.actions.createNote({ content: "From context" });
    });

    await waitFor(() => expect(result.current.notes).toHaveLength(1));
  });

  it("readOnly DenProvider does not start the sync machine", async () => {
    const mockAdapter = makeMockAdapter();
    setP2PAdapter(mockAdapter);
    resetAllMachines();

    const denId = getUniqueDenId(DEN_B);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DenProvider denId={denId} readOnly>
        {children}
      </DenProvider>
    );

    const { result } = renderHook(() => useDenContext(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // hostDen should NOT have been called for this den
    expect(mockAdapter.hostDenCalls).not.toContain(denId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Supabase removal verification
// ─────────────────────────────────────────────────────────────────────────────

describe("no Supabase Realtime", () => {
  it("@meerkat/crdt source files do not import from supabase", async () => {
    // Read source files and verify no Supabase Realtime imports exist
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");

    const srcDir = join(process.cwd(), "src");
    const files = readdirSync(srcDir).filter(
      (f: string) => f.endsWith(".ts") || f.endsWith(".tsx"),
    );

    const supabasePatterns = [
      "supabase.channel",
      "postgres_changes",
      "removeChannel",
      "Realtime",
      "presenceState",
      ".track(",
    ];

    for (const file of files) {
      if (file === "migration-notes.ts") continue; // this file documents OLD code
      const content = readFileSync(join(srcDir, file), "utf-8");
      for (const pattern of supabasePatterns) {
        expect(
          content,
          `${file} should not contain Supabase Realtime pattern: "${pattern}"`,
        ).not.toContain(pattern);
      }
    }
  });
});
