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
    <div className="min-h-screen w-full flex">
      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-meerkat-sand/30">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-5xl">🦦</span>
              <h1 className="text-3xl font-bold text-meerkat-dark">Meerkat</h1>
            </div>
            <p className="text-meerkat-brown">Communicate better</p>
          </div>

          {/* Form content */}
          <div className="bg-white rounded-2xl shadow-2xl shadow-meerkat-tan/20 p-8 border-2 border-meerkat-tan/20">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-meerkat-dark mb-2">
                {title}
              </h2>
              <p className="text-meerkat-brown">{subtitle}</p>
            </div>

            {children}
          </div>
        </motion.div>
      </div>

      {/* Right side - Branding with meerkat image */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-meerkat-tan via-meerkat-brown to-meerkat-dark relative overflow-hidden">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.2) 2%, transparent 0%)`,
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo and brand */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold tracking-tight">Meerkat</h1>
            </div>
            <p className="text-xl text-white/90 font-light">
              Communicate better
            </p>
          </motion.div>

          {/* Meerkat group image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
            className="flex-1 flex items-end justify-center pb-4"
          >
            <img
              src="/meerkats.png"
              alt="A group of meerkats"
              className="w-full max-w-sm object-contain drop-shadow-2xl"
              style={{
                mixBlendMode: "luminosity",
                filter: "brightness(1.1) contrast(1.05)",
              }}
            />
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-4"
          >
            <Feature
              icon="🎙️"
              text="Voice messages with emotional intelligence"
            />
            <Feature icon="⚡" text="Real-time collaboration that just works" />
            <Feature icon="🔒" text="Private and secure for your mob" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <span className="text-white/90 font-light">{text}</span>
    </div>
  );
}
