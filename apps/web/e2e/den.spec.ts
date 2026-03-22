import { test, expect } from "@playwright/test";

// ── Den page E2E tests ─────────────────────────────────────────────────────────
//
// Tests the den page at /dens/[id].
//
// Without a real session the middleware redirects unauthenticated requests to
// /login.  We test that redirect behaviour first, then use Playwright's storage
// state to inject a mock vault session so we can exercise the page itself.
//
// NOTE: Tests that require a vault session are marked with the "vault" tag and
// should be run after calling `playwright test --grep @vault` once a real
// mnemonic has been stored in a saved auth state file (see README).

test.describe("Den page — unauthenticated redirect", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    // Navigate directly to a den — middleware should redirect to /login
    await page.goto("/dens/non-existent-den-id");

    // After redirect, URL should contain /login (or /v2/login)
    await expect(page).toHaveURL(/\/(v2\/)?login/);
  });
});

test.describe("Den page — vault user @vault", () => {
  // These tests assume a vault session has been pre-seeded via the
  // `apps/web/e2e/helpers/vault-setup.ts` storageState fixture.
  // Run them with:
  //   PLAYWRIGHT_VAULT_STATE=e2e/vault-state.json playwright test --grep @vault

  test.use({
    storageState: process.env.PLAYWRIGHT_VAULT_STATE ?? "e2e/vault-state.json",
  });

  test("renders the den list on the home page", async ({ page }) => {
    await page.goto("/");

    // Home page should show a den list or an empty state
    await expect(page.getByText(/den|no dens yet/i).first()).toBeVisible({
      timeout: 12_000,
    });
  });
});

test.describe("Search modal", () => {
  // Verify that Cmd+K triggers the search modal on a den page.
  // Requires an authenticated session; skip if no state file is configured.
  test.skip(
    !process.env.PLAYWRIGHT_VAULT_STATE,
    "Requires PLAYWRIGHT_VAULT_STATE env to be set",
  );

  test.use({
    storageState: process.env.PLAYWRIGHT_VAULT_STATE ?? "e2e/vault-state.json",
  });

  test("opens with Cmd+K and closes with Escape", async ({ page }) => {
    await page.goto("/");

    // Navigate to the first available den
    const firstDenLink = page.getByRole("link", { name: /den/i }).first();
    await firstDenLink.click();
    await page.waitForURL(/\/dens\/.+/);

    // Open search modal with Cmd+K
    await page.keyboard.press("Meta+k");
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 4_000 });

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(searchInput).not.toBeVisible();
  });
});
