"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@meerkat/ui";
import { GrainOverlay } from "@/components/grain-overlay";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <div className="min-h-screen page-bg flex items-center justify-center px-4">
      <GrainOverlay />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 text-center max-w-sm space-y-6"
      >
        <div
          className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: "var(--color-bg-card)" }}
        >
          <WifiOff
            className="h-9 w-9"
            style={{ color: "var(--color-text-muted)" }}
          />
        </div>

        <div className="space-y-2">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            You&apos;re offline
          </h1>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {isOnline
              ? "You're back online! Click below to continue."
              : "This page isn't cached yet. Your dens and notes are still available — navigate to one you've visited before."}
          </p>
        </div>

        {isOnline ? (
          <Button
            className="w-full h-12 text-base font-semibold gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            Reload page
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full h-12 font-medium"
            onClick={() => window.history.back()}
          >
            Go back
          </Button>
        )}
      </motion.div>
    </div>
  );
}
