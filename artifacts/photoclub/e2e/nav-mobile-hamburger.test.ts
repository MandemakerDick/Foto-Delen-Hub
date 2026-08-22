/**
 * Navigation menu — narrow desktop / mobile hamburger smoke test
 *
 * Regression guard: at viewports below the `2xl` breakpoint (1536 px) the
 * full desktop nav links are hidden and a hamburger button takes their place.
 * This test pins that behaviour so a future breakpoint or layout change
 * cannot silently remove access to navigation without failing CI.
 *
 * Checks at 600 × 800 px (a compact viewport above typical phone):
 *   1. Desktop nav links are NOT visible.
 *   2. Hamburger button IS visible.
 *   3. Clicking the hamburger reveals at least one nav link (Gallery).
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
      { pattern: /\/api\/clubs(\?|$)/, status: 200, body: [] },
      { pattern: /\/api\/themes(\?|$)/, status: 200, body: [] },
      { pattern: /\/api\/photographers(\?|$)/, status: 200, body: [] },
      { pattern: /\/api\/photos\/recent(\?|$)/, status: 200, body: [] },
      { pattern: /\/api\/photos(\?|$)/, status: 200, body: [] },
      {
        pattern: /\/api\/stats(\?|$)/,
        status: 200,
        body: { photographs: 0, clubs: 0, photographers: 0, themes: 0 },
      },
      { pattern: /\/api\/admins\/me(\?|$)/, status: 401, body: { error: "Not authenticated" } },
      { pattern: /\/api\/photographers\/me(\?|$)/, status: 404, body: { error: "Not found" } },
      { pattern: /\/api\/themes\/my-proposals(\?|$)/, status: 200, body: [] },
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
  await page.goto("/photos", { waitUntil: "networkidle" });

  // Dismiss any Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 1. Desktop nav links must NOT be visible at this width.
  //    The desktop <nav> has class "hidden 2xl:flex" — all its links are hidden.
  const desktopNav = page.locator("header nav.hidden");
  await expect(desktopNav).toBeHidden();

  // 2. Hamburger button must be visible.
  const hamburger = page.getByRole("button", { name: /toggle menu/i });
  await expect(hamburger).toBeVisible();

  // 3. Clicking the hamburger must reveal at least the Gallery nav link.
  await hamburger.click();

  // The compact dropdown contains links inside the "2xl:hidden" panel.
  // We look for the Gallery link that becomes visible in the dropdown.
  const galleryLink = page.getByRole("link", { name: /gallery/i }).last();
  await expect(galleryLink).toBeVisible();

  await context.close();
});

test("mobile menu closes automatically after a nav link is tapped", async ({
  browser,
}) => {
  // 600 px wide — below Tailwind's md breakpoint (768 px).
  const context = await browser.newContext({
    viewport: { width: 600, height: 800 },
  });
  const page = await context.newPage();

  await stubApiCalls(page);
  await page.goto("/photos", { waitUntil: "networkidle" });

  // Dismiss any Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Open the hamburger menu.
  const hamburger = page.getByRole("button", { name: /toggle menu/i });
  await hamburger.click();

  // Confirm the mobile dropdown is open (Gallery link visible).
  const galleryLink = page.getByRole("link", { name: /gallery/i }).last();
  await expect(galleryLink).toBeVisible();

  // Tap the Gallery nav link.
  await galleryLink.click();

  // The mobile dropdown must no longer be visible after tapping a link.
  // The dropdown is rendered conditionally — when closed it is removed from the DOM.
  await expect(galleryLink).not.toBeVisible();

  await context.close();
});

test("mobile menu closes when the active nav link (same route) is tapped again", async ({
  browser,
}) => {
  // 600 px wide — below Tailwind's md breakpoint (768 px).
  const context = await browser.newContext({
    viewport: { width: 600, height: 800 },
  });
  const page = await context.newPage();

  await stubApiCalls(page);
  // Navigate to /photos — Gallery is already the active link.
  await page.goto("/photos", { waitUntil: "networkidle" });

  // Dismiss any Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Open the hamburger menu.
  const hamburger = page.getByRole("button", { name: /toggle menu/i });
  await hamburger.click();

  // Confirm the mobile dropdown is open (Gallery link visible).
  const galleryLink = page.getByRole("link", { name: /gallery/i }).last();
  await expect(galleryLink).toBeVisible();

  // Tap the Gallery link while already on /photos (same active route).
  await galleryLink.click();

  // The mobile dropdown must close even when the active link is tapped.
  await expect(galleryLink).not.toBeVisible();

  await context.close();
});

test("hamburger menu stays closed after tapping a link on a 375 px phone", async ({
  browser,
}) => {
  // 375 × 667 px — the most common phone viewport (iPhone SE 2nd/3rd gen, iPhone 8).
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
  });
  const page = await context.newPage();

  await stubApiCalls(page);
  await page.goto("/photos", { waitUntil: "networkidle" });

  // Dismiss any Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Open the hamburger menu.
  const hamburger = page.getByRole("button", { name: /toggle menu/i });
  await expect(hamburger).toBeVisible();
  await hamburger.click();

  // Confirm the mobile dropdown is open (Gallery link visible).
  const galleryLink = page.getByRole("link", { name: /gallery/i }).last();
  await expect(galleryLink).toBeVisible();

  // Tap a nav link.
  await galleryLink.click();

  // The mobile dropdown must no longer be visible after tapping a link.
  await expect(galleryLink).not.toBeVisible();

  await context.close();
});

test("hamburger menu stays closed after tapping a link on a 320 px phone", async ({
  browser,
}) => {
  // 320 × 568 px — the smallest common phone viewport (e.g. iPhone SE 1st gen).
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
  });
  const page = await context.newPage();

  await stubApiCalls(page);
  await page.goto("/photos", { waitUntil: "networkidle" });

  // Dismiss any Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Open the hamburger menu.
  const hamburger = page.getByRole("button", { name: /toggle menu/i });
  await expect(hamburger).toBeVisible();
  await hamburger.click();

  // Confirm the mobile dropdown is open (Gallery link visible).
  const galleryLink = page.getByRole("link", { name: /gallery/i }).last();
  await expect(galleryLink).toBeVisible();

  // Tap a nav link.
  await galleryLink.click();

  // The mobile dropdown must no longer be visible after tapping a link.
  await expect(galleryLink).not.toBeVisible();

  await context.close();
});

test("hamburger stays available at a compact desktop width (960 × 800)", async ({
  browser,
}) => {
  // 960 × 800 px — wide enough for a desktop browser, but below the 2xl
  // breakpoint where the full nav would crowd signed-in account actions.
  const context = await browser.newContext({
    viewport: { width: 960, height: 800 },
  });
  const page = await context.newPage();

  await stubApiCalls(page);
  await page.goto("/photos", { waitUntil: "networkidle" });

  // Dismiss any Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 1. The compact desktop menu keeps navigation discoverable.
  const hamburger = page.getByRole("button", { name: /toggle menu/i });
  await expect(hamburger).toBeVisible();

  // 2. The full desktop nav must stay hidden until there is enough room.
  const desktopNav = page.locator("header nav.hidden");
  await expect(desktopNav).toBeHidden();

  // 3. Opening the compact menu still exposes the site navigation.
  await hamburger.click();
  const mobileNav = page.getByTestId("mobile-nav");
  await expect(mobileNav).toBeVisible();
  await expect(page.getByRole("link", { name: /gallery/i }).last()).toBeVisible();
  const menuBox = await mobileNav.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.width).toBeLessThan(500);
  expect(menuBox!.x).toBeGreaterThan(400);

  await context.close();
});
