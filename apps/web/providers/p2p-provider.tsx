"use client";

import { type ReactNode } from "react";
import { initP2P, getP2PManager } from "@meerkat/p2p";
import { createClient } from "@/lib/supabase/client";
import { useFeature } from "@/lib/feature-flags-context";

interface P2PProviderProps {
  children: ReactNode;
}

/**
 * P2P Provider
 *
 * Initialises the @meerkat/p2p manager with the Supabase Realtime signaling
 * channel factory.
 *
 * IMPORTANT: Initialisation happens synchronously during render, NOT in a
 * useEffect. React fires effects bottom-up (child before parent), which means
 * a useEffect here would fire *after* DenProvider's effects — by which time
 * the DenProvider's sync machine has already called resolveP2PAdapter() and
 * fallen back to the offline no-op adapter (because initP2P hadn't run yet).
 *
 * Calling initP2P() during render (top-down, parent before child) ensures the
 * manager exists before any descendant component effects run.
 *
 * Safety:
 *  - createClient() returns a cached Supabase singleton → safe during render
 *  - initP2P() stores options in a module-level variable → safe during render
 *  - getP2PManager() guard prevents redundant re-initialisation on re-renders
 */
export function P2PProvider({ children }: P2PProviderProps) {
  const p2pEnabled = useFeature("p2pSync");

  // Synchronous initialisation during render so the manager is available
  // before any child component effects run.
  if (p2pEnabled && typeof window !== "undefined") {
    try {
      // Throws "not initialized" if the manager doesn't exist yet.
      // If it succeeds, the manager is already running — skip.
      getP2PManager();
    } catch {
      // Not initialised yet — set it up now.
      const supabase = createClient();
      initP2P({
        createSignalingChannel: (channelName: string) => {
          const channel = supabase.channel(channelName);

          // Wrap the Supabase RealtimeChannel to match SupabaseRealtimeChannelLike
          const wrapper = {
            on(
              event: "broadcast",
              config: { event: string },
              callback: (payload: { payload: unknown }) => void,
            ) {
              channel.on(event, config, callback);
              return wrapper;
            },
            subscribe(callback?: (status: string) => void) {
              channel.subscribe(callback);
              return wrapper;
            },
            async send(args: {
              type: "broadcast";
              event: string;
              payload: unknown;
            }) {
              await channel.send(args);
            },
            async unsubscribe() {
              await supabase.removeChannel(channel);
            },
          };
          return wrapper;
        },
      });
    }
  }

  return <>{children}</>;
}
