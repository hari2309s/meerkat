"use client";

import { useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { useDenContextSafe } from "@meerkat/crdt";
import { VoiceNoteMessage } from "@/components/den/voice-note-message";
import { formatMessageTime } from "@meerkat/utils/time";
import { getSenderName } from "@meerkat/utils/string";
import type { Den, Message } from "@/types/den";
import type { VoiceMemoData, ChatMessageData } from "@meerkat/local-store";
import { useChatStore } from "@/stores/use-chat-store";

interface ChatAreaProps {
  den: Den;
  currentUserId: string;
  isOwner: boolean;
}

function TextMessage({
  content,
  senderName,
  isOwn,
  createdAt,
}: {
  content: string;
  senderName: string;
  isOwn: boolean;
  createdAt: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 items-end max-w-sm ${isOwn ? "flex-row-reverse self-end" : ""}`}
    >
      {!isOwn && (
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: "var(--color-avatar-bg)" }}
        >
          {senderName[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {!isOwn && (
          <span
            className="text-xs font-semibold px-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {senderName}
          </span>
        )}
        <div
          className="rounded-2xl px-4 py-2.5"
          style={
            isOwn
              ? {
                  background: "var(--color-btn-default-bg)",
                  color: "var(--color-btn-default-text)",
                  borderRadius: "18px 18px 4px 18px",
                }
              : {
                  background: "var(--color-bg-card)",
                  border: "1.5px solid var(--color-border-card)",
                  color: "var(--color-text-primary)",
                  borderRadius: "18px 18px 18px 4px",
                }
          }
        >
          <p className="text-sm leading-relaxed">{content}</p>
        </div>
        <span
          className={`text-xs px-1 ${isOwn ? "text-right" : ""}`}
          style={{ color: "var(--color-text-muted)" }}
        >
          {formatMessageTime(createdAt)}
        </span>
      </div>
    </motion.div>
  );
}

function ImageMessage({
  message,
  senderName,
  isOwn,
}: {
  message: Message;
  senderName: string;
  isOwn: boolean;
}) {
  const createdAt = message.created_at;
  // Use base64 data if available, otherwise fall back to URL
  const url = message.attachment_data || message.attachment_url || "";
  const alt = message.attachment_name ?? "image attachment";
  const caption = message.content ?? "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 items-end max-w-sm ${isOwn ? "flex-row-reverse self-end" : ""}`}
    >
      {!isOwn && (
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: "var(--color-avatar-bg)" }}
        >
          {senderName[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {!isOwn && (
          <span
            className="text-xs font-semibold px-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {senderName}
          </span>
        )}
        <div
          className="rounded-2xl overflow-hidden border"
          style={{
            borderColor: "var(--color-border-card)",
            maxWidth: "260px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className="block max-h-64 w-full object-cover bg-black/5"
          />
        </div>
        {caption && (
          <div className="px-1">
            <p
              className="text-xs"
              style={{ color: "var(--color-text-primary)" }}
            >
              {caption}
            </p>
          </div>
        )}
        <span
          className={`text-xs px-1 ${isOwn ? "text-right" : ""}`}
          style={{ color: "var(--color-text-muted)" }}
        >
          {formatMessageTime(createdAt)}
        </span>
      </div>
    </motion.div>
  );
}

function DocumentMessage({
  message,
  senderName,
  isOwn,
}: {
  message: Message;
  senderName: string;
  isOwn: boolean;
}) {
  const createdAt = message.created_at;
  const url = message.attachment_url ?? "";
  const name = message.attachment_name ?? message.content ?? "Document";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 items-end max-w-sm ${isOwn ? "flex-row-reverse self-end" : ""}`}
    >
      {!isOwn && (
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: "var(--color-avatar-bg)" }}
        >
          {senderName[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {!isOwn && (
          <span
            className="text-xs font-semibold px-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {senderName}
          </span>
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl px-4 py-2.5 flex items-center gap-2"
          style={{
            background: "var(--color-bg-card)",
            border: "1.5px solid var(--color-border-card)",
            color: "var(--color-text-primary)",
          }}
        >
          <span
            className="inline-flex h-6 w-6 rounded-md items-center justify-center text-[10px] font-semibold"
            style={{ background: "rgba(143,82,184,0.12)" }}
          >
            PDF
          </span>
          <span className="text-xs truncate max-w-[180px]">{name}</span>
        </a>
        <span
          className={`text-xs px-1 ${isOwn ? "text-right" : ""}`}
          style={{ color: "var(--color-text-muted)" }}
        >
          {formatMessageTime(createdAt)}
        </span>
      </div>
    </motion.div>
  );
}

export function ChatArea({ den, currentUserId, isOwner }: ChatAreaProps) {
  const denContext = useDenContextSafe();
  const containerRef = useRef<HTMLDivElement>(null);
  const { messages: legacyMessages } = useChatStore();

  // In the voiceMemoMessages useMemo, also include dropbox items for the owner:
  const voiceMemoMessages = useMemo((): Message[] => {
    if (!denContext) return [];

    const threadMsgs = denContext.shared.voiceThread.map(
      (memo: VoiceMemoData): Message => ({
        id: memo.id,
        den_id: den.id,
        // Use stored userId when available. For legacy memos without userId,
        // assume they were written by the owner (only owners wrote to voiceThread
        // before per-sender tracking was added).
        user_id: memo.userId ?? (isOwner ? currentUserId : "__owner__"),
        type: "voice" as const,
        content: null,
        voice_url: memo.blobRef,
        voice_duration: memo.durationSeconds,
        created_at: new Date(memo.createdAt).toISOString(),
        sender: memo.sender,
        analysis: memo.analysis as Message["analysis"],
      }),
    );

    // Visitor voice drops appear in the dropbox namespace
    // Note: DropboxItem structure doesn't include type field, so we process all items
    // The actual type determination would happen after decrypting the encryptedPayload
    const dropboxMsgs = denContext.shared.dropbox.map(
      (item): Message => ({
        id: item.id,
        den_id: den.id,
        user_id: "visitor", // Dropbox items are from visitors
        type: "voice" as const, // Assuming all dropbox items are voice for now
        content: null,
        voice_url: "", // Would be extracted from encryptedPayload after decryption
        voice_duration: 0, // Would be extracted from encryptedPayload after decryption
        created_at: new Date(item.droppedAt).toISOString(),
        sender: {
          email: item.visitorId,
          full_name: null,
          preferred_name: null,
        },
        analysis: undefined,
      }),
    );

    return [...threadMsgs, ...dropboxMsgs];
  }, [
    denContext?.shared.voiceThread,
    denContext?.shared.dropbox,
    den.id,
    currentUserId,
    isOwner,
  ]);

  const chatThreadMessages = useMemo((): Message[] => {
    if (!denContext) return [];

    const chat = denContext.shared.chatThread as ChatMessageData[];
    return chat.map(
      (msg): Message => ({
        id: msg.id,
        den_id: den.id,
        user_id: msg.userId,
        type: msg.kind,
        content: msg.text,
        voice_url: null,
        voice_duration: null,
        attachment_url: msg.attachmentData ?? null, // Use base64 data for local-first
        attachment_data: msg.attachmentData ?? null, // Store base64 data directly
        attachment_name: msg.attachmentName ?? null,
        attachment_mime: msg.attachmentMime ?? null,
        attachment_size: msg.attachmentSize ?? null,
        created_at: new Date(msg.createdAt).toISOString(),
        sender: msg.sender
          ? {
              full_name: msg.sender.full_name,
              preferred_name: msg.sender.preferred_name,
              email: msg.sender.email,
            }
          : undefined,
      }),
    );
  }, [denContext?.shared.chatThread, den.id]);

  const messages: Message[] = useMemo(
    () => [
      // Legacy Supabase-backed messages (no DenProvider)
      ...(denContext ? [] : legacyMessages),
      // Local-first CRDT-backed chat + voice
      ...chatThreadMessages,
      ...voiceMemoMessages,
    ],
    [denContext, legacyMessages, chatThreadMessages, voiceMemoMessages],
  );
  // Sort ASC so oldest message is at top, newest at bottom
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  );

  // ID of the most recent voice message — its mood accordion starts open
  const latestVoiceId = useMemo(() => {
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
      if (sortedMessages[i]!.type === "voice") return sortedMessages[i]!.id;
    }
    return null;
  }, [sortedMessages]);

  // Auto-scroll to bottom of chat container on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [sortedMessages.length]);

  if (sortedMessages.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="rounded-2xl p-14 text-center"
        style={{
          background: "var(--color-bg-card)",
          border: "1.5px dashed var(--color-border-card)",
        }}
      >
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(138,96,53,0.09)" }}
        >
          <MessageSquare
            className="h-5 w-5"
            style={{ color: "var(--color-text-muted)" }}
          />
        </div>
        <p
          className="text-base font-semibold mb-1"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {den.name} is ready
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Tap{" "}
          <strong style={{ color: "var(--color-text-secondary)" }}>+</strong> to
          send a voice message, text, or media.
        </p>
      </motion.div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-4 p-4 sm:p-6 rounded-2xl mb-4 overflow-y-auto"
      style={{
        background: "var(--color-bg-card)",
        border: "1.5px dashed var(--color-border-card)",
        maxHeight: "min(60vh, calc(100dvh - 460px))",
      }}
    >
      {sortedMessages.map((msg) => {
        const senderName = getSenderName(msg.sender);
        const isOwn = msg.user_id === currentUserId;
        const alignClass = isOwn ? "justify-end" : "justify-start";

        if (msg.type === "voice") {
          return (
            <div key={msg.id} className={`flex ${alignClass}`}>
              <VoiceNoteMessage
                message={msg}
                isOwn={isOwn}
                isLatest={msg.id === latestVoiceId}
              />
            </div>
          );
        }

        if (msg.type === "image") {
          return (
            <div key={msg.id} className={`flex ${alignClass}`}>
              <ImageMessage
                message={msg}
                senderName={senderName}
                isOwn={isOwn}
              />
            </div>
          );
        }

        if (msg.type === "document") {
          return (
            <div key={msg.id} className={`flex ${alignClass}`}>
              <DocumentMessage
                message={msg}
                senderName={senderName}
                isOwn={isOwn}
              />
            </div>
          );
        }

        return (
          <div key={msg.id} className={`flex ${alignClass}`}>
            <TextMessage
              content={msg.content ?? ""}
              senderName={senderName}
              isOwn={isOwn}
              createdAt={msg.created_at}
            />
          </div>
        );
      })}
    </div>
  );
}
