import { test, expect } from "@playwright/test";

// ── Auth flow E2E tests ────────────────────────────────────────────────────────
//
// These tests verify the critical auth pages render correctly without a real
// Supabase session. They do not attempt to log in, so no credentials are needed.

test.describe("Login page", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");

    // Should show a heading or a recognisable element on the login page
    await expect(page).toHaveTitle(/Meerkat/i);

    // Email + password inputs should be present
    await expect(
      page.locator('input[type="email"], input[name="email"]').first(),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("shows sign-up link", async ({ page }) => {
    await page.goto("/login");
    const signUpLink = page.getByRole("link", {
      name: /sign.?up|create.?account/i,
    });
    await expect(signUpLink).toBeVisible();
  });

  test("shows forgot password link", async ({ page }) => {
    await page.goto("/login");
    const forgotLink = page.getByRole("link", { name: /forgot/i });
    await expect(forgotLink).toBeVisible();
  });
});

test.describe("Vault (v2) login page", () => {
  test("renders the vault login form", async ({ page }) => {
    await page.goto("/v2/login");
    await expect(page).toHaveTitle(/Meerkat/i);

    // Vault login uses a mnemonic / passphrase — look for a textarea or input
    const input = page.locator("textarea, input").first();
    await expect(input).toBeVisible();
  });
});

test.describe("Sign-up page", () => {
  test("renders the sign-up form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveTitle(/Meerkat/i);

    await expect(
      page.locator('input[type="email"], input[name="email"]').first(),
    ).toBeVisible();
  });
});

test.describe("Landing page", () => {
  test("renders without error", async ({ page }) => {
    await page.goto("/landing");
    await expect(page).toHaveTitle(/Meerkat/i);

    // Page should not show a Next.js error boundary
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
