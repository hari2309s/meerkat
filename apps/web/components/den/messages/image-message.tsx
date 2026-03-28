"use client";

import { motion } from "framer-motion";
import { ImageThumbnail } from "@meerkat/ui";
import { formatMessageTime } from "@meerkat/utils/time";
import type { Message } from "@/types/den";

interface ImageMessageProps {
  message: Message;
  senderName: string;
  isOwn: boolean;
  onImageClick: () => void;
}

export function ImageMessage({
  message,
  senderName,
  isOwn,
  onImageClick,
}: ImageMessageProps) {
  const createdAt = message.created_at;
  const url = message.attachment_data || message.attachment_url || "";
  const alt = message.attachment_name ?? "image attachment";
  const caption = message.content ?? "";

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
          className="rounded-2xl overflow-hidden border"
          style={{ borderColor: "var(--color-border-card)" }}
        >
          <ImageThumbnail
            src={url}
            alt={alt}
            onClick={onImageClick}
            maxWidth={260}
            maxHeight={192}
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
