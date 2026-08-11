/**
 * Navigation menu — narrow desktop / mobile hamburger smoke test
 *
 * Regression guard: at viewports below the `md` breakpoint (768 px) the
 * desktop nav links are hidden and a hamburger button takes their place.
 * This test pins that behaviour so a future breakpoint or layout change
 * cannot silently remove mobile navigation without failing CI.
 *
 * Checks at 600 × 800 px (below md, above typical phone):
 *   1. Desktop nav links are NOT visible.
 *   2. Hamburger button IS visible.
 *   3. Clicking the hamburger reveals at least one nav link (Sessions).
 *
 * API calls are stubbed so the test runs without a live server.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// API stubs
// ---------------------------------------------------------------------------
async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    const stubs: { pattern: RegExp; status: number; body: unknown }[] = [
      { pattern: /\/api\/sessions(\?|$)/, status: 200, body: [] },
      { pattern: /\/api\/admins\/me(\?|$)/, status: 401, body: { error: "Not authenticated" } },
      { pattern: /\/api\/admins\/status(\?|$)/, status: 200, body: { isAdmin: false, totalAdmins: 1 } },
    ];

    const stub = stubs.find((s) => s.pattern.test(url));
    if (stub) {
      await route.fulfill({
        status: stub.status,
        contentType: "application/json",
        body: JSON.stringify(stub.body),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found (test stub)" }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
test("hamburger menu is present and functional below the md breakpoint (600 × 800)", async ({
  browser,
}) => {
  // 600 px wide — below Tailwind's md breakpoint (768 px).
  const context = await browser.newContext({
    viewport: { width: 600, height: 800 },
  });
  const page = await context.newPage();

  await stubApiCalls(page);
  await page.goto("/", { waitUntil: "networkidle" });

  // Dismiss any Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 1. Desktop nav must NOT be visible at this width.
  //    The desktop <nav> has class "hidden md:flex" — all its links are hidden.
  const desktopNav = page.locator("header nav.hidden");
  await expect(desktopNav).toBeHidden();

  // 2. Hamburger button must be visible.
  const hamburger = page.getByRole("button", { name: /toggle menu/i });
  await expect(hamburger).toBeVisible();

  // 3. Clicking the hamburger must reveal at least the Sessions nav link.
  await hamburger.click();

  // The mobile dropdown contains links that become visible after clicking.
  // We look for a Sessions link that is shown in the mobile panel.
  const sessionsLink = page.getByRole("link", { name: /sessions/i }).last();
  await expect(sessionsLink).toBeVisible();

  await context.close();
});
