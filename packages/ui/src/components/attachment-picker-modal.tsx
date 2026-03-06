"use client";

import { useState, useRef } from "react";
import { ImageIcon, FileText, Loader2, Upload } from "lucide-react";
import { ModalShell } from "./modal-shell";
import { HoverButton } from "./hover-button";

type AttachmentKind = "image" | "document";

interface AttachmentPickerModalProps {
  kind: AttachmentKind;
  onClose: () => void;
  onSend: (file: File, caption?: string) => Promise<void>;
}

export function AttachmentPickerModal({
  kind,
  onClose,
  onSend,
}: AttachmentPickerModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isImage = kind === "image";

  const handleSend = async () => {
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await onSend(file, caption.trim() || undefined);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send attachment.",
      );
      setSending(false);
    }
  };

  const title = isImage ? "Send photo" : "Send document";
  const description = isImage
    ? "Choose an image from your device to share with this den."
    : "Choose a file to share with this den.";
  const Icon = isImage ? ImageIcon : FileText;

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(74,127,193,0.12)" }}
        >
          <Icon
            className="h-4 w-4"
            style={{ color: "var(--color-avatar-bg)" }}
          />
        </div>
        <div>
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {title}
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {description}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <input
          ref={inputRef}
          type="file"
          accept={isImage ? "image/*" : undefined}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setError("");
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium"
          style={{
            background: "var(--color-bg-card)",
            border: "1px dashed var(--color-border-card)",
            color: "var(--color-text-secondary)",
          }}
        >
          <Upload className="h-3.5 w-3.5" />
          {file ? file.name : "Choose a file"}
        </button>
      </div>

      <input
        type="text"
        value={caption}
        onChange={(e) => {
          setCaption(e.target.value);
          setError("");
        }}
        className="w-full rounded-xl px-3.5 py-2 text-xs outline-none mb-1"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-card)",
          color: "var(--color-text-primary)",
        }}
        placeholder="Optional caption"
      />

      {error ? (
        <p className="text-xs mb-3" style={{ color: "#e07050" }}>
          {error}
        </p>
      ) : (
        <div className="mb-3" />
      )}

      <div className="flex gap-2 mt-1 justify-end">
        <HoverButton
          variant="secondary"
          onClick={onClose}
          className="px-4 py-2.5 text-xs"
        >
          Cancel
        </HoverButton>
        <HoverButton
          variant="primary"
          onClick={handleSend}
          disabled={sending || !file}
          className="px-4 py-2.5 text-xs inline-flex items-center gap-1.5"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Send
            </>
          )}
        </HoverButton>
      </div>
    </ModalShell>
  );
}
