"use client";

/**
 * Reports den content activity to the activity store.
 *
 * Call this inside any den page component. It subscribes to notes and voice
 * memos via @meerkat/local-store, finds the latest timestamp, and pushes it
 * to useActivityStore so the home page can show unread dots without opening
 * every den's Yjs doc itself.
 *
 * It also tracks pending letterbox drop counts for owners.
 */

import { useEffect } from "react";
import { useAllNotes, useAllVoiceMemos } from "@meerkat/local-store";
import { useActivityStore } from "@/stores/use-activity-store";

interface Options {
  denId: string;
  /** True for the den owner — also reports pending drop count. */
  isOwner: boolean;
  /** Current dropbox item count from DenContext (owner only). */
  pendingDropCount?: number;
}

export function useDenActivityReporter({
  denId,
  isOwner,
  pendingDropCount = 0,
}: Options) {
  const notes = useAllNotes(denId);
  const memos = useAllVoiceMemos(denId);
  const reportActivity = useActivityStore((s) => s.reportActivity);
  const reportDrops = useActivityStore((s) => s.reportDrops);

  // Report latest content timestamp whenever notes or memos change.
  useEffect(() => {
    const latestNote = notes.reduce((max, n) => Math.max(max, n.updatedAt), 0);
    const latestMemo = memos.reduce((max, m) => Math.max(max, m.createdAt), 0);
    const latest = Math.max(latestNote, latestMemo);
    if (latest > 0) reportActivity(denId, latest);
  }, [denId, notes, memos, reportActivity]);

  // Report pending drop count for den owners.
  useEffect(() => {
    if (isOwner) reportDrops(denId, pendingDropCount);
  }, [denId, isOwner, pendingDropCount, reportDrops]);
}
