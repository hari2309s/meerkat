"use client";

import { Mail } from "lucide-react";

export function OfflineLetterboxBanner() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 text-sm"
      style={{
        background: "rgba(99,102,241,0.08)",
        border: "1px solid rgba(99,102,241,0.20)",
        color: "var(--color-text-secondary)",
      }}
    >
      <Mail
        className="h-4 w-4 shrink-0"
        style={{ color: "rgba(99,102,241,0.8)" }}
      />
      <p className="leading-relaxed">
        <span
          className="font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          Host is offline.
        </span>{" "}
        Messages you send will be encrypted and delivered when the host comes
        back online.
      </p>
    </div>
  );
}
