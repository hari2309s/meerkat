import type { Metadata } from "next";
import { Ysabeau_Office } from "next/font/google";
import { Toaster } from "sonner";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { NavigationProgress } from "@/components/navigation-progress";
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
  icons: {
    icon: "/favicon.png",
  },
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('meerkat-theme') || 'light';
                  var resolved = theme === 'system'
                    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                    : theme;
                  if (resolved === 'dark') document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          {/* Needs Suspense because NavigationProgress uses useSearchParams */}
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--color-bg-dropdown)",
                backdropFilter: "blur(20px)",
                border: "1.5px solid var(--color-border-card)",
                borderRadius: "14px",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-sans)",
                boxShadow: "var(--color-shadow-nav-scrolled)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
