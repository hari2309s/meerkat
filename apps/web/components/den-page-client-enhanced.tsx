"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { TopNav } from "@/components/top-nav";
import { GrainOverlay } from "@/components/grain-overlay";
import { startNavigationProgress } from "@/components/navigation-progress";
import { createClient } from "@/lib/supabase/client";
import { useDenContextSafe } from "@meerkat/crdt";
import { useJoinDen, OfflineDropManager } from "@meerkat/p2p";
import { useBurrows } from "@meerkat/burrows";
import { useStoredKeys } from "@meerkat/keys";
import { openDen, getSetting } from "@meerkat/local-store";
import {
  encryptBlob,
  decryptBlob,
  deserializeNamespaceKeySet,
  importNamespaceKey,
} from "@meerkat/crypto";
import type { P2PManagerOptions } from "@meerkat/p2p";

import {
  useDenStore,
  loadMuteState,
  saveMuteState,
} from "@/stores/use-den-store";

import { useVoiceMemoUpload } from "@/hooks/use-voice-memo-upload";
import { useDenNotifications } from "@/hooks/use-den-notifications";
import { useDenActivityReporter } from "@/hooks/use-den-activity-reporter";

import { DenHeaderEnhanced } from "@/components/den/den-header-enhanced";
import { DenNavTabs } from "@/components/den/den-nav-tabs";
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
import { getVaultDens } from "@/lib/vault-dens";

