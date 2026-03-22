import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for Meerkat web app.
 *
 * Run tests:
 *   pnpm --filter @meerkat/web test:e2e
 *
 * Install browsers once:
 *   pnpm --filter @meerkat/web exec playwright install --with-deps
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],

  // Start the dev server before running tests locally.
  // In CI, assume the server is already running (avoids double-build).
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
