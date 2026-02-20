"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ModalShell } from "@/components/ui/modal-shell";
import { HoverButton } from "@/components/ui/hover-button";

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div
        className="h-11 w-11 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "rgba(224,92,74,0.12)" }}
      >
        <AlertTriangle className="h-5 w-5" style={{ color: "#e05c4a" }} />
      </div>
      <h2
        className="text-lg font-bold mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h2>
      <p
        className="text-sm mb-6 leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {description}
      </p>
      <div className="flex gap-2">
        <HoverButton
          variant="secondary"
          onClick={onClose}
          className="flex-1 py-2.5 text-sm"
        >
          Cancel
        </HoverButton>
        <HoverButton
          variant="danger"
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 py-2.5 text-sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            confirmLabel
          )}
        </HoverButton>
      </div>
    </ModalShell>
  );
}
