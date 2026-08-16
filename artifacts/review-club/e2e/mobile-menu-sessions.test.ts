/**
 * PhotoReviewHub — mobile menu edge-case tests
 *
 * #135 — mobile menu closes when tapping "Sessions" from the same route (/)
 * #136 — Admin mobile menu link closes the panel for admin users
 *
 * API calls are stubbed so the tests run without a live server.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------
async function stubApiCalls(page: Page, isAdmin = false) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("__clerk")) { await route.continue(); return; }
    if (/\/api\/sessions(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      if (isAdmin) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isAdmin: true }) });
      } else {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
      }
      return;
    }
    if (/\/api\/admins\/status(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isAdmin, totalAdmins: 1 }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (test stub)" }) });
  });
}

async function openHamburger(page: Page) {
  const hamburger = page.getByRole("button", { name: /toggle menu/i });
  await expect(hamburger).toBeVisible({ timeout: 10_000 });
  await hamburger.click();
}

// ---------------------------------------------------------------------------
// #135 — Sessions link closes the menu even when already on the sessions route
// ---------------------------------------------------------------------------
test("mobile menu closes when tapping Sessions from the sessions route (#135)", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await stubApiCalls(page);
    // Navigate to "/" — this is the sessions page (active route).
    await page.goto("/", { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await openHamburger(page);

    // Confirm mobile nav is open (Sessions link visible).
    const mobileNav = page.getByTestId("mobile-nav");
    await expect(mobileNav).toBeVisible({ timeout: 5_000 });

    // Tap the Sessions link (same route — already on /).
    const sessionsLink = mobileNav.getByText(/sessies|sessions/i);
    await expect(sessionsLink).toBeVisible();
    await sessionsLink.click();

    // The mobile nav must close.
    await expect(mobileNav, "Mobile nav must close after tapping Sessions on the same route").not.toBeVisible({ timeout: 3_000 });
  } finally {
    await context.close();
  }
});

// ---------------------------------------------------------------------------
// #136 — Admin link in mobile menu closes the panel
// ---------------------------------------------------------------------------
test("Admin link in mobile menu closes the panel for admin users (#136)", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await stubApiCalls(page, /* isAdmin */ true);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await openHamburger(page);

    const mobileNav = page.getByTestId("mobile-nav");
    await expect(mobileNav).toBeVisible({ timeout: 5_000 });

    // The Admin link is conditionally rendered when adminStatus?.isAdmin is true.
    const adminLink = mobileNav.getByText(/admin|beheer/i);
    await expect(adminLink, "Admin link must appear in the mobile menu for admin users").toBeVisible({ timeout: 5_000 });
    await adminLink.click();

    // Panel must close after tapping the Admin link.
    await expect(mobileNav, "Mobile nav must close after tapping the Admin link").not.toBeVisible({ timeout: 3_000 });
  } finally {
    await context.close();
  }
});
