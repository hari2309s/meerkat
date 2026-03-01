"use client";

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { TopNav } from "@/components/top-nav";
import { startNavigationProgress } from "@/components/navigation-progress";
import { createClient } from "@/lib/supabase/client";
import { useFeature } from "@/lib/feature-flags-context";
import { useDenContextSafe } from "@meerkat/crdt";
import { useJoinDen } from "@meerkat/p2p";
import { useStoredKeys } from "@meerkat/keys";
import type { P2PManagerOptions } from "@meerkat/p2p";

// Stores
import {
  useDenStore,
  loadMuteState,
  saveMuteState,
} from "@/stores/use-den-store";

// Legacy hooks (used when localFirstStorage is disabled)
import { useDenPresence } from "@/hooks/use-den-presence";
import { useVoiceMemoUpload } from "@/hooks/use-voice-memo-upload";

// Den components
import { DenHeader } from "@/components/den/den-header";
import { DenHeaderEnhanced } from "@/components/den/den-header-enhanced";
import { VisitorPanel } from "@/components/den/visitor-panel";
import { DenMenu } from "@/components/den/den-menu";
import { ChatArea } from "@/components/den/chat-area";
import { Fab } from "@/components/den/fab";
import { RenameModal } from "@/components/den/rename-modal";
import { InviteModal } from "@/components/den/invite-modal";
import { MembersModal } from "@/components/den/members-modal";
import { MuteModal } from "@/components/den/mute-modal";
import { ConfirmModal } from "@/components/den/confirm-modal";
import { VoiceNoteRecorder } from "@/components/den/voice-note-recorder";

import type { Den, DenMember } from "@/types/den";
import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@meerkat/config";

interface DenPageClientEnhancedProps {
  den: Den;
  currentUserId: string;
  user: { name: string; preferredName: string | null; email: string };
  members: DenMember[];
}

/**
 * Enhanced Den Page Client
 *
 * Hybrid component that supports both:
 * 1. Local-first architecture (IndexedDB + CRDT + P2P sync)
 * 2. Legacy architecture (tRPC + Supabase Realtime)
 *
 * The active mode is determined by feature flags.
 */
