"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePresenceStore } from "@/stores/use-presence-store";
import type { RealtimeChannel } from "@supabase/supabase-js";

class PresenceManager {
  private channels = new Map<string, RealtimeChannel>();
  private refCount = new Map<string, number>();
  private trackCount = new Map<string, number>();
  private supabase = createClient();
  private cleanupTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  private updateStore(
    topic: string,
    denId: string,
    currentUserId: string,
    channel: RealtimeChannel,
  ) {
    const state = channel.presenceState<{ userId: string }>();
    const userIds = new Set<string>();

    Object.keys(state).forEach((key) => {
      state[key]?.forEach((p) => {
        if (p.userId) userIds.add(p.userId);
      });
      userIds.add(key);
    });

    if ((this.trackCount.get(topic) || 0) > 0) {
      userIds.add(currentUserId);
    }

    usePresenceStore.getState().setOnlineUsers(denId, Array.from(userIds));
  }

  subscribe(denId: string, userId: string, track: boolean) {
    const topic = `presence:den:${denId}`;

    if (track) {
      this.trackCount.set(topic, (this.trackCount.get(topic) || 0) + 1);
    }
    this.refCount.set(topic, (this.refCount.get(topic) || 0) + 1);

    if (this.cleanupTimeouts.has(topic)) {
      clearTimeout(this.cleanupTimeouts.get(topic));
      this.cleanupTimeouts.delete(topic);
    }

    let channel = this.channels.get(topic);
    if (!channel) {
      channel = this.supabase.channel(topic, {
        config: { presence: { key: userId } },
      });
      this.channels.set(topic, channel);

      channel
        .on("presence", { event: "sync" }, () =>
          this.updateStore(topic, denId, userId, channel!),
        )
        .on("presence", { event: "join" }, () =>
          this.updateStore(topic, denId, userId, channel!),
        )
        .on("presence", { event: "leave" }, () =>
          this.updateStore(topic, denId, userId, channel!),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            this.updateStore(topic, denId, userId, channel!);
            if ((this.trackCount.get(topic) || 0) > 0) {
              channel!.track({ userId }).catch(() => {});
            }
          }
        });
    } else {
      this.updateStore(topic, denId, userId, channel);

      // Using internal state to check if subscribed. 'joined' is standard in Phoenix.
      // @ts-ignore
      const isJoined = channel.state === "joined";
      if (track && isJoined) {
        channel.track({ userId }).catch(() => {});
      }
    }
  }

  unsubscribe(denId: string, userId: string, track: boolean) {
    const topic = `presence:den:${denId}`;

    if (track) {
      const tc = (this.trackCount.get(topic) || 1) - 1;
      this.trackCount.set(topic, tc);

      const channel = this.channels.get(topic);
      // @ts-ignore
      const isJoined = channel && channel.state === "joined";
      if (tc <= 0 && isJoined) {
        channel.untrack().catch(() => {});
      }
    }

    const rc = (this.refCount.get(topic) || 1) - 1;
    this.refCount.set(topic, rc);

    if (rc <= 0) {
      const timeout = setTimeout(() => {
        if ((this.refCount.get(topic) || 0) <= 0) {
          const channel = this.channels.get(topic);
          if (channel) {
            this.supabase.removeChannel(channel).catch(() => {});
            this.channels.delete(topic);
          }
        }
      }, 3000); // 3 second grace period
      this.cleanupTimeouts.set(topic, timeout);
    }

    const currentChannel = this.channels.get(topic);
    if (currentChannel) {
      this.updateStore(topic, denId, userId, currentChannel);
    }
  }
}

// Single global instance
const presenceManager = new PresenceManager();

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

    presenceManager.subscribe(denId, currentUserId, trackPresence);

    return () => {
      presenceManager.unsubscribe(denId, currentUserId, trackPresence);
    };
  }, [denId, currentUserId, trackPresence]);
}
