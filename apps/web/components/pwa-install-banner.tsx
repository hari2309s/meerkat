"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export function PWAInstallBanner() {
  const { canShow, install, dismiss } = usePWAInstall();

  return (
    <AnimatePresence>
      {canShow && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
        >
          <div
            className="w-full max-w-sm rounded-2xl px-4 py-3.5 pointer-events-auto"
            style={{
              background: "var(--color-bg-dropdown)",
              backdropFilter: "blur(24px) saturate(1.8)",
              WebkitBackdropFilter: "blur(24px) saturate(1.8)",
              border: "1.5px solid var(--color-border-card)",
              boxShadow: "var(--color-shadow-nav-scrolled)",
            }}
          >
            {/* Dismiss button */}
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 icon-btn h-6 w-6 flex items-center justify-center rounded-lg"
              style={{ color: "var(--color-text-muted)" }}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3 pr-5">
              {/* Icon */}
              <div
                className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center mt-0.5"
                style={{ background: "rgba(184,144,106,0.18)" }}
              >
                <Download
                  className="h-4.5 w-4.5"
                  style={{ color: "var(--color-wordmark)" }}
                />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold leading-snug"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Install Meerkat for the best experience.
                </p>
                <p
                  className="text-xs mt-0.5 leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Works offline. Feels like a native app.
                  <br />
                  Your Key stays securely on this device.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={install}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--color-wordmark)" }}
              >
                <Download className="h-3.5 w-3.5" />
                Install
              </button>
              <button
                onClick={dismiss}
                className="btn-secondary flex-1 h-8 rounded-xl text-xs font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
