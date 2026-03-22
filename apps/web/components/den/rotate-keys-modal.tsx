"use client";

// ── RotateKeysModal ───────────────────────────────────────────────────────────
//
// Lets the den owner rotate all namespace keys:
//   1. Revoke every issued flower pot (existing invite links stop working).
//   2. Generate a new namespace key set and store it in private.ydoc settings.
//
// After rotation the owner needs to create fresh invite links for all visitors.
// This is an irreversible action — all existing links become invalid.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { getSetting, setSetting } from "@meerkat/local-store";
import { generateDenNamespaceKeys } from "@meerkat/keys";

interface RotateKeysModalProps {
  denId: string;
  onClose: () => void;
}

export function RotateKeysModal({ denId, onClose }: RotateKeysModalProps) {
  const [rotating, setRotating] = useState(false);
  const [done, setDone] = useState(false);

  const handleRotate = async () => {
    setRotating(true);
    try {
      // 1. Revoke all issued flower pots (best-effort — don't block on failure).
      const issuedTokens =
        (await getSetting<string[]>(denId, "issued-pot-tokens")) ?? [];

      await Promise.allSettled(
        issuedTokens.map((token) =>
          fetch(`/api/flower-pots?token=${encodeURIComponent(token)}`, {
            method: "DELETE",
          }),
        ),
      );

      // 2. Generate and store fresh namespace keys.
      const newKeys = await generateDenNamespaceKeys();
      await setSetting(denId, "den-ns-keys", newKeys);

      // 3. Clear the tracked token list — they've all been revoked.
      await setSetting(denId, "issued-pot-tokens", []);

      setDone(true);
      toast.success("Keys rotated", {
        description: `${issuedTokens.length} invite link${issuedTokens.length !== 1 ? "s" : ""} revoked. Create new invites for your visitors.`,
      });
    } catch (err) {
      toast.error("Rotation failed", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setRotating(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: "rgba(0,0,0,0.48)",
            backdropFilter: "blur(4px)",
          }}
          onClick={!rotating ? onClose : undefined}
        />

        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative w-full max-w-sm rounded-2xl p-6 z-10"
          style={{
            background: "var(--color-bg-card)",
            border: "1.5px solid var(--color-border-card)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
          }}
        >
          <button
            onClick={onClose}
            disabled={rotating}
            className="absolute top-4 right-4 p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity disabled:opacity-30"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Icon */}
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "rgba(200,150,50,0.12)" }}
          >
            <RotateCcw className="h-6 w-6" style={{ color: "#c89632" }} />
          </div>

          <h2
            className="text-base font-bold mb-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            Rotate den keys
          </h2>

          {done ? (
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: "var(--color-text-secondary)" }}
            >
              All invite links have been revoked and new namespace keys have
              been generated. Create fresh invites for anyone who needs access.
            </p>
          ) : (
            <>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: "var(--color-text-secondary)" }}
              >
                This will revoke <strong>all existing invite links</strong> for
                this den and generate new encryption keys. Visitors will need
                new invite links to reconnect.
              </p>

              {/* Warning */}
              <div
                className="flex gap-2.5 rounded-xl p-3 mb-6"
                style={{
                  background: "rgba(200,150,50,0.08)",
                  border: "1px solid rgba(200,150,50,0.2)",
                }}
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0 mt-0.5"
                  style={{ color: "#c89632" }}
                />
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#c89632" }}
                >
                  This cannot be undone. All current invite links will stop
                  working immediately.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={rotating}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium border transition-opacity hover:opacity-75 disabled:opacity-50"
                  style={{
                    borderColor: "var(--color-border-card)",
                    color: "var(--color-text-secondary)",
                    background: "transparent",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRotate}
                  disabled={rotating}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: "#c89632", color: "#fff" }}
                >
                  {rotating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {rotating ? "Rotating…" : "Rotate keys"}
                </button>
              </div>
            </>
          )}

          {done && (
            <button
              onClick={onClose}
              className="w-full rounded-xl py-2.5 text-sm font-semibold"
              style={{
                background: "var(--color-btn-default-bg)",
                color: "var(--color-btn-default-text)",
              }}
            >
              Done
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
