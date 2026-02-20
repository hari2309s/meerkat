"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { TopNav } from "@/components/top-nav";
import { startNavigationProgress } from "@/components/navigation-progress";
import { createClient } from "@/lib/supabase/client";

// Stores
import {
  useDenStore,
  loadMuteState,
  saveMuteState,
} from "@/stores/use-den-store";

// Hooks
import { useDenPresence } from "@/hooks/use-den-presence";
import { useDenMessages } from "@/hooks/use-den-messages";

// Den components
import { DenHeader } from "@/components/den/den-header";
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

interface DenPageClientProps {
  den: Den;
  currentUserId: string;
  user: { name: string; email: string };
  members: DenMember[];
}

export function DenPageClient({
  den: initialDen,
  currentUserId,
  user,
  members: initialMembers,
}: DenPageClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  // ── Presence (online tracking) ────────────────────────────────────────────
  useDenPresence(activeDen.id, currentUserId);

  // ── Messages (TanStack Query + Realtime) ──────────────────────────────────
  const { sendVoice } = useDenMessages(activeDen.id);

  // ── Realtime: den updates / member changes ────────────────────────────────
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
    (payload: { new: DenMember }) => addMember(payload.new),
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

  useEffect(() => {
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
        (p) => handleMemberInsert(p as unknown as { new: DenMember }),
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
    // Remove cached den list so the home page refetches immediately
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
    // Remove cached den list so the home page refetches immediately
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
          {/* Top bar */}
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

          {/* Header */}
          <DenHeader
            den={activeDen}
            memberCount={activeMembers.length}
            isOwner={isOwner}
            muted={muted}
            onMembersClick={() => openModal("members")}
          />

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
              await sendVoice.mutateAsync({
                userId: currentUserId,
                blob,
                durationSeconds: duration,
              });
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
