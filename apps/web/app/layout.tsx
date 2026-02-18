import type { Metadata } from "next";
import { Ysabeau_Office } from "next/font/google";
import "./globals.css";

const ysabeauOffice = Ysabeau_Office({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  // Full variable weight axis (1–1000)
  weight: "variable",
});

export const metadata: Metadata = {
  title: "Meerkat - Communicate better",
  description:
    "Collaborative workspace with voice intelligence. Perfect for solo users, families, friends, and small teams.",
  keywords: [
    "collaboration",
    "voice messages",
    "mood analysis",
    "workspace",
    "team communication",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={ysabeauOffice.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
