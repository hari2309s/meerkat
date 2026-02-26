"use client";

import { useEffect, type ReactNode } from "react";
import { initP2P } from "@meerkat/p2p";
import { createClient } from "@/lib/supabase/client";
import { useFeature } from "@/lib/feature-flags-context";

interface P2PProviderProps {
  children: ReactNode;
}

/**
 * P2P Provider
 *
 * Initializes the @meerkat/p2p manager with the Supabase Realtime signaling
 * channel factory. This must be called once at app startup before any P2P
 * activity occurs.
 *
 * The provider only initializes P2P when the p2pSync feature flag is enabled.
 */
export function P2PProvider({ children }: P2PProviderProps) {
  const p2pEnabled = useFeature("p2pSync");

  useEffect(() => {
    console.log("[P2P] Provider effect running, p2pSync flag:", p2pEnabled);

    // Only initialize if P2P sync is enabled
    if (!p2pEnabled) {
      console.log("[P2P] P2P sync disabled, skipping initialization");
      return;
    }

    // Check if we're in the browser
    if (typeof window === "undefined") {
      console.log("[P2P] Running on server, skipping initialization");
      return;
    }

    console.log("[P2P] Attempting to initialize P2P manager...");

    try {
      const supabase = createClient();

      // Initialize the P2P manager with Supabase Realtime as the signaling channel
      initP2P({
        createSignalingChannel: (channelName: string) => {
          console.log("[P2P] Creating signaling channel:", channelName);
          const channel = supabase.channel(channelName);

          // Wrap the Supabase RealtimeChannel to match the SupabaseRealtimeChannelLike interface
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

      console.log("[P2P] ✅ Manager initialized successfully");
    } catch (error) {
      // If initialization fails (e.g., already initialized), that's ok
      console.warn(
        "[P2P] Initialization error (may already be initialized):",
        error,
      );
      console.error("[P2P] Full error details:", error);
    }

    // No cleanup needed — P2P manager is a singleton that lives for app lifetime
  }, [p2pEnabled]);

  return <>{children}</>;
}
