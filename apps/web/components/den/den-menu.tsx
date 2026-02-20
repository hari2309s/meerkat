"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MoreHorizontal,
  Pencil,
  UserPlus,
  Users,
  Bell,
  BellOff,
  Trash2,
  LogOut,
} from "lucide-react";
import { MenuRow } from "@/components/ui/menu-row";
import { useDenStore } from "@/stores/use-den-store";

interface DenMenuProps {
  isOwner: boolean;
  muted: boolean;
  memberCount: number;
}

function MutedBadge() {
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        background: "rgba(120,120,120,0.14)",
        color: "var(--color-text-muted)",
      }}
    >
      On
    </span>
  );
}

export function DenMenu({ isOwner, muted, memberCount }: DenMenuProps) {
  const { menuOpen, toggleMenu, openModal } = useDenStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        useDenStore.getState().setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <motion.button
        onClick={toggleMenu}
        className="icon-btn h-9 w-9 flex items-center justify-center rounded-xl"
        whileTap={{ scale: 0.9 }}
        style={{
          color: menuOpen
            ? "var(--color-text-primary)"
            : "var(--color-text-secondary)",
          background: menuOpen
            ? "var(--color-nav-item-hover-bg)"
            : "transparent",
          transition: "background 0.15s ease, color 0.15s ease",
        }}
        aria-label="Den options"
      >
        <MoreHorizontal className="h-5 w-5" />
      </motion.button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.91, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed",
              top: (() => {
                const el = menuRef.current;
                if (!el) return 60;
                return el.getBoundingClientRect().bottom + 8;
              })(),
              right: (() => {
                const el = menuRef.current;
                if (!el) return 16;
                return window.innerWidth - el.getBoundingClientRect().right;
              })(),
              width: 224,
              zIndex: 9999,
              background: "var(--color-bg-dropdown)",
              border: "1.5px solid var(--color-border-card)",
              boxShadow:
                "0 14px 44px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.08) inset",
              backdropFilter: "blur(28px) saturate(1.8)",
              borderRadius: 16,
              padding: "6px",
            }}
          >
            <div className="px-2.5 pt-1.5 pb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--color-text-muted)", opacity: 0.6 }}
              >
                Manage
              </span>
            </div>

            <MenuRow
              icon={Pencil}
              label="Rename den"
              disabled={!isOwner}
              sublabel={!isOwner ? "Owner only" : undefined}
              onClick={() => openModal("rename")}
            />
            <MenuRow
              icon={UserPlus}
              label="Invite members"
              onClick={() => openModal("invite")}
            />
            <MenuRow
              icon={Users}
              label="View members"
              badge={
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(138,96,53,0.14)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {memberCount}
                </span>
              }
              onClick={() => openModal("members")}
            />
            <MenuRow
              icon={muted ? Bell : BellOff}
              label={muted ? "Unmute den" : "Mute den"}
              badge={muted ? <MutedBadge /> : undefined}
              onClick={() => openModal("mute")}
            />

            <div
              className="my-1.5 mx-1"
              style={{ height: 1, background: "var(--color-border-card)" }}
            />

            <div className="px-2.5 pt-0.5 pb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(224,92,74,0.5)" }}
              >
                Danger zone
              </span>
            </div>

            {!isOwner && (
              <MenuRow
                icon={LogOut}
                label="Leave den"
                danger
                onClick={() => openModal("leave")}
              />
            )}
            <MenuRow
              icon={Trash2}
              label="Delete den"
              danger
              disabled={!isOwner}
              sublabel={!isOwner ? "Owner only" : undefined}
              onClick={() => openModal("delete")}
            />
            <div className="h-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
