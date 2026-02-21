"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePresenceStore } from "@/stores/use-presence-store";

/**
 * Subscribes to a Supabase Realtime presence channel for a single den.
 * Tracks which user IDs are currently online and syncs to usePresenceStore.
 */
export function useDenPresence(
  denId: string,
  currentUserId: string,
  trackPresence: boolean = true,
) {
  const { setOnlineUsers } = usePresenceStore();
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  useEffect(() => {
    if (!denId || !currentUserId) return;

    const supabase = createClient();
    const channel = supabase.channel(`presence:den:${denId}`, {
      config: { presence: { key: currentUserId } },
    });

    channelRef.current = channel;

    const updatePresence = () => {
      const state = channel.presenceState<{ userId: string }>();
      const userIds = new Set(Object.keys(state));
      if (trackPresence) {
        userIds.add(currentUserId);
      }
      setOnlineUsers(denId, Array.from(userIds));
    };

    channel
      .on("presence", { event: "sync" }, updatePresence)
      .on("presence", { event: "join" }, ({ key }) => {
        updatePresence();
        void key; // suppress unused warning
      })
      .on("presence", { event: "leave" }, updatePresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && trackPresence) {
          await channel.track({ userId: currentUserId });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [denId, currentUserId, trackPresence, setOnlineUsers]);
}
