"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { useChatStore } from "@/stores/use-chat-store";
import { VoiceNoteMessage } from "@/components/den/voice-note-message";
import type { Den } from "@/types/den";

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
                    <span className="text-xs font-semibold px-1" style={{ color: "var(--color-text-muted)" }}>
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
                    {new Date(createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                    })}
                </span>
            </div>
        </motion.div>
    );
}

export function ChatArea({ den, currentUserId }: ChatAreaProps) {
    const messages = useChatStore((s) => s.messages);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    if (messages.length === 0) {
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
                    <MessageSquare className="h-5 w-5" style={{ color: "var(--color-text-muted)" }} />
                </div>
                <p className="text-base font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
                    {den.name} is ready
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Tap{" "}
                    <strong style={{ color: "var(--color-text-secondary)" }}>+</strong>{" "}
                    to send a voice message, text, or media.
                </p>
            </motion.div>
        );
    }

    return (
        <div className="flex flex-col gap-4 pb-4">
            {messages.map((msg) => {
                const senderName =
                    msg.sender?.full_name ?? msg.sender?.email ?? "Unknown";
                const isOwn = msg.user_id === currentUserId;

                if (msg.type === "voice") {
                    return (
                        <div key={msg.id} className={`flex ${isOwn ? "flex-row-reverse" : ""}`}>
                            <VoiceNoteMessage message={msg} />
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
            <div ref={bottomRef} />
        </div>
    );
}
