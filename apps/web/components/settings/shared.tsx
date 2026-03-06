"use client";

// Re-exported from @meerkat/ui — import from there directly for new code.
export { SectionCard } from "@meerkat/ui";
export { Toggle } from "@meerkat/ui";

// ── ConfirmModal ──────────────────────────────────────────────────────────────
// Note: this variant uses an `open` prop; differs from the one in @meerkat/ui.

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect } from "react";

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  confirmVariant = "danger",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: "danger" | "default";
  loading?: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(4px)",
            }}
            onClick={onClose}
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
              className="absolute top-4 right-4 p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(192, 57, 43, 0.12)" }}
            >
              <AlertTriangle className="h-6 w-6" style={{ color: "#c0392b" }} />
            </div>

            <h2
              className="text-base font-bold mb-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              {title}
            </h2>
            <div
              className="text-sm leading-relaxed mb-6"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {body}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
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
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity hover:opacity-90"
                style={
                  confirmVariant === "danger"
                    ? { background: "#c0392b", color: "#fff" }
                    : {
                        background: "var(--color-btn-default-bg)",
                        color: "var(--color-btn-default-text)",
                      }
                }
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
