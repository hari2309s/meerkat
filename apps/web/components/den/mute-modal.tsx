"use client";

import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "@/components/ui/modal-shell";
import { HoverButton } from "@/components/ui/hover-button";

interface MuteModalProps {
  muted: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export function MuteModal({ muted, onClose, onToggle }: MuteModalProps) {
  const handleConfirm = () => {
    onToggle();
    toast.success(muted ? "Den unmuted" : "Den muted", {
      description: muted
        ? "You'll receive notifications again."
        : "You won't be notified for new activity.",
      duration: 3000,
    });
    onClose();
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(120,120,120,0.1)" }}
        >
          {muted ? (
            <Bell
              className="h-4 w-4"
              style={{ color: "var(--color-text-secondary)" }}
            />
          ) : (
            <BellOff
              className="h-4 w-4"
              style={{ color: "var(--color-text-secondary)" }}
            />
          )}
        </div>
        <div>
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {muted ? "Unmute den" : "Mute den"}
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Only affects you — not other members
          </p>
        </div>
      </div>
      <p
        className="text-sm mb-6 leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {muted
          ? "You'll start receiving notifications for new messages and activity in this den."
          : "You won't receive notifications from this den. You can still read messages when you visit."}
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
          variant="primary"
          onClick={handleConfirm}
          className="flex-1 py-2.5 text-sm"
        >
          {muted ? (
            <>
              <Bell className="h-3.5 w-3.5" />
              Unmute
            </>
          ) : (
            <>
              <BellOff className="h-3.5 w-3.5" />
              Mute den
            </>
          )}
        </HoverButton>
      </div>
    </ModalShell>
  );
}
