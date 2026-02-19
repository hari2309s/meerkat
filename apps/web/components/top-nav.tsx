"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface NavUser {
  name: string;
  email: string;
}

interface TopNavProps {
  user: NavUser;
}

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function TopNav({ user }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Top bar */}
      <motion.header
        initial={{ y: -10 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
      >
        <div
          className="w-full max-w-4xl rounded-2xl px-4 h-14 flex items-center gap-2 transition-all duration-300"
          style={{
            background: scrolled
              ? "rgba(245,230,210,0.55)"
              : "rgba(245,230,210,0.35)",
            backdropFilter: "blur(24px) saturate(1.8)",
            WebkitBackdropFilter: "blur(24px) saturate(1.8)",
            boxShadow: scrolled
              ? "0 4px 32px rgba(90,55,20,0.12), 0 1px 0 rgba(255,255,255,0.6) inset"
              : "0 2px 16px rgba(90,55,20,0.06), 0 1px 0 rgba(255,255,255,0.5) inset",
            border: "1.5px solid rgba(255,255,255,0.45)",
          }}
        >
          {/* Wordmark */}
          <Link
            href="/"
            className="font-bold text-lg tracking-tight mr-2 shrink-0"
            style={{ color: "#3a2718" }}
          >
            Meerkat
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden sm:flex items-center gap-1 flex-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150"
                  style={{
                    color: active ? "#3a2718" : "#7a5535",
                    background: active
                      ? "rgba(255,255,255,0.45)"
                      : "transparent",
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Search */}
            <button
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:bg-white/40"
              style={{ color: "#7a5535" }}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications */}
            <button
              className="relative hidden sm:flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:bg-white/40"
              style={{ color: "#7a5535" }}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {/* Unread dot */}
              <span
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                style={{ background: "#E67E22" }}
              />
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-xl transition-all hover:bg-white/40"
                style={{ color: "#3a2718" }}
              >
                {/* Avatar */}
                <div
                  className="h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: "#8B6F47" }}
                >
                  {initials}
                </div>
                <span className="hidden sm:block text-sm font-medium max-w-[100px] truncate">
                  {user.name.split(" ")[0]}
                </span>
                <ChevronDown
                  className="h-3.5 w-3.5 hidden sm:block transition-transform duration-200"
                  style={{
                    transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)",
                    color: "#7a5535",
                  }}
                />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden z-50"
                    style={{
                      background: "rgba(250,242,232,0.92)",
                      backdropFilter: "blur(20px) saturate(1.6)",
                      WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                      boxShadow:
                        "0 8px 32px rgba(90,55,20,0.15), 0 1px 0 rgba(255,255,255,0.8) inset",
                      border: "1.5px solid rgba(255,255,255,0.5)",
                    }}
                  >
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-meerkat-tan/20">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: "#3a2718" }}
                      >
                        {user.name}
                      </p>
                      <p
                        className="text-xs truncate mt-0.5"
                        style={{ color: "#7a5535" }}
                      >
                        {user.email}
                      </p>
                    </div>

                    <div className="p-1.5">
                      <Link
                        href="/settings"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all hover:bg-white/50"
                        style={{ color: "#3a2718" }}
                        onClick={() => setProfileOpen(false)}
                      >
                        <User
                          className="h-4 w-4"
                          style={{ color: "#7a5535" }}
                        />
                        Profile & Settings
                      </Link>

                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all hover:bg-red-50"
                        style={{ color: "#c0392b" }}
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="sm:hidden h-8 w-8 flex items-center justify-center rounded-xl hover:bg-white/40 transition-all"
              style={{ color: "#7a5535" }}
              aria-label="Menu"
            >
              {menuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute top-full left-4 right-4 mt-2 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(250,242,232,0.95)",
                backdropFilter: "blur(20px) saturate(1.6)",
                WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                boxShadow: "0 8px 32px rgba(90,55,20,0.14)",
                border: "1.5px solid rgba(255,255,255,0.5)",
              }}
            >
              <div className="p-2">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                      style={{
                        color: active ? "#3a2718" : "#7a5535",
                        background: active
                          ? "rgba(255,255,255,0.5)"
                          : "transparent",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Spacer so content doesn't sit under the fixed bar */}
      <div className="h-20" />
    </>
  );
}
