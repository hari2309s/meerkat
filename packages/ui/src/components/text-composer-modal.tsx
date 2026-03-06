"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Loader2, Send } from "lucide-react";
import { ModalShell } from "./modal-shell";
import { HoverButton } from "./hover-button";

interface TextComposerModalProps {
  onClose: () => void;
  onSend: (content: string) => Promise<void>;
}

export function TextComposerModal({ onClose, onSend }: TextComposerModalProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSending(true);
    setError("");
    try {
      await onSend(trimmed);
      setValue("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
      setSending(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(138,96,53,0.12)" }}
        >
          <MessageSquare
            className="h-4 w-4"
            style={{ color: "var(--color-avatar-bg)" }}
          />
        </div>
        <div>
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            New message
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Send a text message to everyone in this den.
          </p>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        rows={3}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
          }
        }}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm font-normal outline-none mb-1 resize-none"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-card)",
          color: "var(--color-text-primary)",
        }}
        placeholder="Type your message…"
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
          disabled={sending || !value.trim()}
          className="px-4 py-2.5 text-xs inline-flex items-center gap-1.5"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Send
            </>
          )}
        </HoverButton>
      </div>
    </ModalShell>
  );
}
