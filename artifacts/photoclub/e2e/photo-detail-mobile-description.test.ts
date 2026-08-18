/**
 * Photo detail — mobile description position smoke test
 *
 * Regression guard for the layout that places the photo description as the
 * first item in the mobile metadata block, directly beneath the photo image.
 *
 * On mobile (≤ 768 px) the description must appear in the DOM before the
 * date row, and its top edge must be above the top edge of the date row.
 * A future refactor that moves the description below the date (or removes the
 * `data-testid` anchors) will cause this test to fail.
 *
 * API calls are stubbed so the test works without a running API server.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture — a photo with a description
// ---------------------------------------------------------------------------
const PHOTO = {
  id: 303,
  title: "Harbour at Dusk",
  imageUrl: "https://placehold.co/400x500/png",
  description: "Golden light reflecting off still water.",
  themeId: null,
  themeName: null,
  clubId: null,
  clubName: null,
  photographerId: 7,
  photographerName: "Alex Visser",
  photographerAvatarUrl: null,
  createdAt: "2024-06-15T00:00:00.000Z",
  sortOrder: 0,
  likeCount: 0,
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
test.describe("PhotoDetail — mobile description position (390 × 844)", () => {
  test("description appears in the DOM before the date row on mobile", async ({
    browser,
  }) => {
    // 390 × 844 mimics a typical iPhone 14 viewport — well below the lg
    // breakpoint (1024px), so the mobile metadata block (lg:hidden) is active.
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

      // Wait for the photo title to appear so the component has fully rendered.
      await page.waitForFunction(
        (title) => (document.body.textContent ?? "").includes(title),
        PHOTO.title,
        { timeout: 15_000 },
      );

      // All three anchors must be present in the DOM.
      const photoContainer = page.getByTestId("photo-image-container");
      const descEl = page.getByTestId("mobile-photo-description");
      const dateRow = page.getByTestId("mobile-photo-date-row");

      await expect(photoContainer).toBeVisible();
      await expect(descEl).toBeVisible();
      await expect(dateRow).toBeVisible();

      // Verify the description text is correct.
      await expect(descEl).toContainText(PHOTO.description);

      // ── DOM order checks ──────────────────────────────────────────────────
      // Node.DOCUMENT_POSITION_FOLLOWING (4) is set when the argument comes
      // *after* the element in document order.

      // 1. Photo image container must precede the description.
      const imgBeforeDescInDom = await page.evaluate(() => {
        const img = document.querySelector("[data-testid='photo-image-container']");
        const desc = document.querySelector("[data-testid='mobile-photo-description']");
        if (!img || !desc) return false;
        return !!(img.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(
        imgBeforeDescInDom,
        "Expected the photo image container to appear before the description in document order",
      ).toBe(true);

      // 2. Description must precede the date row.
      const descBeforeDateInDom = await page.evaluate(() => {
        const desc = document.querySelector("[data-testid='mobile-photo-description']");
        const date = document.querySelector("[data-testid='mobile-photo-date-row']");
        if (!desc || !date) return false;
        return !!(desc.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(
        descBeforeDateInDom,
        "Expected the description to appear before the date row in document order",
      ).toBe(true);

      // ── Bounding-box checks ───────────────────────────────────────────────
      // Catches CSS-based reordering (e.g. flexbox `order:`) that DOM order
      // alone would not detect.
      const imgBox  = await photoContainer.boundingBox();
      const descBox = await descEl.boundingBox();
      const dateBox = await dateRow.boundingBox();

      expect(imgBox,  "Could not measure the photo image container bounding box").not.toBeNull();
      expect(descBox, "Could not measure the description bounding box").not.toBeNull();
      expect(dateBox, "Could not measure the date row bounding box").not.toBeNull();

      // 1. Description top must be below the photo image bottom — i.e., the
      //    description is directly beneath the photo, not above or overlapping it.
      expect(
        descBox!.y,
        `Expected description top (${descBox!.y}px) to be below the photo image bottom (${imgBox!.y + imgBox!.height}px)`,
      ).toBeGreaterThan(imgBox!.y);

      // 2. Description top must be above the date row top.
      expect(
        descBox!.y,
        `Expected description top (${descBox!.y}px) to be above date row top (${dateBox!.y}px)`,
      ).toBeLessThan(dateBox!.y);
    } finally {
      await context.close();
    }
  });

  test("description is not rendered in the mobile block when the photo has no description", async ({
    browser,
  }) => {
    // Sanity-check the inverse: a photo without a description must not produce
    // the description element at all, confirming the conditional rendering
    // guard ({photo.description && …}) is in place.
    const PHOTO_NO_DESC = { ...PHOTO, id: 304, description: null };


    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    try {
      await page.route("**/api/**", async (route) => {
        const url = route.request().url();
        if (url.includes("__clerk")) { await route.continue(); return; }
        if (new RegExp(`/api/photos/${PHOTO_NO_DESC.id}(\\?|$)`).test(url)) {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTO_NO_DESC) });
          return;
        }
        if (new RegExp(`/api/photos/${PHOTO_NO_DESC.id}/comments(\\?|$)`).test(url)) {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
          return;
        }
        if (/\/api\/photos(\?|$)/.test(url)) {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([PHOTO_NO_DESC]) });
          return;
        }
        if (/\/api\/(clubs|themes|photographers)(\?|$)/.test(url)) {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
          return;
        }
        if (/\/api\/admins\/me(\?|$)/.test(url)) {
          await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
          return;
        }
        if (/\/api\/photographers\/me(\?|$)/.test(url)) {
          await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
          return;
        }
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (test stub)" }) });
      });

      await page.goto(`/photos/${PHOTO_NO_DESC.id}`, { waitUntil: "networkidle" });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      await page.waitForFunction(
        (title) => (document.body.textContent ?? "").includes(title),
        PHOTO_NO_DESC.title,
        { timeout: 15_000 },
      );

      // The description element must be absent from the DOM when there is no description.
      const descEl = page.getByTestId("mobile-photo-description");
      await expect(descEl).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Wide tablet viewport test (1000 × 900) — just below the lg breakpoint (#124)
// ---------------------------------------------------------------------------
test.describe("PhotoDetail — wide tablet description position (1000 × 900) (#124)", () => {
  test("description appears before the date row at 1000 px (just below the lg breakpoint) (#124)", async ({
    browser,
  }) => {
    // 1000 × 900 sits just below the lg breakpoint (1024 px) so the mobile
    // metadata block (lg:hidden) is still active. A CSS change targeting
    // wide tablet widths could reorder the description at this specific
    // viewport without affecting the 390 px or 768 px tests — this catches it.
    const context = await browser.newContext({
      viewport: { width: 1000, height: 900 },
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

      const descEl = page.getByTestId("mobile-photo-description");
      const dateRow = page.getByTestId("mobile-photo-date-row");

      await expect(descEl).toBeVisible();
      await expect(dateRow).toBeVisible();
      await expect(descEl).toContainText(PHOTO.description);

      // Description must precede the date row in document order.
      const descBeforeDateInDom = await page.evaluate(() => {
        const desc = document.querySelector("[data-testid='mobile-photo-description']");
        const date = document.querySelector("[data-testid='mobile-photo-date-row']");
        if (!desc || !date) return false;
        return !!(desc.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(
        descBeforeDateInDom,
        "Expected description to appear before the date row in document order at 1000 px",
      ).toBe(true);

      // Bounding-box check: catches CSS-based reordering (e.g. flexbox `order:`).
      const descBox = await descEl.boundingBox();
      const dateBox = await dateRow.boundingBox();

      expect(descBox, "Could not measure the description bounding box at 1000 px").not.toBeNull();
      expect(dateBox, "Could not measure the date row bounding box at 1000 px").not.toBeNull();

      expect(
        descBox!.y,
        `Expected description top (${descBox!.y}px) to be above date row top (${dateBox!.y}px) at 1000 px`,
      ).toBeLessThan(dateBox!.y);
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Tablet viewport test (768 × 1024)
// ---------------------------------------------------------------------------
test.describe("PhotoDetail — tablet description position (768 × 1024)", () => {
  test("description appears in the DOM before the date row on a tablet", async ({
    browser,
  }) => {
    // 768 × 1024 sits in the tablet range (768–1023 px), still below the lg
    // breakpoint (1024 px), so the mobile metadata block (lg:hidden) is active.
    // A CSS-only change such as a flexbox `order` tweak could reorder the
    // description at this width without affecting the 390 px phone test, so we
    // assert both DOM order and rendered bounding-box position here.
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "networkidle" });

      // Dismiss any Vite/Replit runtime-error overlay.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      // Wait for the photo title to appear so the component has fully rendered.
      await page.waitForFunction(
        (title) => (document.body.textContent ?? "").includes(title),
        PHOTO.title,
        { timeout: 15_000 },
      );

      // All three anchors must be present in the DOM.
      const photoContainer = page.getByTestId("photo-image-container");
      const descEl = page.getByTestId("mobile-photo-description");
      const dateRow = page.getByTestId("mobile-photo-date-row");

      await expect(photoContainer).toBeVisible();
      await expect(descEl).toBeVisible();
      await expect(dateRow).toBeVisible();

      // Verify the description text is correct.
      await expect(descEl).toContainText(PHOTO.description);

      // ── DOM order checks ──────────────────────────────────────────────────
      // Node.DOCUMENT_POSITION_FOLLOWING (4) is set when the argument comes
      // *after* the element in document order.

      // 1. Photo image container must precede the description.
      const imgBeforeDescInDom = await page.evaluate(() => {
        const img = document.querySelector("[data-testid='photo-image-container']");
        const desc = document.querySelector("[data-testid='mobile-photo-description']");
        if (!img || !desc) return false;
        return !!(img.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(
        imgBeforeDescInDom,
        "Expected the photo image container to appear before the description in document order",
      ).toBe(true);

      // 2. Description must precede the date row.
      const descBeforeDateInDom = await page.evaluate(() => {
        const desc = document.querySelector("[data-testid='mobile-photo-description']");
        const date = document.querySelector("[data-testid='mobile-photo-date-row']");
        if (!desc || !date) return false;
        return !!(desc.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(
        descBeforeDateInDom,
        "Expected the description to appear before the date row in document order",
      ).toBe(true);

      // ── Bounding-box checks ───────────────────────────────────────────────
      // Catches CSS-based reordering (e.g. flexbox `order:`) that DOM order
      // alone would not detect.
      const imgBox  = await photoContainer.boundingBox();
      const descBox = await descEl.boundingBox();
      const dateBox = await dateRow.boundingBox();

      expect(imgBox,  "Could not measure the photo image container bounding box").not.toBeNull();
      expect(descBox, "Could not measure the description bounding box").not.toBeNull();
      expect(dateBox, "Could not measure the date row bounding box").not.toBeNull();

      // 1. Description top must be below the photo image top — i.e., the
      //    description is positioned after the photo, not above it.
      expect(
        descBox!.y,
        `Expected description top (${descBox!.y}px) to be below the photo image top (${imgBox!.y}px)`,
      ).toBeGreaterThan(imgBox!.y);

      // 2. Description top must be above the date row top.
      expect(
        descBox!.y,
        `Expected description top (${descBox!.y}px) to be above date row top (${dateBox!.y}px)`,
      ).toBeLessThan(dateBox!.y);
    } finally {
      await context.close();
    }
  });
});
