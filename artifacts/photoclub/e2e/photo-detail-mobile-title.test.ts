/**
 * Photo detail — mobile title position smoke test
 *
 * Regression guard for the layout that places a duplicate `lg:hidden` h1 above
 * the photo image on small screens. On mobile the title must be visible without
 * scrolling, i.e. its top edge must sit above the top edge of the <img>.
 *
 * A future refactor that accidentally removes the `lg:hidden` h1, moves it
 * below the image, or hides it with CSS would cause this test to fail.
 *
 * API calls are stubbed so the test works without a running API server.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const PHOTO = {
  id: 101,
  title: "Street Corner",
  imageUrl: "https://placehold.co/400x500/png",
  description: "A moody street shot.",
  themeId: 1,
  themeName: "Street",
  clubId: 7,
  clubName: "City Shooters",
  photographerId: 42,
  photographerName: "Jane Doe",
  createdAt: "2024-01-01T00:00:00.000Z",
  sortOrder: 0,
  likesCount: 0,
};

// ---------------------------------------------------------------------------
// API stub helper
// ---------------------------------------------------------------------------
async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    // Let Clerk auth requests through
    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    // Single photo detail — must come before the list pattern
    if (new RegExp(`/api/photos/${PHOTO.id}(\\?|$)`).test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PHOTO),
      });
      return;
    }
    // Comments for the photo
    if (new RegExp(`/api/photos/${PHOTO.id}/comments(\\?|$)`).test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }
    // Photos list (navigation context)
    if (/\/api\/photos(\?|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([PHOTO]),
      });
      return;
    }
    // List endpoints → empty arrays
    if (/\/api\/clubs(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/themes(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/photographers(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    // Auth / admin — not signed in
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
      return;
    }
    if (/\/api\/photographers\/me(\?|$)/.test(url)) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
      return;
    }
    // Fallback
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found (test stub)" }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test.describe("PhotoDetail — mobile title position (390 × 844)", () => {
  test.beforeEach(async ({ browser, page: _page }, testInfo) => {
    // Override viewport for the whole describe block via the `browser` fixture
    // by storing the context on testInfo so individual tests can use it.
    // We actually create a new context in each test below for viewport control.
    void browser; void _page; void testInfo;
  });

  test("the photo title h1 is visible above the photo image on mobile", async ({
    browser,
  }) => {
    // Create a mobile-sized context — 390 × 844 mimics a typical iPhone 14 viewport.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "networkidle" });

      // Dismiss any Vite/Replit runtime-error overlay.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      // Wait for the photo title to appear in the DOM.
      await page.waitForFunction(
        (title) => (document.body.textContent ?? "").includes(title),
        PHOTO.title,
        { timeout: 15_000 },
      );

      // The mobile-only h1 has class `lg:hidden`.  At a 390px viewport the
      // `lg:` breakpoint (1024px) is inactive, so the element should be visible.
      const mobileH1 = page.locator("h1.lg\\:hidden");
      await expect(mobileH1).toBeVisible();

      // The photo <img> should also be visible.
      const photoImg = page.locator(`img[alt="${PHOTO.title}"]`);
      await expect(photoImg).toBeVisible();

      // Bounding-box check: the top of the h1 must be ABOVE (smaller y) the
      // top of the img.  This is the core regression guard: if the title ever
      // moves below the image the test will fail.
      const h1Box = await mobileH1.boundingBox();
      const imgBox = await photoImg.boundingBox();

      expect(h1Box, "Could not measure the mobile h1 bounding box").not.toBeNull();
      expect(imgBox, "Could not measure the img bounding box").not.toBeNull();

      expect(
        h1Box!.y,
        `Expected mobile h1 top (${h1Box!.y}px) to be above the img top (${imgBox!.y}px)`,
      ).toBeLessThan(imgBox!.y);
    } finally {
      await context.close();
    }
  });

  test("the desktop h1 (hidden on mobile) is not visible at a 390px viewport", async ({
    browser,
  }) => {
    // Sanity-check the inverse: the desktop `hidden lg:block` h1 must be hidden
    // at a mobile viewport so we know only the mobile h1 is being tested above.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "networkidle" });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      await page.waitForFunction(
        (title) => (document.body.textContent ?? "").includes(title),
        PHOTO.title,
        { timeout: 15_000 },
      );

      // The desktop sidebar uses `hidden lg:flex`; on a 390px viewport the sidebar
      // (and the h1 inside it) must be hidden.
      const sidebar = page.getByTestId("photo-metadata-sidebar");
      await expect(sidebar).toBeHidden();
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Desktop sidebar metadata guard
// ---------------------------------------------------------------------------
test.describe("PhotoDetail — desktop sidebar metadata (1280 × 800)", () => {
  test("the photographer name, theme, and club are visible in the sidebar", async ({
    browser,
  }) => {
    // 1280 × 800 is above the lg breakpoint (1024px), so the desktop sidebar
    // layout is active. The metadata block (photographer / theme / club) lives
    // inside the sidebar and must remain visible after any layout refactor.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "networkidle" });

      // Dismiss any Vite/Replit runtime-error overlay.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      // Wait until the photo title text is present in the DOM.
      await page.waitForFunction(
        (title) => (document.body.textContent ?? "").includes(title),
        PHOTO.title,
        { timeout: 15_000 },
      );

      // Scope all assertions to the sidebar so a layout regression that moves
      // metadata into the main content area still fails the test.
      const sidebar = page.getByTestId("photo-metadata-sidebar");
      await expect(sidebar).toBeVisible();

      // --- Photographer name ---
      // Rendered as a link inside the sidebar metadata block.
      const photographerLink = sidebar.getByRole("link", {
        name: PHOTO.photographerName,
      });
      await expect(photographerLink).toBeVisible();

      // --- Club name ---
      // Rendered as a link inside the sidebar metadata block (only when clubId is set).
      const clubLink = sidebar.getByRole("link", { name: PHOTO.clubName });
      await expect(clubLink).toBeVisible();

      // --- Theme name ---
      // Rendered as a Badge (span) inside a link inside the sidebar metadata block
      // (only when themeId is set).
      const themeText = sidebar.getByText(PHOTO.themeName, { exact: true });
      await expect(themeText).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Desktop title guard
// ---------------------------------------------------------------------------
test.describe("PhotoDetail — desktop sidebar title (1280 × 800)", () => {
  test("the desktop h1 inside the metadata sidebar is visible at a 1280px viewport", async ({
    browser,
  }) => {
    // 1280 × 800 is a common laptop resolution and well above the lg breakpoint
    // (1024px), so Tailwind's `hidden lg:block` class makes the element visible.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "networkidle" });

      // Dismiss any Vite/Replit runtime-error overlay.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      // Wait until the photo title text is present in the DOM.
      await page.waitForFunction(
        (title) => (document.body.textContent ?? "").includes(title),
        PHOTO.title,
        { timeout: 15_000 },
      );

      // The desktop sidebar container uses `hidden lg:flex`, so at 1280px the
      // sidebar is visible and the h1 inside it must be visible too.
      const sidebar = page.getByTestId("photo-metadata-sidebar");
      await expect(sidebar).toBeVisible();
      const desktopH1 = sidebar.locator("h1");
      await expect(desktopH1).toBeVisible();

      // Confirm the element actually contains the photo title.
      await expect(desktopH1).toHaveText(PHOTO.title);
    } finally {
      await context.close();
    }
  });

  test("the mobile-only h1 (lg:hidden) is not visible at a 1280px viewport", async ({
    browser,
  }) => {
    // Sanity-check the inverse: the `lg:hidden` h1 must be hidden at a desktop
    // viewport so we know only the desktop sidebar h1 is shown on large screens.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "networkidle" });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      await page.waitForFunction(
        (title) => (document.body.textContent ?? "").includes(title),
        PHOTO.title,
        { timeout: 15_000 },
      );

      // The mobile h1 uses `lg:hidden`; on a 1280px viewport it must be hidden.
      const mobileH1 = page.locator("h1.lg\\:hidden");
      await expect(mobileH1).toBeHidden();
    } finally {
      await context.close();
    }
  });
});
