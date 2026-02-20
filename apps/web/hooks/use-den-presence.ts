"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePresenceStore } from "@/stores/use-presence-store";

/**
 * Subscribes to a Supabase Realtime presence channel for a single den.
 * Tracks which user IDs are currently online and syncs to usePresenceStore.
 */
export function useDenPresence(denId: string, currentUserId: string) {
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

        channel
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState<{ userId: string }>();
                const userIds = Object.keys(state);
                setOnlineUsers(denId, userIds);
            })
            .on("presence", { event: "join" }, ({ key }) => {
                const state = channel.presenceState<{ userId: string }>();
                const userIds = Object.keys(state);
                setOnlineUsers(denId, userIds);
                void key; // suppress unused warning
            })
            .on("presence", { event: "leave" }, () => {
                const state = channel.presenceState<{ userId: string }>();
                const userIds = Object.keys(state);
                setOnlineUsers(denId, userIds);
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({ userId: currentUserId });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [denId, currentUserId, setOnlineUsers]);
}
