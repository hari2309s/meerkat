/**
 * Centralized application configuration.
 * Single source of truth for env access and typed settings.
 *
 * Follows the same pattern as @hute-mate/config: helper functions
 * read from process.env and fall back to defaults, exported as a
 * single deeply-typed `config` const.
 *
 * For validated Zod schemas (catching missing vars at startup), also
 * see the `env` export below.
 */

import { z } from "zod";

// ─── Raw env helpers ──────────────────────────────────────────────────────────

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    console.warn(`⚠️  Environment variable ${key} is not set`);
    return "";
  }
  return value ?? defaultValue ?? "";
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Required environment variable ${key} is not set`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(
      `⚠️  ${key} is not a valid number — using default: ${defaultValue}`,
    );
    return defaultValue;
  }
  return parsed;
}

// ─── Zod schemas (fail-fast validation) ──────────────────────────────────────

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_YJS_WEBSOCKET_URL: z.string().url().optional(),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type Env = ClientEnv & ServerEnv;

function parseClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `  ✗ ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(
      `\n❌ Invalid client environment variables:\n${messages}\n`,
    );
  }
  return result.data;
}

function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `  ✗ ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(
      `\n❌ Invalid server environment variables:\n${messages}\n`,
    );
  }
  return result.data;
}

/**
 * Browser-safe validated env. Import this in client components / browser code.
 */
export const clientEnv: ClientEnv = parseClientEnv();

/**
 * Full validated env including server secrets. SERVER ONLY.
 * Never import this in a client component or any module that reaches the browser bundle.
 */
export const env: Env = { ...clientEnv, ...parseServerEnv() };

// ─── Typed config object ──────────────────────────────────────────────────────

export const config = {
  app: {
    nodeEnv: getEnv("NODE_ENV", "development"),
    isDevelopment: getEnv("NODE_ENV", "development") === "development",
    isProduction: getEnv("NODE_ENV", "development") === "production",
    url: getEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  },

  supabase: {
    url: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    // serviceRoleKey intentionally omitted — access via env.SUPABASE_SERVICE_ROLE_KEY server-side
  },

  database: {
    url: getEnv("DATABASE_URL"),
    directUrl: getEnv("DIRECT_URL"),
  },

  realtime: {
    yjsWebsocketUrl: getEnv(
      "NEXT_PUBLIC_YJS_WEBSOCKET_URL",
      "ws://localhost:1234",
    ),
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

  trpc: {
    apiPath: "/api/trpc",
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
