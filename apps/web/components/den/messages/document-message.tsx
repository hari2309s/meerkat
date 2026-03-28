"use client";

import { motion } from "framer-motion";
import { formatMessageTime } from "@meerkat/utils/time";
import { openAttachment } from "./open-attachment";
import type { Message } from "@/types/den";

interface DocumentMessageProps {
  message: Message;
  senderName: string;
  isOwn: boolean;
}

export function DocumentMessage({
  message,
  senderName,
  isOwn,
}: DocumentMessageProps) {
  const createdAt = message.created_at;
  const url = message.attachment_url ?? message.attachment_data ?? "";
  const name = message.attachment_name ?? message.content ?? "Document";
  const ext = name.includes(".")
    ? (name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE")
    : "FILE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 items-end max-w-[85vw] sm:max-w-sm ${isOwn ? "flex-row-reverse self-end" : ""}`}
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
        <button
          type="button"
          onClick={() => openAttachment(url, name)}
          className="rounded-2xl px-4 py-2.5 flex items-center gap-2 text-left"
          style={{
            background: "var(--color-bg-card)",
            border: "1.5px solid var(--color-border-card)",
            color: "var(--color-text-primary)",
          }}
        >
          <span
            className="inline-flex h-6 w-6 rounded-md items-center justify-center text-[10px] font-semibold shrink-0"
            style={{ background: "rgba(143,82,184,0.12)" }}
          >
            {ext}
          </span>
          <span className="text-xs truncate max-w-[180px]">{name}</span>
        </button>
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
