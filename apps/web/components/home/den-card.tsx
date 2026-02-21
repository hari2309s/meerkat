"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Heart, Users, Briefcase, Star, Loader2, Circle } from "lucide-react";
import { usePresenceStore } from "@/stores/use-presence-store";
import type { Den } from "@/types/den";

function getDenIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("family")) return Heart;
  if (lower.includes("work") || lower.includes("job")) return Briefcase;
  if (lower.includes("friend")) return Users;
  if (
    lower.includes("you") ||
    lower.includes("me") ||
    lower.includes("personal")
  )
    return Star;
  return Users;
}

function getDenGradient(index: number) {
  const gradients = [
    "linear-gradient(135deg, rgba(184,144,106,0.18) 0%, rgba(107,79,46,0.28) 100%)",
    "linear-gradient(135deg, rgba(154,114,72,0.15) 0%, rgba(90,55,20,0.25) 100%)",
    "linear-gradient(135deg, rgba(212,165,116,0.18) 0%, rgba(154,114,72,0.28) 100%)",
    "linear-gradient(135deg, rgba(107,79,46,0.15) 0%, rgba(58,39,24,0.35) 100%)",
    "linear-gradient(135deg, rgba(184,144,106,0.12) 0%, rgba(212,165,116,0.22) 100%)",
  ];
  return gradients[index % gradients.length];
}

interface DenCardProps {
  den: Den;
  index: number;
  currentUserId: string;
  navigatingId: string | null;
  onNavigate: (den: Den) => void;
}

// forwardRef is required because AnimatePresence (mode="popLayout") passes a
// ref to its direct children to measure layout. Without it you get the
// "Function components cannot be given refs" console warning.
export const DenCard = forwardRef<HTMLButtonElement, DenCardProps>(
  function DenCard({ den, index, currentUserId, navigatingId, onNavigate }, ref) {
    const Icon = getDenIcon(den.name);
    const isNavigating = navigatingId === den.id;
    const onlineUsers = usePresenceStore((s) => s.onlineUsersByDen[den.id]);
    const onlineCount = onlineUsers
      ? Math.max(0, onlineUsers.has(currentUserId) ? onlineUsers.size - 1 : onlineUsers.size)
      : 0;

    return (
      <motion.button
        ref={ref}
        key={den.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ delay: index * 0.06 }}
        onClick={() => onNavigate(den)}
        disabled={!!navigatingId}
        className="relative h-28 rounded-2xl p-4 text-left group overflow-hidden"
        style={{
          background: getDenGradient(index),
          border: "1.5px solid var(--color-border-card)",
          boxShadow: "var(--color-shadow-card)",
          transition:
            "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        }}
        whileHover={!navigatingId ? { scale: 1.03, y: -2 } : {}}
        whileTap={!navigatingId ? { scale: 0.97 } : {}}
      >
        {/* Icon or spinner */}
        <div
          className="mb-3 inline-flex rounded-xl p-2 transition-colors group-hover:bg-white/20"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          {isNavigating ? (
            <Loader2
              className="h-4 w-4 animate-spin"
              style={{ color: "var(--color-text-primary)" }}
            />
          ) : (
            <Icon
              className="h-4 w-4"
              style={{ color: "var(--color-text-primary)" }}
            />
          )}
        </div>

        <p
          className="text-sm font-semibold leading-tight mb-1.5 truncate"
          style={{ color: "var(--color-text-primary)" }}
        >
          {den.name}
        </p>

        <div
          className="flex items-center gap-3 mt-auto text-[11px] font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          {/* Member count */}
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 opacity-60" />
            <span>{den.members?.[0]?.count ?? 1}</span>
          </div>

          {/* Online count */}
          {onlineCount > 0 && (
            <div
              className="flex items-center gap-1"
              style={{ color: "#22c55e" }}
            >
              <Circle className="h-2 w-2 fill-current opacity-80" />
              <span>{onlineCount}</span>
            </div>
          )}
        </div>

        {/* Hover shimmer */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.09) 0%, transparent 60%)",
          }}
        />
        {/* Border glow on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.18)" }}
        />
      </motion.button>
    );
  },
);