// ─── Drop upload helper ───────────────────────────────────────────────────────
// Routes through /api/drops (admin client) so vault users with no Supabase
// session can still upload drops to Storage.
async function uploadDropViaApi(
  path: string,
  data: Uint8Array,
  metadata: { iv: string; visitorId: string; droppedAt: string },
): Promise<void> {
  const metaBytes = new TextEncoder().encode(JSON.stringify(metadata));
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, metaBytes.length, false);
  const combined = new Uint8Array(4 + metaBytes.length + data.length);
  combined.set(header, 0);
  combined.set(metaBytes, 4);
  combined.set(data, 4 + metaBytes.length);

  const form = new FormData();
  form.append("path", path);
  form.append(
    "data",
    new Blob([combined], { type: "application/octet-stream" }),
  );
  const res = await fetch("/api/drops", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      error: "Upload failed",
    }))) as { error: string };
    throw new Error(body.error);
  }
}

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

  // Vault users: the server can't read localStorage, so the initial den has
  // name="For You". Patch it immediately from the vault den registry.
  useEffect(() => {
    if (currentUserId !== "vault") return;
    const vaultDen = getVaultDens().find((d) => d.id === initialDen.id);
    if (vaultDen && vaultDen.name !== initialDen.name) {
      setDen({ ...initialDen, name: vaultDen.name });
    }
  }, [currentUserId, initialDen, setDen]);

  const activeDen = den ?? initialDen;
  const activeMembers = members.length ? members : initialMembers;
  const isOwner = activeDen.user_id === currentUserId;
  const { burrows } = useBurrows(activeDen.id);

  // ── CRDT state ────────────────────────────────────────────────────────────
  const syncStatus = denContext?.syncStatus ?? "offline";
  const visitors = denContext?.visitors ?? [];
  const dropboxItems = denContext?.shared.dropbox ?? [];

  // ── P2P event notifications (toasts + title badge) ────────────────────────
  useDenNotifications({
    denName: activeDen.name,
    visitors,
    dropboxItems,
    isOwner,
  });

  // ── Activity reporting (unread dots + nav dropbox badge) ──────────────────
  useDenActivityReporter({
    denId: activeDen.id,
    isOwner,
    pendingDropCount: dropboxItems.length,
  });

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

  // Reconnect after phone lock/unlock or tab backgrounding.
  // When the screen wakes, WebRTC connections are dead. The auto-retry inside
  // useJoinDen exhausts MAX_AUTO_RETRIES while the device is still waking up,
  // leaving the visitor permanently stuck on "offline". A visibilitychange
  // listener re-triggers a fresh join (retryCount=0) when the page is foregrounded.
  const visitorStatusRef = useRef(visitorStatus);
  visitorStatusRef.current = visitorStatus;
  useEffect(() => {
    if (isOwner || !activeDenKey) return;

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        visitorStatusRef.current !== "synced"
      ) {
        joinDen(activeDenKey);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isOwner, activeDenKey, joinDen]);

  // ── Host: auto-collect offline drops on den open ──────────────────────────
  useEffect(() => {
    if (!isOwner) return;

    async function collectDrops() {
      // Use the /api/drops server routes (admin client) so vault hosts with
      // no Supabase session can still list/download/delete drops.
      const mgr = new OfflineDropManager({
        async uploadDrop() {},
        async listDrops(prefix) {
          const res = await fetch(
            `/api/drops?list=${encodeURIComponent(prefix)}`,
          );
          if (!res.ok) return [];
          const json = (await res.json()) as { paths: string[] };
          return json.paths ?? [];
        },
        async downloadDrop(path) {
          const res = await fetch(
            `/api/drops?path=${encodeURIComponent(path)}`,
          );
          if (!res.ok) throw new Error(`Download failed: ${res.status}`);
          const bytes = new Uint8Array(await res.arrayBuffer());
          const metaLen = new DataView(bytes.buffer).getUint32(0, false);
          const meta = JSON.parse(
            new TextDecoder().decode(bytes.slice(4, 4 + metaLen)),
          ) as { iv: string; visitorId: string; droppedAt: string };
          return { data: bytes.slice(4 + metaLen), metadata: meta };
        },
        async deleteDrop(path) {
          await fetch(`/api/drops?path=${encodeURIComponent(path)}`, {
            method: "DELETE",
          });
        },
      });

      const drops = await mgr.collectPendingDrops(activeDen.id);
      if (drops.length === 0) return;

      // Load the host's namespace keys (saved when the invite was created)
      const rawKeys = await getSetting<Record<string, string>>(
        activeDen.id,
        "den-ns-keys",
      );
      if (!rawKeys) {
        console.warn(
          "[@meerkat/p2p] No namespace keys found — cannot decrypt drops",
        );
        return;
      }
      const nsKeys = deserializeNamespaceKeySet(rawKeys);
      if (!nsKeys.dropbox) {
        console.warn("[@meerkat/p2p] No dropbox key in namespace key set");
        return;
      }
      const cryptoKey = await importNamespaceKey(nsKeys.dropbox);

      let imported = 0;
      for (const drop of drops) {
        try {
          const plaintext = await decryptBlob(
            { data: drop.encryptedPayload, iv: drop.iv, alg: "AES-GCM-256" },
            cryptoKey,
          );
          type DropPayload =
            | {
                type: "voice_memo";
                blobRef: string;
                durationSeconds: number;
                createdAt: number;
                sender: {
                  full_name: string;
                  preferred_name?: string;
                  email: string;
                };
                analysis?: {
                  transcript: string;
                  mood: string;
                  tone: string;
                  valence: number;
                  arousal: number;
                  confidence: number;
                  analysedAt: number;
                };
              }
            | {
                type: "text_message";
                text: string;
                createdAt: number;
                sender: {
                  full_name: string;
                  preferred_name?: string;
                  email: string;
                };
              };
          const payload = JSON.parse(
            new TextDecoder().decode(plaintext),
          ) as DropPayload;

          if (payload.type === "voice_memo") {
            const { sharedDen } = await openDen(activeDen.id);
            const voiceMemo = {
              id: crypto.randomUUID(),
              userId: drop.visitorId,
              blobRef: payload.blobRef,
              durationSeconds: payload.durationSeconds,
              createdAt: payload.createdAt,
              sender: payload.sender,
              ...(payload.analysis && { analysis: payload.analysis }),
            };
            sharedDen.ydoc.transact(() => {
              sharedDen.voiceThread.push([voiceMemo]);
            });
            imported++;
          } else if (payload.type === "text_message") {
            const { sharedDen } = await openDen(activeDen.id);
            const chatMsg = {
              id: crypto.randomUUID(),
              userId: drop.visitorId,
              kind: "text" as const,
              text: payload.text,
              createdAt: payload.createdAt,
              sender: payload.sender,
            };
            sharedDen.ydoc.transact(() => {
              sharedDen.chatThread.push([chatMsg]);
            });
            imported++;
          }
        } catch (err) {
          console.warn(
            `[@meerkat/p2p] Failed to decrypt drop ${drop.dropId}:`,
            err,
          );
        }
        // Always confirm (delete) the drop — even on decrypt failure, to avoid
        // accumulating undecryptable blobs in storage.
        await mgr.confirmDrop(drop);
      }

      if (imported > 0) {
        toast.success(
          `${imported} offline ${imported === 1 ? "message" : "messages"} delivered`,
          { description: "Visitor messages added to the den" },
        );
      }
    }

    collectDrops().catch((err) => {
      console.warn("[@meerkat/p2p] Failed to collect offline drops:", err);
    });
  }, [isOwner, activeDen.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!activeDenKey.scope.offline && visitorStatus !== "synced") {
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
    } else if (
      !isOwner &&
      visitorStatus !== "synced" &&
      activeDenKey?.scope.offline
    ) {
      // Offline letterbox: encrypt the voice memo metadata and upload as a drop.
      // The blob is already in Supabase Storage (uploaded by uploadVoiceMemo).
      // The drop contains the URL + metadata so the host can import it later.
      try {
        const rawKeys = deserializeNamespaceKeySet(activeDenKey.namespaceKeys);
        const dropboxRaw = rawKeys.dropbox;
        if (!dropboxRaw) throw new Error("No dropbox key in this DenKey");

        const cryptoKey = await importNamespaceKey(dropboxRaw);
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: "voice_memo",
            blobRef: voiceUrl,
            durationSeconds: duration,
            createdAt: Date.now(),
            sender: senderInfo,
            ...(analysisPayload && { analysis: analysisPayload }),
          }),
        );
        const encrypted = await encryptBlob(payload, cryptoKey);

        const mgr = new OfflineDropManager({
          uploadDrop: uploadDropViaApi,
          async listDrops() {
            return [];
          },
          async downloadDrop() {
            throw new Error("not implemented");
          },
          async deleteDrop() {},
        });

        const ciphertextBytes = Uint8Array.from(atob(encrypted.data), (c) =>
          c.charCodeAt(0),
        );
        await mgr.uploadDrop(
          activeDen.id,
          currentUserId,
          ciphertextBytes,
          encrypted.iv,
        );

        toast.success("Voice message queued for delivery", {
          description: "The host will receive it when they come online",
        });
      } catch (err) {
        toast.error("Failed to queue voice message", {
          description: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
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
    // Offline Letterbox visitor: encrypt the message and upload as a drop
    // instead of writing to the CRDT (which has no path to the host offline).
    if (!isOwner && activeDenKey?.scope.offline && visitorStatus !== "synced") {
      try {
        const rawKeys = deserializeNamespaceKeySet(activeDenKey.namespaceKeys);
        const dropboxRaw = rawKeys.dropbox;
        if (!dropboxRaw) throw new Error("No dropbox key in this DenKey");

        const cryptoKey = await importNamespaceKey(dropboxRaw);
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: "text_message",
            text: content,
            createdAt: Date.now(),
            sender: {
              full_name: user.name,
              preferred_name: user.preferredName ?? undefined,
              email: user.email,
            },
          }),
        );
        const encrypted = await encryptBlob(payload, cryptoKey);

        const mgr = new OfflineDropManager({
          uploadDrop: uploadDropViaApi,
          async listDrops() {
            return [];
          },
          async downloadDrop() {
            throw new Error("not implemented");
          },
          async deleteDrop() {},
        });

        const ciphertextBytes = Uint8Array.from(atob(encrypted.data), (c) =>
          c.charCodeAt(0),
        );
        await mgr.uploadDrop(
          activeDen.id,
          currentUserId,
          ciphertextBytes,
          encrypted.iv,
        );

        toast.success("Message queued for delivery", {
          description: "The host will receive it when they come online",
        });
      } catch (err) {
        toast.error("Failed to queue message", {
          description: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
      return;
    }

    // Online path: write to shared CRDT so host (and synced visitors) see it.
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
        <GrainOverlay />

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
              denId={activeDen.id}
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
            burrowCount={burrows.length}
          />

          <DenNavTabs denId={activeDen.id} activeTab="chat" />

          <VisitorPanel
            denId={activeDen.id}
            syncStatus={isOwner ? syncStatus : visitorStatus}
            visitors={visitors}
            canDisconnect={isOwner}
          />

          <ChatArea
            den={activeDen}
            currentUserId={currentUserId}
            isOwner={isOwner}
          />
        </main>

        <Fab onAction={handleFabAction} />
      </div>

      <AnimatePresence>
        {modal === "rename" && (
          <RenameModal
            den={activeDen}
            onClose={closeModal}
            onRenamed={(name) => setDen({ ...activeDen, name })}
            isVaultUser={currentUserId === "vault"}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "invite" && (
          <InviteModal
            den={activeDen}
            onClose={closeModal}
            isVaultUser={currentUserId === "vault"}
          />
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
