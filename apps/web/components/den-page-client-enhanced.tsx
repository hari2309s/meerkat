"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { TopNav } from "@/components/top-nav";
import { startNavigationProgress } from "@/components/navigation-progress";
import { createClient } from "@/lib/supabase/client";
import { useDenContextSafe } from "@meerkat/crdt";
import { useJoinDen } from "@meerkat/p2p";
import { useStoredKeys } from "@meerkat/keys";
import { openDen } from "@meerkat/local-store";
import type { P2PManagerOptions } from "@meerkat/p2p";

import {
  useDenStore,
  loadMuteState,
  saveMuteState,
} from "@/stores/use-den-store";

import { useVoiceMemoUpload } from "@/hooks/use-voice-memo-upload";

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
import { TextComposerModal } from "@/components/den/text-composer-modal";
import { AttachmentPickerModal } from "@/components/den/attachment-picker-modal";

import type { Den, DenMember } from "@/types/den";
import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@meerkat/config";

interface DenPageClientEnhancedProps {
  den: Den;
  currentUserId: string;
  user: { name: string; preferredName: string | null; email: string };
  members: DenMember[];
}

export function DenPageClientEnhanced({
  den: initialDen,
  currentUserId,
  user,
  members: initialMembers,
}: DenPageClientEnhancedProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Local-first CRDT context — always available (DenProvider always wraps this)
  const denContext = useDenContextSafe();

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

  useEffect(() => {
    setDen(initialDen);
    setMembers(initialMembers);
    setMuted(loadMuteState(initialDen.id));
    return () => reset();
  }, [initialDen, initialMembers, setDen, setMembers, setMuted, reset]);

  const activeDen = den ?? initialDen;
  const activeMembers = members.length ? members : initialMembers;
  const isOwner = activeDen.user_id === currentUserId;

  // ── CRDT state ────────────────────────────────────────────────────────────
  const syncStatus = denContext?.syncStatus ?? "offline";
  const visitors = denContext?.visitors ?? [];

  // ── Visitor P2P auto-join ─────────────────────────────────────────────────
  const p2pOptions = useMemo<P2PManagerOptions>(() => {
    // Fresh Supabase client — must NOT share a socket with P2PProvider
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

  // Auto-join as visitor once key is available
  const hasAutoJoinedRef = useRef(false);
  useEffect(() => {
    if (
      !isOwner &&
      activeDenKey &&
      visitorStatus === "offline" &&
      !hasAutoJoinedRef.current
    ) {
      hasAutoJoinedRef.current = true;
      joinDen(activeDenKey);
    }
  }, [isOwner, activeDenKey, visitorStatus, joinDen]);

  useEffect(() => {
    if (!isOwner) {
      return () => {
        leaveP2P();
      };
    }
    return undefined;
  }, [isOwner, leaveP2P]);

  // ── Realtime subscriptions for den metadata (rename, delete, members) ─────
  const handleDenUpdate = useCallback(
    (payload: { new: Den }) => {
      setDen(payload.new);
    },
    [setDen],
  );

  const handleDenDelete = useCallback(() => {
    toast.error(`"${activeDen.name}" was deleted`);
    queryClient.removeQueries({ queryKey: ["dens", currentUserId] });
    startNavigationProgress();
    router.push("/");
  }, [activeDen.name, currentUserId, queryClient, router]);

  const handleMemberInsert = useCallback(
    (payload: { new: DenMember }) => {
      addMember(payload.new);
    },
    [addMember],
  );

  const handleMemberDelete = useCallback(
    (payload: { old: { user_id: string } }) => {
      if (payload.old.user_id === currentUserId) {
        toast.error(`You were removed from "${activeDen.name}"`);
        queryClient.removeQueries({ queryKey: ["dens", currentUserId] });
        startNavigationProgress();
        router.push("/");
      } else {
        removeMember(payload.old.user_id);
      }
    },
    [activeDen.name, currentUserId, queryClient, removeMember, router],
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`den-meta:${activeDen.id}`)
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "dens",
          filter: `id=eq.${activeDen.id}`,
        },
        handleDenUpdate,
      )
      .on(
        "postgres_changes" as any,
        {
          event: "DELETE",
          schema: "public",
          table: "dens",
          filter: `id=eq.${activeDen.id}`,
        },
        handleDenDelete,
      )
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "den_members",
          filter: `den_id=eq.${activeDen.id}`,
        },
        handleMemberInsert,
      )
      .on(
        "postgres_changes" as any,
        {
          event: "DELETE",
          schema: "public",
          table: "den_members",
          filter: `den_id=eq.${activeDen.id}`,
        },
        handleMemberDelete,
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
      // Visitors need write access on voiceThread and an active P2P connection.
      if (!isOwner) {
        if (!activeDenKey?.scope.write) {
          toast.error("Cannot send voice message", {
            description: "Your access key does not allow sending messages",
            duration: 3000,
          });
          return;
        }
        if (visitorStatus !== "synced") {
          toast.error("Cannot send voice message", {
            description:
              "You must be connected to the den to send voice messages",
            duration: 3000,
          });
          return;
        }
      }
      openModal("voice_recorder");
      return;
    }
    if (key === "text") {
      openModal("text_message");
      return;
    }
    if (key === "photo") {
      openModal("image_picker");
      return;
    }
    if (key === "document") {
      openModal("document_picker");
      return;
    }
    if (key === "camera") {
      toast("Camera capture coming soon", { duration: 2200 });
    }
  };

  const handleToggleMute = () => {
    toggleMuted();
    saveMuteState(activeDen.id, !muted);
  };

  // ── Voice send ────────────────────────────────────────────────────────────
  const { uploadVoiceMemo } = useVoiceMemoUpload(activeDen.id, currentUserId);

  const handleVoiceSend = async (blob: Blob, duration: number) => {
    const { voiceUrl, analysis } = await uploadVoiceMemo(blob, duration);

    const senderInfo = {
      full_name: user.name,
      preferred_name: user.preferredName,
      email: user.email,
    };

    const analysisPayload = analysis
      ? {
          transcript: analysis.transcript,
          mood: analysis.mood,
          tone: analysis.tone,
          valence: analysis.valence,
          arousal: analysis.arousal,
          confidence: analysis.confidence,
          analysedAt: analysis.analysedAt,
        }
      : undefined;

    if (isOwner && denContext?.actions.createVoiceMemo) {
      // Owner: write to voiceThread via CRDT actions (syncs to visitors)
      await denContext.actions.createVoiceMemo(
        voiceUrl,
        duration,
        analysisPayload,
        senderInfo,
        currentUserId,
      );
      toast.success(
        analysis ? "Voice memo saved with analysis" : "Voice memo saved",
      );
    } else {
      // Visitor: write to shared.voiceThread so the host receives it
      try {
        const { sharedDen } = await openDen(activeDen.id);
        const voiceMemo = {
          id: crypto.randomUUID(),
          userId: currentUserId,
          blobRef: voiceUrl,
          durationSeconds: duration,
          createdAt: Date.now(),
          sender: senderInfo,
          ...(analysisPayload && { analysis: analysisPayload }),
        };
        sharedDen.ydoc.transact(() => {
          sharedDen.voiceThread.push([voiceMemo]);
        });
        toast.success(
          analysis ? "Voice message sent with analysis" : "Voice message sent",
        );
      } catch (err) {
        toast.error("Failed to send voice message", {
          description: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  };

  // ── Local-first text/image/document chat (shared.chatThread) ─────────────
  const handleSendText = async (content: string) => {
    const { sharedDen } = await openDen(activeDen.id);
    const msg = {
      id: crypto.randomUUID(),
      userId: currentUserId,
      kind: "text" as const,
      text: content,
      createdAt: Date.now(),
      sender: {
        full_name: user.name,
        preferred_name: user.preferredName ?? undefined,
        email: user.email,
      },
    };
    sharedDen.ydoc.transact(() => {
      sharedDen.chatThread.push([msg]);
    });
  };

  const uploadAttachment = async (
    file: File,
  ): Promise<{
    path: string;
    size: number;
    mime: string;
    name: string;
    data: string; // base64 encoded file data for local storage
  }> => {
    // Convert file to base64 for local-first storage in CRDT
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const base64Data = reader.result as string;
          const ext = file.name.split(".").pop() ?? "bin";
          const safeExt = ext.toLowerCase();
          const path = `${activeDen.id}/${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

          resolve({
            path,
            size: file.size,
            mime: file.type || "application/octet-stream",
            name: file.name,
            data: base64Data,
          });
        } catch (error) {
          reject(new Error(`Failed to process file: ${error}`));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleSendImage = async (file: File, caption?: string) => {
    const { path, size, mime, name, data } = await uploadAttachment(file);
    const { sharedDen } = await openDen(activeDen.id);
    const msg = {
      id: crypto.randomUUID(),
      userId: currentUserId,
      kind: "image" as const,
      text: caption ?? null,
      attachmentPath: path,
      attachmentName: name,
      attachmentMime: mime,
      attachmentSize: size,
      attachmentData: data, // store base64 data locally
      createdAt: Date.now(),
      sender: {
        full_name: user.name,
        preferred_name: user.preferredName ?? undefined,
        email: user.email,
      },
    };
    sharedDen.ydoc.transact(() => {
      sharedDen.chatThread.push([msg]);
    });
  };

  const handleSendDocument = async (file: File, caption?: string) => {
    const { path, size, mime, name, data } = await uploadAttachment(file);
    const { sharedDen } = await openDen(activeDen.id);
    const msg = {
      id: crypto.randomUUID(),
      userId: currentUserId,
      kind: "document" as const,
      text: caption ?? null,
      attachmentPath: path,
      attachmentName: name,
      attachmentMime: mime,
      attachmentSize: size,
      attachmentData: data, // store base64 data locally
      createdAt: Date.now(),
      sender: {
        full_name: user.name,
        preferred_name: user.preferredName ?? undefined,
        email: user.email,
      },
    };
    sharedDen.ydoc.transact(() => {
      sharedDen.chatThread.push([msg]);
    });
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

          <DenHeaderEnhanced
            den={activeDen}
            memberCount={activeMembers.length}
            isOwner={isOwner}
            muted={muted}
            onMembersClick={() => openModal("members")}
            syncStatus={isOwner ? syncStatus : visitorStatus}
            visitorCount={isOwner ? visitors.length : 0}
          />

          <VisitorPanel
            denId={activeDen.id}
            syncStatus={isOwner ? syncStatus : visitorStatus}
            visitors={visitors}
            canDisconnect={isOwner}
          />

          <ChatArea den={activeDen} currentUserId={currentUserId} isOwner={isOwner} />
        </main>

        <Fab onAction={handleFabAction} />
      </div>

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
          <VoiceNoteRecorder onClose={closeModal} onSend={handleVoiceSend} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "text_message" && (
          <TextComposerModal onClose={closeModal} onSend={handleSendText} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "image_picker" && (
          <AttachmentPickerModal
            kind="image"
            onClose={closeModal}
            onSend={handleSendImage}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "document_picker" && (
          <AttachmentPickerModal
            kind="document"
            onClose={closeModal}
            onSend={handleSendDocument}
          />
        )}
      </AnimatePresence>
    </>
  );
}
