/**
 * Centralized application configuration.
 * Single source of truth for env access and typed settings.
 *
 * Follows the same pattern as @hute-mate/config: helper functions
 * read from process.env and fall back to defaults, exported as a
 * single deeply-typed `config` const.
 *
 * `clientEnv` and `env` are lazy — validated on first access, not at
 * import/static-analysis time, so Next.js build never throws at the
 * module level.
 */

import { z } from "zod";

// ─── Raw env helpers ──────────────────────────────────────────────────────────

function getEnv(key: string, defaultValue: string): string;
function getEnv(key: string): string | undefined;
function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

// ─── Zod schemas (for type inference + explicit validation) ──────────────────

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type Env = ClientEnv & ServerEnv;

/**
 * Call this once at app startup (e.g. in instrumentation.ts) to get a hard
 * crash with a clear message if any required env vars are missing.
 */
export function validateEnv(): void {
  const clientResult = clientEnvSchema.safeParse(process.env);
  const serverResult = serverEnvSchema.safeParse(process.env);

  const errors = [
    ...(!clientResult.success ? clientResult.error.errors : []),
    ...(!serverResult.success ? serverResult.error.errors : []),
  ];

  if (errors.length > 0) {
    const messages = errors
      .map((e) => `  ✗ ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`\n❌ Invalid environment variables:\n${messages}\n`);
  }
}

/**
 * Browser-safe env object. Safe to import in client components — no secrets included.
 */
export const clientEnv: ClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};

/**
 * Full env including server secrets. SERVER ONLY.
 * Never import this in a client component or any module that reaches the browser bundle.
 */
export const env: Env = {
  ...clientEnv,
  SUPABASE_SERVICE_ROLE_KEY: getEnv("SUPABASE_SERVICE_ROLE_KEY", ""),
  DATABASE_URL: getEnv("DATABASE_URL", ""),
  DIRECT_URL: getEnv("DIRECT_URL", ""),
  NODE_ENV: getEnv("NODE_ENV", "development") as Env["NODE_ENV"],
};

// ─── Typed config object ──────────────────────────────────────────────────────

export const config = {
  app: {
    nodeEnv: getEnv("NODE_ENV", "development"),
    isDevelopment: getEnv("NODE_ENV", "development") === "development",
    isProduction: getEnv("NODE_ENV", "development") === "production",
    url: getEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  },

  supabase: {
    url: getEnv("NEXT_PUBLIC_SUPABASE_URL", ""),
    anonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
    // serviceRoleKey intentionally omitted — access via env.SUPABASE_SERVICE_ROLE_KEY server-side
  },

  database: {
    url: getEnv("DATABASE_URL", ""),
    directUrl: getEnv("DIRECT_URL", ""),
  },

  realtime: {
    awarenessIntervalMs: 5_000,
    idleThresholdMs: 30_000,
  },

  voice: {
    maxDurationMs: 5 * 60 * 1000,
    maxFileSizeBytes: 10 * 1024 * 1024,
    preferredMimeTypes: [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ],
  },

  den: {
    maxNameLength: 80,
    maxMembers: 500,
    maxMessageLength: 10_000,
  },

  storage: {
    buckets: {
      voice: "voice-messages",
      avatars: "avatars",
      attachments: "attachments",
    },
  },

  pagination: {
    defaultPageSize: 50,
    maxPageSize: 200,
    messagesPageSize: 50,
  },

  ui: {
    toastDurationMs: 4_000,
    searchDebounceMs: 300,
    autosaveDebounceMs: 1_000,
  },

  auth: {
    loginPath: "/login",
    defaultRedirect: "/",
  },

  presence: {
    colors: [
      "#F87171",
      "#FB923C",
      "#FBBF24",
      "#34D399",
      "#38BDF8",
      "#818CF8",
      "#C084FC",
      "#F472B6",
    ] as const,
  },
} as const;

export type Config = typeof config;
export type AppConfig = typeof config.app;
export type SupabaseConfig = typeof config.supabase;
export type VoiceConfig = typeof config.voice;
export type PresenceColor = (typeof config.presence.colors)[number];
