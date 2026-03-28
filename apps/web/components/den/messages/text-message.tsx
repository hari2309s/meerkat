"use client";

import { motion } from "framer-motion";
import { formatMessageTime } from "@meerkat/utils/time";

interface TextMessageProps {
  content: string;
  senderName: string;
  isOwn: boolean;
  createdAt: string;
}

export function TextMessage({
  content,
  senderName,
  isOwn,
  createdAt,
}: TextMessageProps) {
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
