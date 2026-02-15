import type { Metadata } from "next";
import { DM_Sans, Clash_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const clashDisplay = Clash_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Meerkat - Stand together, communicate better",
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${clashDisplay.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
