/**
 * Mobile navigation — extended edge-case tests
 *
 * #132 — menu stays closed after the browser back button is pressed
 * #137 — every nav link (Gallery, Clubs, Themes, Photographers) closes the menu,
 *        not just Gallery
 *
 * Strategy: for each nav link we FIRST navigate to that page so it's the
 * active route, THEN open the hamburger and tap the same link.  This is the
 * most reliable check because same-route clicks don't trigger a page reload
 * (preventing locator re-matching issues), and it proves each individual link
 * has the onClick close handler wired up.
 *
 * For #132 we start on a page, navigate away via the hamburger, press Back,
 * and verify the mobile-nav panel is absent.
 *
 * API calls are stubbed so the tests run without a live server.
 * The mobile menu container has data-testid="mobile-nav" (set in layout.tsx).
 */

import { test, expect, type Page } from "@playwright/test";

async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("__clerk")) { await route.continue(); return; }
    const stubs = [
      { pattern: /\/api\/clubs(\?|$)/, body: [] },
      { pattern: /\/api\/themes(\?|$)/, body: [] },
      { pattern: /\/api\/photographers(\?|$)/, body: [] },
      { pattern: /\/api\/photos\/recent(\?|$)/, body: [] },
      { pattern: /\/api\/photos(\?|$)/, body: [] },
      { pattern: /\/api\/stats(\?|$)/, body: { photographs: 0, clubs: 0, photographers: 0, themes: 0 } },
      { pattern: /\/api\/admins\/me(\?|$)/, body: { error: "Not authenticated" }, status: 401 },
      { pattern: /\/api\/photographers\/me(\?|$)/, body: { error: "Not found" }, status: 404 },
      { pattern: /\/api\/themes\/my-proposals(\?|$)/, body: [] },
    ] as { pattern: RegExp; body: unknown; status?: number }[];
    const stub = stubs.find((s) => s.pattern.test(url));
    if (stub) {
      await route.fulfill({ status: stub.status ?? 200, contentType: "application/json", body: JSON.stringify(stub.body) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (test stub)" }) });
  });
}

// ---------------------------------------------------------------------------
// #137 — every nav link closes the menu (not just Gallery)
//
// For each page we navigate there first, then open the hamburger and tap the
// same nav link.  After tapping, [data-testid="mobile-nav"] must be absent.
// ---------------------------------------------------------------------------
const NAV_PAGES = [
  { label: /gallery/i, path: "/photos" },
  { label: /clubs/i, path: "/clubs" },
  { label: /themes/i, path: "/themes" },
  { label: /photographers/i, path: "/photographers" },
] as const;

for (const { label, path } of NAV_PAGES) {
  test(`mobile menu closes after tapping "${String(label)}" nav link (#137)`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      // Navigate directly to this page so the nav link is the active route.
      await page.goto(path, { waitUntil: "networkidle" });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      // Open the hamburger.
      const hamburger = page.getByRole("button", { name: /toggle menu/i });
      await expect(hamburger).toBeVisible();
      await hamburger.click();

      // The mobile nav panel must be visible.
      const mobileNav = page.getByTestId("mobile-nav");
      await expect(mobileNav).toBeVisible({ timeout: 3_000 });

      // Tap the nav link for this page.
      const link = mobileNav.getByRole("link", { name: label });
      await expect(link).toBeVisible();
      await link.click();

      // The panel must close (removed from DOM).
      await expect(mobileNav, `Mobile nav must close after tapping "${String(label)}" link`).not.toBeAttached({ timeout: 3_000 });
    } finally {
      await context.close();
    }
  });
}

// ---------------------------------------------------------------------------
// #132 — mobile menu stays closed after the browser back button is used
// ---------------------------------------------------------------------------
test("mobile menu stays closed after the browser back button is used (#132)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await stubApiCalls(page);
    // Start at /photos.
    await page.goto("/photos", { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Open the hamburger and tap Clubs to navigate away.
    const hamburger = page.getByRole("button", { name: /toggle menu/i });
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    const mobileNav = page.getByTestId("mobile-nav");
    await expect(mobileNav).toBeVisible({ timeout: 3_000 });

    const clubsLink = mobileNav.getByRole("link", { name: /clubs/i });
    await expect(clubsLink).toBeVisible();
    await clubsLink.click();

    // Menu must close after tapping.
    await expect(mobileNav).not.toBeAttached({ timeout: 3_000 });

    // Press the browser back button — navigates back to /photos.
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    // The mobile nav panel must STILL be closed after going back.
    await expect(
      page.getByTestId("mobile-nav"),
      "Mobile nav must stay closed after pressing the browser back button",
    ).not.toBeAttached({ timeout: 3_000 });
  } finally {
    await context.close();
  }
});
