"use client";

/**
 * usePWAInstall
 *
 * Captures the browser's `beforeinstallprompt` event and exposes a stable
 * handle for triggering the native install dialog.
 *
 * Also tracks:
 *   - Whether the app is already running in standalone (installed) mode
 *   - Whether the user has dismissed the banner this session
 *   - Login count (gate: show only after the second login)
 *
 * Returns:
 *   canShow   — true when all conditions are met and the banner should render
 *   install   — call this to trigger the native install prompt
 *   dismiss   — call this to hide the banner permanently
 */

import { useState, useEffect, useCallback } from "react";
import { getFirstUsedAt } from "@/lib/vault-credentials";

const DISMISSED_KEY = "meerkat:pwa-prompt-dismissed";
const ONE_HOUR_MS = 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [enoughTimeElapsed, setEnoughTimeElapsed] = useState(false);

  useEffect(() => {
    // Already running as a PWA — no need to prompt.
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Read persisted dismiss state from localStorage.
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");

    // Check if 1 hour has passed since first use.
    const firstUsedAt = getFirstUsedAt();
    if (!firstUsedAt) return;

    const elapsed = Date.now() - firstUsedAt;
    if (elapsed >= ONE_HOUR_MS) {
      setEnoughTimeElapsed(true);
      return;
    }

    // Not there yet — set a timer for the remaining time.
    const remaining = ONE_HOUR_MS - elapsed;
    const timer = setTimeout(() => setEnoughTimeElapsed(true), remaining);
    return () => clearTimeout(timer);

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setPromptEvent(null);
    }
  }, [promptEvent]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }, []);

  const canShow =
    !!promptEvent && !isInstalled && !dismissed && enoughTimeElapsed;

  return { canShow, install, dismiss, isInstalled };
}
