import { test, expect } from "@playwright/test";

// ── Invite flow E2E tests ──────────────────────────────────────────────────────
//
// Tests the invite acceptance page at /invite/[token].
//
// The page has two states:
//   1. Missing #sk= hash → shows "Sync key missing" error with recovery options.
//   2. Present #sk= hash (may be invalid) → attempts to redeem; if invalid,
//      shows "Joined! But sync key missing" error.
//
// We can test both states without a real Supabase session by mocking the API
// responses that the page relies on (flower-pot GET and den membership check).

test.describe("Invite page — missing secret key", () => {
  test("shows the key-missing error when #sk= is absent", async ({ page }) => {
    // Navigate to a fake token URL without a hash fragment
    await page.goto("/invite/fake-token-no-sk");

    // The page should surface the "Sync key missing" error card
    // (Set by InvitePageClient when window.location.hash is empty)
    await expect(
      page.getByText(/sync key missing|key missing/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // There should be a "Copy link request" or "Enter anyway" button
    await expect(
      page.getByRole("button", { name: /copy|enter anyway/i }).first(),
    ).toBeVisible();
  });
});

test.describe("Invite page — with secret key but invalid flower pot", () => {
  test("shows a redeem error when the flower pot is invalid", async ({
    page,
  }) => {
    // Mock the flower-pots GET endpoint to return 404 (token not found)
    await page.route("**/api/flower-pots**", (route) =>
      route.fulfill({
        status: 404,
        body: JSON.stringify({ error: "not found" }),
      }),
    );

    // Navigate with a fake #sk= hash — the page will try to redeem it and fail
    await page.goto(
      "/invite/fake-token#sk=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    );

    // Should show some form of error / "enter anyway" after redeem fails
    await expect(
      page.getByText(/sync key missing|key missing|enter anyway/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Invite page — structure", () => {
  test("renders without a Next.js error boundary", async ({ page }) => {
    await page.goto("/invite/some-token");
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page).toHaveTitle(/Meerkat/i);
  });
});
