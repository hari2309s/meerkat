"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: "var(--color-auth-bg-gradient)" }}
    >
      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          backgroundSize: "150px",
        }}
      />

      {/* Meerkats — large, anchored bottom-right */}
      <motion.div
        initial={{ opacity: 0, x: 50, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 1.1, delay: 0.15, ease: "easeOut" }}
        className="absolute bottom-2 right-2 pointer-events-none select-none hidden sm:block"
        style={{ width: "52vw", maxWidth: "660px" }}
      >
        <img
          src="/meerkats.png"
          alt=""
          className="w-full h-auto"
          style={{ filter: "drop-shadow(0 -4px 32px rgba(90,55,20,0.15))" }}
        />
      </motion.div>

      {/* Mobile meerkats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, delay: 0.2 }}
        className="absolute bottom-0 right-0 pointer-events-none select-none sm:hidden"
        style={{ width: "75vw" }}
      >
        <img
          src="/meerkats.png"
          alt=""
          className="w-full h-auto opacity-40"
          style={{ filter: "drop-shadow(0 -4px 20px rgba(90,55,20,0.12))" }}
        />
      </motion.div>

      {/* Vignette behind form */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--color-auth-vignette)" }}
      />

      {/* Form column */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.25 }}
        className="relative z-10 w-full max-w-md px-6 sm:px-0 sm:ml-16 md:ml-24 xl:ml-40 sm:mr-auto"
      >
        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6 text-center"
        >
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{ color: "var(--color-auth-wordmark)" }}
          >
            Meerkat
          </h1>
          <p
            className="text-sm mt-1 font-medium"
            style={{ color: "var(--color-auth-tagline)" }}
          >
            Communicate better
          </p>
        </motion.div>

        {/* Glass card */}
        <div
          className="rounded-2xl p-7 sm:p-8"
          style={{
            background: "var(--color-auth-card-bg)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "var(--color-auth-card-shadow)",
            border: "1.5px solid var(--color-auth-card-border)",
          }}
        >
          <div className="mb-6 text-center">
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--color-auth-wordmark)" }}
            >
              {title}
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--color-auth-tagline)" }}
            >
              {subtitle}
            </p>
          </div>

          {children}
        </div>
      </motion.div>
    </div>
  );
}
