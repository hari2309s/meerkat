"use client";

import { useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { useChatStore } from "@/stores/use-chat-store";
import { useDenContextSafe } from "@meerkat/crdt";
import { useFeature } from "@/lib/feature-flags-context";
import { VoiceNoteMessage } from "@/components/den/voice-note-message";
import { formatMessageTime } from "@meerkat/utils/time";
import { getSenderName } from "@meerkat/utils/string";
import type { Den, Message } from "@/types/den";
import type { VoiceMemoData } from "@meerkat/local-store";

interface ChatAreaProps {
  den: Den;
  currentUserId: string;
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

export function ChatArea({ den, currentUserId }: ChatAreaProps) {
  const legacyMessages = useChatStore((s) => s.messages);
  const denContext = useDenContextSafe();
  const useLocalFirst = useFeature("localFirstStorage");
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert CRDT voice memos to Message format for display
  const voiceMemoMessages = useMemo((): Message[] => {
    if (!useLocalFirst || !denContext?.shared.voiceThread) return [];

    return denContext.shared.voiceThread.map(
      (memo: VoiceMemoData): Message => ({
        id: memo.id,
        den_id: den.id,
        user_id: currentUserId,
        type: "voice" as const,
        content: null,
        voice_url: memo.blobRef,
        voice_duration: memo.durationSeconds,
        created_at: new Date(memo.createdAt).toISOString(),
        sender: memo.sender,
        analysis: memo.analysis as Message["analysis"],
      }),
    );
  }, [useLocalFirst, denContext?.shared.voiceThread, den.id, currentUserId]);

  // Use CRDT voice memos in local-first mode, otherwise use legacy messages
  const messages = useLocalFirst ? voiceMemoMessages : legacyMessages;

  // Sort ASC so oldest message is at top, newest at bottom
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  );

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
        maxHeight: "65vh",
      }}
    >
      {sortedMessages.map((msg) => {
        const senderName = getSenderName(msg.sender);
        const isOwn = msg.user_id === currentUserId;

        if (msg.type === "voice") {
          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? "flex-row-reverse" : ""}`}
            >
              <VoiceNoteMessage message={msg} isOwn={isOwn} />
            </div>
          );
        }

        return (
          <TextMessage
            key={msg.id}
            content={msg.content ?? ""}
            senderName={senderName}
            isOwn={isOwn}
            createdAt={msg.created_at}
          />
        );
      })}
    </div>
  );
}
