import type { Metadata } from "next";
import { Ysabeau_Office } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const ysabeauOffice = Ysabeau_Office({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
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
      <body className="font-sans antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "rgba(250,242,232,0.92)",
              backdropFilter: "blur(20px)",
              border: "1.5px solid rgba(255,255,255,0.5)",
              borderRadius: "14px",
              color: "#3a2718",
              fontFamily: "var(--font-sans)",
              boxShadow: "0 8px 32px rgba(90,55,20,0.15)",
            },
          }}
        />
      </body>
    </html>
  );
}
