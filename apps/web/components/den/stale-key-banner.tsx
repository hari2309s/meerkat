"use client";

import { useState } from "react";
import { AlertTriangle, Copy, Check } from "lucide-react";

interface StaleKeyBannerProps {
  denName: string;
  denId: string;
}

export function StaleKeyBanner({ denName, denId }: StaleKeyBannerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyRequest = () => {
    const msg = `Hi! I have access to "${denName}" (den ${denId}) but my sync key expired or wasn't saved in this session. Could you send me a fresh invite link from your den's Invite button? Thanks!`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4 text-sm"
      style={{
        background: "rgba(200,150,50,0.10)",
        border: "1px solid rgba(200,150,50,0.25)",
        color: "var(--color-text-secondary)",
      }}
    >
      <AlertTriangle
        className="h-4 w-4 mt-0.5 shrink-0"
        style={{ color: "#c89632" }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="font-medium mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          Sync key expired
        </p>
        <p className="leading-relaxed">
          Your access key for this den is no longer valid in this session. Ask
          the owner for a fresh invite link to reconnect.
        </p>
      </div>
      <button
        onClick={handleCopyRequest}
        className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-75"
        style={{
          background: "rgba(200,150,50,0.15)",
          color: "#c89632",
        }}
        title="Copy a message to send to the den owner"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy request
          </>
        )}
      </button>
    </div>
  );
}
