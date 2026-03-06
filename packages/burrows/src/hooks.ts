/**
 * @meerkat/burrows — React hooks
 *
 * All metadata hooks subscribe to Yjs observer events so components
 * re-render automatically when burrow data changes.
 *
 * `useBurrowDoc` returns the raw Y.Doc for a burrow's content — pass it
 * directly to `<BurrowEditor doc={doc} />` from @meerkat/editor.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import * as Y from "yjs";
import {
  openBurrowsDoc,
  openBurrowContentDoc,
  createBurrow as storeCreateBurrow,
  updateBurrow as storeUpdateBurrow,
  archiveBurrow as storeArchiveBurrow,
  restoreBurrow as storeRestoreBurrow,
  deleteBurrow as storeDeleteBurrow,
  setCurrentBurrow as storeSetCurrentBurrow,
} from "./store.js";
import type {
  BurrowData,
  BurrowMetadata,
  CreateBurrowInput,
  UpdateBurrowInput,
} from "./types.js";

// ─── useBurrows ───────────────────────────────────────────────────────────────

/**
 * Returns all non-archived burrows for a den, sorted by `order`.
 * Re-renders automatically on any change.
 *
 * @example
 * ```tsx
 * const { burrows, actions } = useBurrows(denId);
 * ```
 */
export function useBurrows(denId: string) {
  const [burrows, setBurrows] = useState<BurrowData[]>([]);
  const [metadataMap, setMetadataMap] = useState<
    Record<string, BurrowMetadata>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unobserve: (() => void) | undefined;

    setIsLoading(true);
    setError(null);

    openBurrowsDoc(denId)
      .then((doc) => {
        if (cancelled) return;

        const readBurrows = () => {
          const all = Array.from(doc.burrows.values())
            .filter((b) => !b.archived)
            .sort((a, b) => a.order - b.order);
          setBurrows(all);
        };

        const readMetadata = () => {
          const map: Record<string, BurrowMetadata> = {};
          doc.metadata.forEach((meta, id) => {
            map[id] = meta;
          });
          setMetadataMap(map);
        };

        readBurrows();
        readMetadata();
        setIsLoading(false);
        doc.burrows.observe(readBurrows);
        doc.metadata.observe(readMetadata);
        unobserve = () => {
          doc.burrows.unobserve(readBurrows);
          doc.metadata.unobserve(readMetadata);
        };
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      unobserve?.();
    };
  }, [denId]);

  const actions = {
    createBurrow: useCallback(
      (input: Omit<CreateBurrowInput, "denId">) =>
        storeCreateBurrow({ ...input, denId }),
      [denId],
    ),
    updateBurrow: useCallback(
      (burrowId: string, input: UpdateBurrowInput) =>
        storeUpdateBurrow(denId, burrowId, input),
      [denId],
    ),
    archiveBurrow: useCallback(
      (burrowId: string) => storeArchiveBurrow(denId, burrowId),
      [denId],
    ),
    restoreBurrow: useCallback(
      (burrowId: string) => storeRestoreBurrow(denId, burrowId),
      [denId],
    ),
    deleteBurrow: useCallback(
      (burrowId: string) => storeDeleteBurrow(denId, burrowId),
      [denId],
    ),
    setCurrentBurrow: useCallback(
      (burrowId: string | null) => storeSetCurrentBurrow(denId, burrowId),
      [denId],
    ),
  };

  return { burrows, metadataMap, isLoading, error, actions };
}

// ─── useBurrow ────────────────────────────────────────────────────────────────

/**
 * Returns a single burrow's metadata and computed stats.
 * Re-renders on any change to that burrow.
 *
 * @example
 * ```tsx
 * const { burrow, metadata, actions } = useBurrow(denId, burrowId);
 * ```
 */
export function useBurrow(denId: string, burrowId: string) {
  const [burrow, setBurrow] = useState<BurrowData | null>(null);
  const [metadata, setMetadata] = useState<BurrowMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unobserve: (() => void) | undefined;

    setIsLoading(true);
    setError(null);

    openBurrowsDoc(denId)
      .then((doc) => {
        if (cancelled) return;

        const read = () => {
          setBurrow(doc.burrows.get(burrowId) ?? null);
          setMetadata(doc.metadata.get(burrowId) ?? null);
        };

        read();
        setIsLoading(false);
        doc.burrows.observe(read);
        doc.metadata.observe(read);
        unobserve = () => {
          doc.burrows.unobserve(read);
          doc.metadata.unobserve(read);
        };
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      unobserve?.();
    };
  }, [denId, burrowId]);

  const actions = {
    updateBurrow: useCallback(
      (input: UpdateBurrowInput) => storeUpdateBurrow(denId, burrowId, input),
      [denId, burrowId],
    ),
    archiveBurrow: useCallback(
      () => storeArchiveBurrow(denId, burrowId),
      [denId, burrowId],
    ),
    deleteBurrow: useCallback(
      () => storeDeleteBurrow(denId, burrowId),
      [denId, burrowId],
    ),
  };

  return { burrow, metadata, isLoading, error, actions };
}

// ─── useBurrowDoc ─────────────────────────────────────────────────────────────

/**
 * Loads and returns the Y.Doc for a burrow's block content.
 *
 * Pass the returned `doc` directly to `<BurrowEditor doc={doc} />` from
 * `@meerkat/editor`. Tiptap's Collaboration extension will read/write the
 * Y.XmlFragment named "default" inside this doc.
 *
 * @param yjsDocId — The `burrow.yjsDocId` field from `BurrowData`.
 *
 * @example
 * ```tsx
 * const { doc } = useBurrowDoc(burrow?.yjsDocId);
 * if (!doc) return <Spinner />;
 * return <BurrowEditor doc={doc} awareness={awareness} user={user} />;
 * ```
 */
export function useBurrowDoc(yjsDocId: string | undefined) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!yjsDocId) {
      setDoc(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setDoc(null);

    openBurrowContentDoc(yjsDocId)
      .then((contentDoc) => {
        if (cancelled) return;
        setDoc(contentDoc.ydoc);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [yjsDocId]);

  return { doc, isLoading, error };
}