export function DenPageClientEnhanced({
  den: initialDen,
  currentUserId,
  user,
  members: initialMembers,
}: DenPageClientEnhancedProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Feature flags
  const useLocalFirst = useFeature("localFirstStorage");
  const showNewUI = useFeature("newUI");

  // Local-first context (may be null if feature flag is disabled)
  const denContext = useDenContextSafe();

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Zustand store ─────────────────────────────────────────────────────────
  const {
    den,
    members,
    muted,
    modal,
    navigatingBack,
    setDen,
    setMembers,
    addMember,
    removeMember,
    setMuted,
    toggleMuted,
    openModal,
    closeModal,
    setNavigatingBack,
    reset,
  } = useDenStore();

  // Initialise store from server-fetched props (runs once on mount)
  useEffect(() => {
    setDen(initialDen);
    setMembers(initialMembers);
    setMuted(loadMuteState(initialDen.id));
    return () => reset();
  }, [initialDen, initialMembers, setDen, setMembers, setMuted, reset]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeDen = den ?? initialDen;
  const activeMembers = members.length ? members : initialMembers;
  const isOwner = activeDen.user_id === currentUserId;

  // ── Legacy hooks (only used when localFirstStorage is disabled) ───────────
  const legacyPresenceEnabled = !useLocalFirst;

  // Conditionally use hooks based on feature flag
  // eslint-disable-next-line react-hooks/rules-of-hooks
  if (legacyPresenceEnabled) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDenPresence(activeDen.id, currentUserId);
  }

  // Voice memo upload with analysis
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { uploadVoiceMemo } = useVoiceMemoUpload(activeDen.id, currentUserId);

  // ── Local-first data (only available when feature flag is enabled) ────────
  const syncStatus = denContext?.syncStatus ?? "offline";
  const visitors = denContext?.visitors ?? [];

  // ── Visitor P2P join (non-owners with a stored DenKey) ────────────────────
  const p2pEnabled = useFeature("p2pSync");

  const p2pOptions = useMemo<P2PManagerOptions>(() => {
    // IMPORTANT: Do NOT use createClient() here — it returns a cached singleton
    // that shares a WebSocket with P2PProvider. Supabase won't deliver broadcasts
    // back to the same socket, so ICE candidates from the host would be silently
    // dropped. We need a fresh client with its own dedicated WebSocket.
    const supabase = createBrowserClient(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    return {
      createSignalingChannel: (channelName: string) => {
        const ch = supabase.channel(channelName);
        return {
          on(
            event: "broadcast",
            config: { event: string },
            callback: (payload: { payload: unknown }) => void,
          ) {
            ch.on(event, config, callback);
            return this;
          },
          subscribe(callback?: (status: string) => void) {
            ch.subscribe(callback);
            return this;
          },
          async send(args: {
            type: "broadcast";
            event: string;
            payload: unknown;
          }) {
            await ch.send(args);
          },
          async unsubscribe() {
            await supabase.removeChannel(ch);
          },
        };
      },
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    join: joinDen,
    status: visitorStatus,
    disconnect: leaveP2P,
    error: p2pError,
  } = useJoinDen(p2pOptions);

  const { validKeys } = useStoredKeys();
  const activeDenKey =
    validKeys.find((s) => s.key.denId === activeDen.id)?.key ?? null;

  // Surface P2P connection errors to the visitor (once per error)
  const p2pErrorShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (p2pError && !isOwner && p2pError !== p2pErrorShownRef.current) {
      p2pErrorShownRef.current = p2pError;
      toast.error("Could not connect to den", {
        description: p2pError,
        duration: 5000,
      });
    } else if (!p2pError) {
      p2pErrorShownRef.current = null;
    }
  }, [p2pError, isOwner]);

  // Auto-connect as visitor — fires once on mount (or when the key changes),
  // NOT on every visitorStatus change. Retries after failure are handled
  // inside useJoinDen with a 2s delay to let Supabase clean up the old channel.
  const hasAttemptedJoinRef = useRef(false);
  useEffect(() => {
    // Reset on key change so a new key triggers a fresh attempt
    hasAttemptedJoinRef.current = false;
  }, [activeDenKey]);

  useEffect(() => {
    if (isOwner || !useLocalFirst || !p2pEnabled || !activeDenKey) return;
    if (hasAttemptedJoinRef.current) return; // already attempted this session
    hasAttemptedJoinRef.current = true;
    joinDen(activeDenKey).catch((err) => {
      console.warn("[@meerkat/web] Visitor P2P join failed:", err);
    });
  }, [isOwner, useLocalFirst, p2pEnabled, activeDenKey, joinDen]);

  // Disconnect visitor session on unmount
  useEffect(() => {
    return () => {
      if (!isOwner) leaveP2P();
    };
  }, [isOwner, leaveP2P]);

  // ── Realtime: den updates / member changes (legacy only) ──────────────────
  const handleDenUpdate = useCallback(
    (payload: { new: Den }) => {
      setDen(payload.new);
      if (payload.new.user_id !== currentUserId) {
        toast.info(`Den renamed to "${payload.new.name}"`, { duration: 2500 });
      }
    },
    [setDen, currentUserId],
  );

  const handleDenDelete = useCallback(() => {
    toast.error("This den was deleted by the owner", { duration: 4000 });
    startNavigationProgress();
    router.push("/");
  }, [router]);

  const handleMemberInsert = useCallback(
    async (payload: { new: DenMember & { den_id: string } }) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("den_members")
        .select(
          `
        user_id,
        role,
        joined_at,
        profiles:user_id (
          full_name,
          email
        )
      `,
        )
        .eq("den_id", payload.new.den_id)
        .eq("user_id", payload.new.user_id)
        .single();

      if (data) {
        addMember(data as unknown as DenMember);
      } else {
        addMember(payload.new);
      }
    },
    [addMember],
  );

  const handleMemberDelete = useCallback(
    (payload: { old: { user_id: string } }) => {
      if (payload.old.user_id === currentUserId) {
        toast.error("You've been removed from this den", { duration: 4000 });
        startNavigationProgress();
        router.push("/");
        return;
      }
      removeMember(payload.old.user_id);
    },
    [currentUserId, removeMember, router],
  );

  // Only subscribe to realtime in legacy mode
  useEffect(() => {
    if (useLocalFirst) return; // Skip in local-first mode

    const supabase = createClient();
    const channel = supabase
      .channel(`den-realtime-${activeDen.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dens",
          filter: `id=eq.${activeDen.id}`,
        },
        (p) => handleDenUpdate(p as unknown as { new: Den }),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "dens",
          filter: `id=eq.${activeDen.id}`,
        },
        handleDenDelete,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "den_members",
          filter: `den_id=eq.${activeDen.id}`,
        },
        (p) =>
          handleMemberInsert(
            p as unknown as { new: DenMember & { den_id: string } },
          ),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "den_members",
          filter: `den_id=eq.${activeDen.id}`,
        },
        (p) => handleMemberDelete(p as unknown as { old: { user_id: string } }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    useLocalFirst,
    activeDen.id,
    handleDenUpdate,
    handleDenDelete,
    handleMemberInsert,
    handleMemberDelete,
  ]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleBack = () => {
    setNavigatingBack(true);
    startNavigationProgress();
    router.push("/");
  };

  const handleLeave = async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("den_members")
      .delete()
      .eq("den_id", activeDen.id)
      .eq("user_id", currentUserId);
    if (error) {
      toast.error("Failed to leave", { description: error.message });
      throw error;
    }
    toast.success(`You left ${activeDen.name}`);
    queryClient.removeQueries({ queryKey: ["dens", currentUserId] });
    startNavigationProgress();
    router.push("/");
  };

  const handleDelete = async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("dens")
      .delete()
      .eq("id", activeDen.id)
      .eq("user_id", currentUserId);
    if (error) {
      toast.error("Failed to delete", { description: error.message });
      throw error;
    }
    toast.success(`"${activeDen.name}" deleted`);
    queryClient.removeQueries({ queryKey: ["dens", currentUserId] });
    startNavigationProgress();
    router.push("/");
  };

  const handleFabAction = (key: string) => {
    useDenStore.getState().setFabOpen(false);
    if (key === "voice") {
      openModal("voice_recorder");
      return;
    }
    const messages: Record<string, string> = {
      text: "Text composer coming soon",
      photo: "Photo picker coming soon",
      camera: "Camera coming soon",
      document: "Document picker coming soon",
    };
    toast(messages[key] ?? "Coming soon", { duration: 2200 });
  };

  const handleToggleMute = () => {
    toggleMuted();
    saveMuteState(activeDen.id, !muted);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen page-bg">
        <div
          className="fixed inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
            backgroundSize: "150px",
          }}
        />

        <TopNav user={user} />

        <main className="max-w-4xl mx-auto px-4 pt-8 pb-32">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={handleBack}
              disabled={navigatingBack}
              className="link-subtle inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 -ml-3 rounded-xl disabled:opacity-60"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {navigatingBack ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeft className="h-4 w-4" />
              )}
              Back to dens
            </button>

            <DenMenu
              isOwner={isOwner}
              muted={muted}
              memberCount={activeMembers.length}
            />
          </div>

          {/* Header: Use enhanced version if newUI flag is enabled */}
          {mounted && showNewUI ? (
            <DenHeaderEnhanced
              den={activeDen}
              memberCount={activeMembers.length}
              isOwner={isOwner}
              muted={muted}
              onMembersClick={() => openModal("members")}
              syncStatus={isOwner ? syncStatus : visitorStatus}
              visitorCount={isOwner ? visitors.length : 0}
            />
          ) : (
            <DenHeader
              den={activeDen}
              memberCount={activeMembers.length}
              isOwner={isOwner}
              muted={muted}
              onMembersClick={() => openModal("members")}
            />
          )}

          {/* Visitor panel (only shown in new UI mode with local-first) */}
          {mounted && useLocalFirst && (
            <VisitorPanel
              denId={activeDen.id}
              syncStatus={syncStatus}
              visitors={visitors}
              canDisconnect={isOwner}
            />
          )}

          {/* Chat area */}
          <ChatArea den={activeDen} currentUserId={currentUserId} />
        </main>

        {/* FAB */}
        <Fab onAction={handleFabAction} />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === "rename" && (
          <RenameModal
            den={activeDen}
            onClose={closeModal}
            onRenamed={(name) => setDen({ ...activeDen, name })}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "invite" && (
          <InviteModal den={activeDen} onClose={closeModal} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "members" && (
          <MembersModal
            den={activeDen}
            members={activeMembers}
            currentUserId={currentUserId}
            isOwner={isOwner}
            onClose={closeModal}
            onMemberRemoved={removeMember}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "mute" && (
          <MuteModal
            muted={muted}
            onClose={closeModal}
            onToggle={handleToggleMute}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "leave" && (
          <ConfirmModal
            title={`Leave ${activeDen.name}?`}
            description="You'll lose access to this den. You'd need a new invite to rejoin."
            confirmLabel="Leave den"
            onClose={closeModal}
            onConfirm={handleLeave}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "delete" && (
          <ConfirmModal
            title={`Delete "${activeDen.name}"?`}
            description="This will permanently delete the den for all members. Everyone will be notified and removed. This cannot be undone."
            confirmLabel="Delete forever"
            onClose={closeModal}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "voice_recorder" && (
          <VoiceNoteRecorder
            onClose={closeModal}
            onSend={async (blob, duration) => {
              try {
                // Upload voice memo with on-device analysis
                const { voiceUrl, analysis } = await uploadVoiceMemo(
                  blob,
                  duration,
                );

                if (useLocalFirst && denContext?.actions.createVoiceMemo) {
                  // Local-first mode: Save to IndexedDB + CRDT
                  await denContext.actions.createVoiceMemo(
                    voiceUrl,
                    duration,
                    analysis
                      ? {
                          transcript: analysis.transcript,
                          mood: analysis.mood,
                          tone: analysis.tone,
                          valence: analysis.valence,
                          arousal: analysis.arousal,
                          confidence: analysis.confidence,
                          analysedAt: analysis.analysedAt,
                        }
                      : undefined,
                    {
                      full_name: user.name,
                      preferred_name: user.preferredName,
                      email: user.email,
                    },
                  );
                  toast.success(
                    analysis
                      ? "Voice memo saved with analysis"
                      : "Voice memo saved (analysis unavailable)",
                  );
                } else {
                  // Legacy mode: Save to Supabase
                  const supabase = createClient();
                  const { error } = await supabase.from("messages").insert({
                    den_id: activeDen.id,
                    user_id: currentUserId,
                    type: "voice",
                    content: null,
                    voice_url: voiceUrl,
                    voice_duration: Math.round(duration),
                    analysis: analysis
                      ? {
                          transcript: analysis.transcript,
                          mood: analysis.mood,
                          tone: analysis.tone,
                          valence: analysis.valence,
                          arousal: analysis.arousal,
                          confidence: analysis.confidence,
                          analysedAt: analysis.analysedAt,
                        }
                      : null,
                  });

                  if (error) {
                    throw new Error(
                      `Failed to save voice message: ${error.message}`,
                    );
                  }
                  toast.success(
                    analysis
                      ? "Voice message sent with analysis"
                      : "Voice message sent (analysis unavailable)",
                  );
                }
              } catch (error) {
                console.error("[@meerkat/web] Voice memo error:", error);
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to save voice memo",
                );
                throw error;
              }
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
