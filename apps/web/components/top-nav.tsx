"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { startNavigationProgress } from "@/components/navigation-progress";

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

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    startNavigationProgress();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleNavClick = (href: string) => {
    if (href !== pathname) startNavigationProgress();
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
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
              ? "var(--color-bg-nav-scrolled)"
              : "var(--color-bg-nav)",
            backdropFilter: "blur(24px) saturate(1.8)",
            WebkitBackdropFilter: "blur(24px) saturate(1.8)",
            boxShadow: scrolled
              ? "var(--color-shadow-nav-scrolled)"
              : "var(--color-shadow-nav)",
            border: "1.5px solid var(--color-border-nav)",
          }}
        >
          <Link
            href="/"
            onClick={() => handleNavClick("/")}
            className="font-bold text-lg tracking-tight mr-2 shrink-0"
            style={{ color: "var(--color-wordmark)" }}
          >
            Meerkat
          </Link>

          <nav className="hidden sm:flex items-center gap-1 flex-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => handleNavClick(href)}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150"
                  style={{
                    color: active
                      ? "var(--color-wordmark)"
                      : "var(--color-text-secondary)",
                    background: active
                      ? "var(--color-nav-active-bg)"
                      : "transparent",
                    boxShadow: active
                      ? "var(--color-nav-active-shadow)"
                      : "none",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:opacity-70"
              style={{ color: "var(--color-text-secondary)" }}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              className="relative hidden sm:flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:opacity-70"
              style={{ color: "var(--color-text-secondary)" }}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                style={{ background: "#E67E22" }}
              />
            </button>

            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-xl transition-all hover:opacity-80"
                style={{ color: "var(--color-text-primary)" }}
              >
                <div
                  className="h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: "var(--color-avatar-bg)" }}
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
                    color: "var(--color-text-secondary)",
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
                      background: "var(--color-bg-dropdown)",
                      backdropFilter: "blur(20px) saturate(1.6)",
                      WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                      boxShadow: "var(--color-shadow-nav-scrolled)",
                      border: "1.5px solid var(--color-border-card)",
                    }}
                  >
                    <div
                      className="px-4 py-3 border-b"
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
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {user.email}
                      </p>
                    </div>
                    <div className="p-1.5">
                      <Link
                        href="/settings"
                        onClick={() => {
                          handleNavClick("/settings");
                          setProfileOpen(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        <User
                          className="h-4 w-4"
                          style={{ color: "var(--color-text-secondary)" }}
                        />
                        Profile & Settings
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                        style={{ color: "#e05c4a" }}
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="sm:hidden h-8 w-8 flex items-center justify-center rounded-xl transition-all"
              style={{ color: "var(--color-text-secondary)" }}
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

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute top-full left-4 right-4 mt-2 rounded-2xl overflow-hidden"
              style={{
                background: "var(--color-bg-dropdown)",
                backdropFilter: "blur(20px) saturate(1.6)",
                WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                boxShadow: "var(--color-shadow-nav-scrolled)",
                border: "1.5px solid var(--color-border-card)",
              }}
            >
              <div className="p-2">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => handleNavClick(href)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                      style={{
                        color: active
                          ? "var(--color-text-primary)"
                          : "var(--color-text-secondary)",
                        background: active
                          ? "var(--color-nav-active-bg)"
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

      <div className="h-20" />
    </>
  );
}
