"use client";

import { useState, useEffect, useRef } from "react";
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
import { getInitials } from "@meerkat/utils/string";

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
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    startNavigationProgress();
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    router.push("/login");
    router.refresh();
  };

  const handleNavClick = (href: string) => {
    if (href !== pathname) startNavigationProgress();
  };

  const initials = getInitials(user.name);

  return (
    <>
      <motion.header
        ref={headerRef}
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
          {/* Wordmark */}
          <Link
            href="/"
            onClick={() => handleNavClick("/")}
            className="font-bold text-lg tracking-tight mr-2 shrink-0 transition-opacity duration-150 hover:opacity-75"
            style={{ color: "var(--color-wordmark)" }}
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
                  onClick={() => handleNavClick(href)}
                  className="nav-item relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
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
                    pointerEvents: active ? "none" : "auto",
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right-side actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Search */}
            <button
              className="icon-btn hidden sm:flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ color: "var(--color-text-secondary)" }}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications */}
            <button
              className="icon-btn relative hidden sm:flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ color: "var(--color-text-secondary)" }}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                style={{ background: "#E67E22" }}
              />
            </button>

            {/* Profile dropdown trigger */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="icon-btn flex items-center gap-2 h-8 pl-1 pr-2 rounded-xl"
                style={{ color: "var(--color-text-primary)" }}
              >
                <div
                  className="h-6 w-6 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
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
                    color: "var(--color-text-muted)",
                  }}
                />
              </button>

              {/* Profile dropdown */}
              <AnimatePresence>
                {profileOpen && (
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
                      onClick={() => handleNavClick("/settings")}
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
                      onClick={handleSignOut}
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
                )}
              </AnimatePresence>
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="icon-btn sm:hidden h-8 w-8 flex items-center justify-center rounded-xl"
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

        {/* Mobile menu */}
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
                      className={`${active ? "" : "dropdown-item"} flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium`}
                      style={{
                        color: active
                          ? "var(--color-text-primary)"
                          : "var(--color-text-secondary)",
                        background: active
                          ? "rgba(255,255,255,0.1)"
                          : "transparent",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}

                <div
                  className="border-t mt-1 pt-1"
                  style={{ borderColor: "var(--color-border-card)" }}
                >
                  <button
                    onClick={handleSignOut}
                    className="dropdown-item-danger flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium w-full"
                    style={{ color: "#e05c4a" }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Spacer so content doesn't sit under the fixed nav */}
      <div className="h-20" />
    </>
  );
}
