"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { PresenceInfo, DropboxItem } from "@meerkat/local-store";

interface UseDenNotificationsOptions {
  denName: string;
  visitors: PresenceInfo[];
  dropboxItems: DropboxItem[];
  /** Only hosts receive drops — skip drop toasts and badge when false. */
  isOwner: boolean;
}

/**
 * Fires Sonner toasts for P2P events and keeps document.title in sync with
 * an unread-drop badge for the host.
 *
 * - Visitor joined / left → toast
 * - New drop arrives in Letterbox → toast.success + "(N) Den name" title
 * - Unmount → title restored to bare den name
 */
export function useDenNotifications({
  denName,
  visitors,
  dropboxItems,
  isOwner,
}: UseDenNotificationsOptions) {
  // null = not yet seeded (first render). We skip toasts on mount so we don't
  // replay events for state that was already present when the page loaded.
  const prevVisitorsRef = useRef<PresenceInfo[] | null>(null);
  const seenDropIdsRef = useRef<Set<string> | null>(null);
  const unreadDropsRef = useRef(0);

  // ── Visitor join / leave toasts ────────────────────────────────────────────
  useEffect(() => {
    if (prevVisitorsRef.current === null) {
      prevVisitorsRef.current = visitors;
      return;
    }

    const prev = prevVisitorsRef.current;

    for (const v of visitors) {
      if (!prev.find((p) => p.visitorId === v.visitorId)) {
        toast(`${v.displayName} joined`);
      }
    }

    for (const v of prev) {
      if (!visitors.find((c) => c.visitorId === v.visitorId)) {
        toast(`${v.displayName} left`);
      }
    }

    prevVisitorsRef.current = visitors;
  }, [visitors]);

  // ── Drop received toast ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOwner) return;

    if (seenDropIdsRef.current === null) {
      // Seed on first mount — no toast for pre-existing drops.
      seenDropIdsRef.current = new Set(dropboxItems.map((d) => d.id));
      return;
    }

    const seen = seenDropIdsRef.current;
    const newDrops = dropboxItems.filter((d) => !seen.has(d.id));

    if (newDrops.length > 0) {
      unreadDropsRef.current += newDrops.length;
      for (const d of newDrops) seen.add(d.id);
      toast.success(
        newDrops.length === 1
          ? "New drop received in Letterbox"
          : `${newDrops.length} new drops received in Letterbox`,
      );
    }

    // Prune IDs for drops that were deleted by the host so the set stays tidy.
    const currentIds = new Set(dropboxItems.map((d) => d.id));
    for (const id of seen) {
      if (!currentIds.has(id)) seen.delete(id);
    }
  }, [dropboxItems, isOwner]);

  // ── Document title badge ───────────────────────────────────────────────────
  // Runs after the drop effect (declared later) so unreadDropsRef is already
  // incremented when this reads it.
  useEffect(() => {
    document.title =
      unreadDropsRef.current > 0
        ? `(${unreadDropsRef.current}) ${denName}`
        : denName;
  }, [dropboxItems, denName]);

  // Restore to bare den name on unmount (navigation away from the page).
  useEffect(() => {
    return () => {
      document.title = denName;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
