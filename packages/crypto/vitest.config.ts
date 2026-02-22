import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use the browser-compatible crypto globals that match the real target env.
    // Vitest's "node" environment provides globalThis.crypto via Node 18+ built-ins.
    environment: "node",
    globals: false,
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts"],

    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
