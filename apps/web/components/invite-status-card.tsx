"use client";

import { motion } from "framer-motion";
import { GrainOverlay } from "@/components/grain-overlay";

interface InviteStatusCardProps {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}

/**
 * Full-page centered card used for all invite status screens
 * (invalid, expired, already_used, already_member, key error).
 */
export function InviteStatusCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  body,
  children,
}: InviteStatusCardProps) {
  return (
    <div className="min-h-screen page-bg flex items-center justify-center p-6">
      <GrainOverlay />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative w-full max-w-sm rounded-2xl p-8 text-center"
        style={{
          background: "var(--color-bg-card)",
          border: "1.5px solid var(--color-border-card)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.16)",
        }}
      >
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: iconBg }}
        >
          <Icon className="h-7 w-7" style={{ color: iconColor }} />
        </div>
        <h1
          className="text-xl font-bold mb-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </h1>
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {body}
        </p>
        {children}
      </motion.div>
    </div>
  );
}
