"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePresenceStore } from "@/stores/use-presence-store";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Global maps to coordinate presence across all mounted components for a given den
const sharedChannels = new Map<
  string,
  { channel: RealtimeChannel; count: number; isJoined: boolean }
>();
const trackingCount = new Map<string, number>();

/**
 * Subscribes to a Supabase Realtime presence channel for a single den.
 * Tracks which user IDs are currently online and syncs to usePresenceStore.
 * Safe to call from multiple components simultaneously (e.g. Home page grid and Den page).
 */
export function useDenPresence(
  denId: string,
  currentUserId: string,
  trackPresence: boolean = true,
) {
  useEffect(() => {
    if (!denId || !currentUserId) return;

    const topic = `presence:den:${denId}`;
    const supabase = createClient();

    if (trackPresence) {
      trackingCount.set(topic, (trackingCount.get(topic) || 0) + 1);
    }

    const updatePresenceState = (currentChannel: RealtimeChannel) => {
      const state = currentChannel.presenceState<{ userId: string }>();
      const userIds = new Set<string>();

      // Extract all users from the presence state
      Object.keys(state).forEach((presenceKey) => {
        state[presenceKey]?.forEach((presence) => {
          if (presence.userId) userIds.add(presence.userId);
        });
        // Sometimes the key itself is the userId depending on config
        userIds.add(presenceKey);
      });

      // If ANY active component wants to track presence, ensure the local user is included
      if ((trackingCount.get(topic) || 0) > 0) {
        userIds.add(currentUserId);
      }

      usePresenceStore.getState().setOnlineUsers(denId, Array.from(userIds));
    };

    let entry = sharedChannels.get(topic);

    if (!entry) {
      const channel = supabase.channel(topic, {
        config: { presence: { key: currentUserId } },
      });

      entry = { channel, count: 0, isJoined: false };
      sharedChannels.set(topic, entry);

      channel
        .on("presence", { event: "sync" }, () => updatePresenceState(channel))
        .on("presence", { event: "join" }, () => updatePresenceState(channel))
        .on("presence", { event: "leave" }, () => updatePresenceState(channel))
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            const current = sharedChannels.get(topic);
            if (current) current.isJoined = true;

            updatePresenceState(channel);

            if ((trackingCount.get(topic) || 0) > 0) {
              await channel.track({ userId: currentUserId }).catch(() => {});
            }
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            const current = sharedChannels.get(topic);
            if (current) current.isJoined = false;
          }
        });
    } else {
      // Channel already exists: instantly update UI with known state
      updatePresenceState(entry.channel);

      // If the channel is already connected and we are tracking, ensure we broadcast
      if (trackPresence && entry.isJoined) {
        entry.channel.track({ userId: currentUserId }).catch(() => {});
      }
    }

    entry.count++;

    return () => {
      if (trackPresence) {
        trackingCount.set(topic, (trackingCount.get(topic) || 1) - 1);
      }

      const currentEntry = sharedChannels.get(topic);
      if (currentEntry) {
        currentEntry.count--;

        if (currentEntry.count <= 0) {
          // No more components are using this channel, remove completely
          supabase.removeChannel(currentEntry.channel);
          sharedChannels.delete(topic);
        } else if (
          (trackingCount.get(topic) || 0) === 0 &&
          currentEntry.isJoined
        ) {
          // Others are still listening (e.g. Home page), but no one tracking. Untrack locally.
          currentEntry.channel.untrack().catch(() => {});
          updatePresenceState(currentEntry.channel);
        } else {
          // Partial unmount, refresh state
          updatePresenceState(currentEntry.channel);
        }
      }
    };
  }, [denId, currentUserId, trackPresence]);
}
