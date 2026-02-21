"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, X } from "lucide-react";

// ── SectionCard ───────────────────────────────────────────────────────────────

export function SectionCard({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "var(--color-bg-card)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        border: "1.5px solid var(--color-border-card)",
        boxShadow: "var(--color-shadow-card)",
      }}
    >
      <div className="mb-5">
        <h3
          className="text-base font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="toggle-btn relative inline-flex h-6 w-11 shrink-0 items-center rounded-full focus:outline-none transition-colors duration-200"
      style={{
        background: checked ? "var(--color-avatar-bg)" : "rgba(139,111,71,0.2)",
      }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(26px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ── ConfirmModal ──────────────────────────────────────────────────────────────

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
