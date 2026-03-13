"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GrainOverlay } from "@/components/grain-overlay";
import { Shield, Mic, Radio, Inbox } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: "easeOut" },
});

export default function LandingPage() {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background: "var(--color-auth-bg-gradient)",
        color: "var(--color-auth-wordmark)",
      }}
    >
      <GrainOverlay position="fixed" />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 h-14"
        style={{
          background: "var(--color-nav-bg-default)",
          backdropFilter: "blur(24px) saturate(1.8)",
          WebkitBackdropFilter: "blur(24px) saturate(1.8)",
          borderBottom: "1px solid var(--color-border-card)",
        }}
      >
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: "var(--color-auth-wordmark)" }}
        >
          Meerkat
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-auth-tagline)" }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="btn-default text-sm px-4 py-1.5 rounded-lg font-medium"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-0 px-6 sm:px-10">
        {/* Text + image row */}
        <div className="relative flex items-stretch">
          {/* Text */}
          <div className="relative z-10 max-w-xl py-16 sm:py-20">
            <motion.p
              {...fadeUp(0.1)}
              className="text-xs font-bold uppercase tracking-widest mb-6"
              style={{ color: "var(--color-auth-tagline)" }}
            >
              Local-first · Private · Real-time
            </motion.p>

            <motion.h1
              {...fadeUp(0.2)}
              className="text-5xl sm:text-7xl font-bold leading-[1.05] tracking-tight mb-6"
              style={{ color: "var(--color-auth-wordmark)" }}
            >
              A private space
              <br />
              for <span style={{ color: "hsl(23 85% 62%)" }}>real</span>
              <br />
              collaboration.
            </motion.h1>

            <motion.p
              {...fadeUp(0.35)}
              className="text-lg sm:text-xl leading-relaxed max-w-md mb-10"
              style={{ color: "var(--color-auth-tagline)" }}
            >
              Meerkat keeps your conversations on your device, encrypted before
              they leave, and synced peer-to-peer — no server in the middle.
            </motion.p>

            <motion.div
              {...fadeUp(0.45)}
              className="flex items-center gap-3 flex-wrap"
            >
              <Link
                href="/signup"
                className="btn-default px-6 py-2.5 rounded-xl text-base font-semibold"
              >
                Start for free
              </Link>
              <Link
                href="/login"
                className="btn-outline px-6 py-2.5 rounded-xl text-base font-semibold"
              >
                Log in
              </Link>
            </motion.div>
          </div>

          {/* Meerkats — right-aligned, bottom-anchored, contained to this row */}
          <motion.div
            initial={{ opacity: 0, x: 40, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 1.1, delay: 0.15, ease: "easeOut" }}
            className="absolute bottom-0 right-0 pointer-events-none select-none hidden sm:block"
            style={{ width: "42vw", maxWidth: 520 }}
          >
            <img
              src="/meerkats.png"
              alt=""
              className="w-full h-auto"
              style={{ filter: "drop-shadow(0 -8px 40px rgba(90,55,20,0.18))" }}
            />
          </motion.div>
        </div>

        {/* Feature strip — sits cleanly below, no image overlap */}
        <motion.div
          {...fadeUp(0.55)}
          className="grid grid-cols-2 sm:grid-cols-4 border-t"
          style={{ borderColor: "var(--color-border-card)" }}
        >
          {[
            {
              icon: Shield,
              label: "Private & Secure",
              desc: "Everything encrypted on-device before any network call.",
            },
            {
              icon: Mic,
              label: "Voice + Emotion",
              desc: "Record voice memos with on-device mood and transcript analysis.",
            },
            {
              icon: Radio,
              label: "Peer-to-Peer",
              desc: "Direct WebRTC connections. No middleman sees your content.",
            },
            {
              icon: Inbox,
              label: "Offline Letterbox",
              desc: "Leave drops for collaborators even when they're not online.",
            },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="px-6 py-8 border-r last:border-r-0"
              style={{ borderColor: "var(--color-border-card)" }}
            >
              <Icon
                size={18}
                className="mb-3"
                style={{ color: "hsl(23 85% 62%)" }}
              />
              <p
                className="font-semibold text-sm mb-1.5"
                style={{ color: "var(--color-auth-wordmark)" }}
              >
                {label}
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-auth-tagline)" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--color-border-card)" }} />

      {/* ── Section: Privacy ─────────────────────────────────────────────── */}
      <section className="grid sm:grid-cols-2 min-h-[80vh]">
        {/* Left: large display text */}
        <div
          className="flex items-center justify-center px-10 py-24 border-r"
          style={{ borderColor: "var(--color-border-card)" }}
        >
          <motion.h2
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight text-center"
            style={{ color: "var(--color-auth-wordmark)" }}
          >
            Nobody sees
            <br />
            <span style={{ color: "hsl(23 85% 62%)" }}>your den.</span>
          </motion.h2>
        </div>

        {/* Right: description + cards */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col justify-center px-10 py-24"
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-5"
            style={{ color: "var(--color-auth-tagline)" }}
          >
            1 — Privacy
          </p>
          <h3
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--color-auth-wordmark)" }}
          >
            Encrypted before it leaves your device
          </h3>
          <p
            className="text-base leading-relaxed mb-8"
            style={{ color: "var(--color-auth-tagline)" }}
          >
            All content is encrypted with AES-GCM-256 on your device before any
            network call. Supabase stores only opaque blobs. Even if the server
            is compromised, your notes, voice memos, and messages are
            unreadable.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                title: "On-device encryption",
                body: "Keys never leave your vault",
              },
              {
                title: "Zero-knowledge invites",
                body: "Secret delivered via URL hash, never sent to any server",
              },
            ].map(({ title, body }) => (
              <div
                key={title}
                className="rounded-xl p-4"
                style={{
                  background: "var(--color-auth-card-bg)",
                  border: "1.5px solid var(--color-auth-card-border)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: "rgba(212,165,116,0.15)" }}
                >
                  <Shield size={14} style={{ color: "hsl(23 85% 62%)" }} />
                </div>
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--color-auth-wordmark)" }}
                >
                  {title}
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--color-auth-tagline)" }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <div style={{ borderTop: "1px solid var(--color-border-card)" }} />

      {/* ── Section: Voice ───────────────────────────────────────────────── */}
      <section className="grid sm:grid-cols-2 min-h-[80vh]">
        {/* Left: description */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col justify-center px-10 py-24 order-2 sm:order-1"
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-5"
            style={{ color: "var(--color-auth-tagline)" }}
          >
            2 — Voice
          </p>
          <h3
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--color-auth-wordmark)" }}
          >
            Your voice, understood
          </h3>
          <p
            className="text-base leading-relaxed mb-8"
            style={{ color: "var(--color-auth-tagline)" }}
          >
            Record voice memos that are transcribed and emotion-analysed
            entirely in your browser using Whisper and an ONNX classifier. No
            audio ever leaves your device.
          </p>
          <div className="flex flex-col gap-3">
            {[
              "Transcription via Whisper (WASM, runs in-browser)",
              "Mood, arousal, and tone detected on-device",
              "Encrypted before upload — even the server never hears it",
            ].map((point) => (
              <div key={point} className="flex items-start gap-2.5">
                <Mic
                  size={13}
                  className="mt-0.5 shrink-0"
                  style={{ color: "hsl(23 85% 62%)" }}
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--color-auth-tagline)" }}
                >
                  {point}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: display text */}
        <div
          className="flex items-center justify-center px-10 py-24 order-1 sm:order-2 border-l"
          style={{ borderColor: "var(--color-border-card)" }}
        >
          <motion.h2
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight text-center"
            style={{ color: "var(--color-auth-wordmark)" }}
          >
            Your voice,
            <br />
            <span style={{ color: "hsl(23 85% 62%)" }}>understood.</span>
          </motion.h2>
        </div>
      </section>

      <div style={{ borderTop: "1px solid var(--color-border-card)" }} />

      {/* ── Section: P2P ─────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-28 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-5xl sm:text-6xl font-bold tracking-tight mb-16"
          style={{ color: "var(--color-auth-wordmark)" }}
        >
          Direct connections.
        </motion.h2>

        <div
          className="grid grid-cols-1 sm:grid-cols-3 max-w-4xl mx-auto overflow-hidden"
          style={{
            border: "1.5px solid var(--color-auth-card-border)",
            borderRadius: 16,
          }}
        >
          {[
            {
              icon: Radio,
              title: "Peer-to-peer sync",
              body: "WebRTC data channels carry Yjs CRDT updates directly between devices. No relay server sees your content.",
            },
            {
              icon: Inbox,
              title: "Offline Letterbox",
              body: "Drop encrypted messages for collaborators who are offline. They collect them automatically when they reconnect.",
            },
            {
              icon: Shield,
              title: "Zero-knowledge invites",
              body: "Invite links use NaCl box encryption with the secret delivered in the URL hash — never transmitted to any server.",
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              className="flex flex-col items-center px-8 py-10 text-center border-r last:border-r-0"
              style={{
                background: "var(--color-auth-card-bg)",
                borderColor: "var(--color-auth-card-border)",
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: "rgba(212,165,116,0.15)" }}
              >
                <Icon size={20} style={{ color: "hsl(23 85% 62%)" }} />
              </div>
              <p
                className="font-bold text-sm mb-2"
                style={{ color: "var(--color-auth-wordmark)" }}
              >
                {title}
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-auth-tagline)" }}
              >
                {body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <div style={{ borderTop: "1px solid var(--color-border-card)" }} />

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ color: "var(--color-auth-wordmark)" }}
          >
            Communicate better.
          </h2>
          <p
            className="text-lg mb-10"
            style={{ color: "var(--color-auth-tagline)" }}
          >
            Your den, your keys, your data.
          </p>
          <Link
            href="/signup"
            className="btn-default inline-block px-8 py-3 rounded-xl text-base font-semibold"
          >
            Create your den
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        className="px-6 sm:px-10 py-7 flex items-center justify-between text-sm border-t"
        style={{
          borderColor: "var(--color-border-card)",
          color: "var(--color-auth-tagline)",
        }}
      >
        <span
          className="font-semibold"
          style={{ color: "var(--color-auth-wordmark)" }}
        >
          Meerkat
        </span>
        <span>Private by design.</span>
        <div className="flex gap-5">
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
          <Link href="/signup" className="hover:underline">
            Sign up
          </Link>
        </div>
      </footer>
    </div>
  );
}
