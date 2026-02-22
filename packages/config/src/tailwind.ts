import type { Config } from "tailwindcss";

/**
 * Shared Tailwind CSS base config for the Meerkat monorepo.
 * Extend this in each app's tailwind.config.ts:
 *
 *   import baseConfig from '@meerkat/config/tailwind';
 *   export default { ...baseConfig, content: [...] } satisfies Config;
 */
const config = {
  theme: {
    extend: {
      colors: {
        // Mood / tone colours used by voice message analysis
        mood: {
          happy: "#FBBF24",
          sad: "#60A5FA",
          angry: "#F87171",
          fearful: "#A78BFA",
          disgusted: "#34D399",
          surprised: "#FB923C",
          neutral: "#94A3B8",
        },
      },
      animation: {
        "recording-pulse": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        waveform: "waveform 1.2s ease-in-out infinite",
      },
      keyframes: {
        waveform: {
          "0%, 100%": { transform: "scaleY(0.5)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Partial<Config>;

export default config;
