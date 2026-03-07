"use client";

import { useState, useEffect } from "react";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fade-out as soon as the app has hydrated
    setFading(true);
    const t = setTimeout(() => setVisible(false), 400);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        background: "var(--color-page-gradient)",
        transition: "opacity 0.4s ease",
        opacity: fading ? 0 : 1,
        pointerEvents: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/meerkats.png"
        alt="Meerkat"
        style={{
          width: "clamp(100px, 28vw, 360px)",
          height: "clamp(100px, 28vw, 360px)",
          objectFit: "contain",
        }}
      />
      <p
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--color-wordmark)",
          fontFamily: "var(--font-sans)",
          marginTop: "0.25rem",
        }}
      >
        Meerkat
      </p>
      <p
        style={{
          fontSize: "0.8125rem",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-sans)",
          letterSpacing: "0.01em",
        }}
      >
        Encrypted, local, yours forever
      </p>
    </div>
  );
}
