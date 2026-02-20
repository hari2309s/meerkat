"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MessageSquare,
  ImageIcon,
  Camera,
  FileText,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { useDenStore } from "@/stores/use-den-store";

const FAB_ACTIONS = [
  { key: "voice", icon: Mic, label: "Voice message", color: "#d4673a" },
  { key: "text", icon: MessageSquare, label: "Text message", color: "#8a6035" },
  {
    key: "photo",
    icon: ImageIcon,
    label: "Photo from library",
    color: "#4a7fc1",
  },
  { key: "camera", icon: Camera, label: "Take a photo", color: "#3a9e6a" },
  { key: "document", icon: FileText, label: "Document", color: "#8f52b8" },
] as const;

function FabActionItem({
  action,
  index,
  onAction,
}: {
  action: (typeof FAB_ACTIONS)[number];
  index: number;
  onAction: (key: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.84 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.88 }}
      transition={{
        delay: index * 0.045,
        type: "spring",
        stiffness: 460,
        damping: 28,
      }}
      className="flex items-center gap-3"
    >
      <motion.span
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0, scale: hovered ? 1.04 : 1 }}
        exit={{ opacity: 0, x: 8 }}
        transition={{ delay: index * 0.045 + 0.055 }}
        className="text-xs font-semibold px-2.5 py-1.5 rounded-xl pointer-events-none select-none whitespace-nowrap"
        style={{
          background: hovered
            ? "var(--color-bg-card)"
            : "var(--color-bg-dropdown)",
          color: hovered
            ? "var(--color-text-primary)"
            : "var(--color-text-secondary)",
          border: `1px solid ${hovered ? "var(--color-border-card-hover)" : "var(--color-border-card)"}`,
          boxShadow: hovered
            ? `0 4px 18px rgba(0,0,0,0.22), 0 0 0 2px ${action.color}28`
            : "0 2px 10px rgba(0,0,0,0.14)",
          backdropFilter: "blur(16px)",
          transition: "all 0.16s ease",
        }}
      >
        {action.label}
      </motion.span>
      <motion.button
        onClick={() => onAction(action.key)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="h-11 w-11 rounded-2xl flex items-center justify-center relative overflow-hidden shrink-0"
        style={{
          background: action.color,
          boxShadow: hovered
            ? `0 8px 28px ${action.color}88, 0 0 0 3px ${action.color}24`
            : `0 4px 16px ${action.color}55`,
          transition: "box-shadow 0.18s ease",
        }}
        whileHover={{ scale: 1.13, y: -2.5 }}
        whileTap={{ scale: 0.9 }}
        aria-label={action.label}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.24) 0%, transparent 55%)",
          }}
        />
        <action.icon className="h-5 w-5 text-white relative z-10" />
      </motion.button>
    </motion.div>
  );
}

interface FabProps {
  onAction: (key: string) => void;
}

export function Fab({ onAction }: FabProps) {
  const { fabOpen, toggleFab, setMenuOpen } = useDenStore();

  // Close on outside click
  useEffect(() => {
    if (!fabOpen) return;
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-fab]")) return;
      useDenStore.getState().setFabOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fabOpen]);

  const handleToggle = () => {
    setMenuOpen(false);
    toggleFab();
  };

  return (
    <div
      data-fab
      className="fixed bottom-7 right-7 z-40 flex flex-col items-end gap-3"
    >
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex flex-col-reverse gap-2.5 items-end"
          >
            {FAB_ACTIONS.map((action, i) => (
              <FabActionItem
                key={action.key}
                action={action}
                index={i}
                onAction={onAction}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        onClick={handleToggle}
        className="h-14 w-14 rounded-[18px] flex items-center justify-center"
        style={{
          background: "var(--color-btn-default-bg)",
          boxShadow: fabOpen
            ? "0 4px 16px var(--color-btn-default-shadow)"
            : "0 6px 28px var(--color-btn-default-shadow)",
        }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.91 }}
        aria-label={fabOpen ? "Close" : "Add content"}
      >
        <motion.div
          animate={{ rotate: fabOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
        >
          <Plus
            className="h-6 w-6"
            style={{ color: "var(--color-btn-default-text)" }}
          />
        </motion.div>
      </motion.button>
    </div>
  );
}
