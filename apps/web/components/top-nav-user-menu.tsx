"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LogOut, User } from "lucide-react";

interface NavUser {
  name: string;
  email: string;
}

interface TopNavUserMenuProps {
  user: NavUser;
  onSignOut: () => void;
  onNavClick: (href: string) => void;
}

/**
 * Animated dropdown menu shown when the user clicks their avatar in the top nav.
 * Rendered inside an AnimatePresence in top-nav.tsx — must be mounted/unmounted
 * by the parent to trigger enter/exit animations.
 */
export function TopNavUserMenu({
  user,
  onSignOut,
  onNavClick,
}: TopNavUserMenuProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden py-1.5"
      style={{
        background: "var(--color-bg-dropdown)",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        boxShadow: "var(--color-shadow-nav-scrolled)",
        border: "1.5px solid var(--color-border-card)",
      }}
    >
      {/* User info header */}
      <div
        className="px-4 py-2.5 border-b mb-1"
        style={{ borderColor: "var(--color-border-card)" }}
      >
        <p
          className="text-sm font-semibold truncate"
          style={{ color: "var(--color-text-primary)" }}
        >
          {user.name}
        </p>
        <p
          className="text-xs truncate mt-0.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          {user.email}
        </p>
      </div>

      <Link
        href="/settings"
        onClick={() => onNavClick("/settings")}
        className="dropdown-item w-full flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-xl text-sm"
        style={{
          color: "var(--color-text-secondary)",
          width: "calc(100% - 12px)",
        }}
      >
        <User
          className="h-4 w-4"
          style={{ color: "var(--color-text-secondary)" }}
        />
        Profile & Settings
      </Link>

      <button
        onClick={onSignOut}
        className="dropdown-item-danger w-full flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-xl text-sm transition-all"
        style={{
          color: "#e05c4a",
          width: "calc(100% - 12px)",
        }}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </motion.div>
  );
}
