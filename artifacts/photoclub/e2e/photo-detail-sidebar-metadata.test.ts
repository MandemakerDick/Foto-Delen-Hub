/**
 * Photo detail — sidebar / metadata visibility tests
 *
 * #117 — sidebar metadata stays visible when the photo has no club or theme
 * #118 — at tablet widths (768–1023 px) the mobile metadata block is visible
 *         (the desktop sidebar is hidden; the lg:hidden block replaces it)
 *
 * API calls are stubbed so the tests run without a live server.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture — photo with NO club and NO theme
// ---------------------------------------------------------------------------
const PHOTO_NO_CLUB_THEME = {
  id: 501,
  title: "Empty Fields Photo",
  imageUrl: "https://placehold.co/400x500/png",
  description: null,
  themeId: null,
  themeName: null,
  clubId: null,
  clubName: null,
  photographerId: 9,
  photographerName: "Lena Marsh",
  photographerAvatarUrl: null,
  createdAt: "2024-11-10T00:00:00.000Z",
  sortOrder: 0,
  likeCount: 0,
  likesCount: 0,
};

// Fixture with full metadata for sidebar visibility tests.
const PHOTO_FULL = {
  id: 502,
  title: "Full Metadata Photo",
  imageUrl: "https://placehold.co/400x500/png",
  description: "A beautiful landscape.",
  themeId: 3,
  themeName: "Landscape",
  clubId: 2,
  clubName: "Nature Club",
  photographerId: 9,
  photographerName: "Lena Marsh",
  photographerAvatarUrl: null,
  createdAt: "2024-11-12T00:00:00.000Z",
  sortOrder: 0,
  likeCount: 5,
  likesCount: 5,
};

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------
async function stubApiForPhoto(page: Page, photo: typeof PHOTO_NO_CLUB_THEME) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("__clerk")) { await route.continue(); return; }
    if (new RegExp(`/api/photos/${photo.id}(\\?|$)`).test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(photo) });
      return;
    }
    if (new RegExp(`/api/photos/${photo.id}/comments(\\?|$)`).test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/photos(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([photo]) });
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
    if (/\/api\/(photographers\/me|me)(\?|$)/.test(url)) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });
}

async function openPhotoDetail(page: Page, photo: { id: number; title: string }) {
  await page.goto(`/photos/${photo.id}`, { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.waitForFunction(
    (t) => (document.body.textContent ?? "").includes(t),
    photo.title,
    { timeout: 15_000 },
  );
}

// ---------------------------------------------------------------------------
// #117 — sidebar stays visible when photo has no club or theme
// ---------------------------------------------------------------------------
test.describe("PhotoDetail — sidebar with no club or theme (#117)", () => {
  test("photographer name is visible in mobile metadata block when photo has no club or theme", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    try {
      await stubApiForPhoto(page, PHOTO_NO_CLUB_THEME);
      await openPhotoDetail(page, PHOTO_NO_CLUB_THEME);

      // The mobile metadata block (lg:hidden) is shown at 390px.
      // It should still render the photographer name.
      const photographerName = page.getByText(PHOTO_NO_CLUB_THEME.photographerName);
      await expect(photographerName.first()).toBeVisible();

      // The date row must still be present.
      const dateRow = page.getByTestId("mobile-photo-date-row");
      await expect(dateRow).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("no club or theme rows are rendered when the photo has neither", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    try {
      await stubApiForPhoto(page, PHOTO_NO_CLUB_THEME);
      await openPhotoDetail(page, PHOTO_NO_CLUB_THEME);

      // There must be no club or theme row in the mobile metadata block.
      // clubName and themeName are both null — their text must not appear.
      await expect(page.getByText(/nature club/i)).toHaveCount(0);
      await expect(page.getByText(/landscape/i)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// #118 — metadata block visible on tablets (768–1023 px)
// ---------------------------------------------------------------------------
test.describe("PhotoDetail — metadata block on tablets (#118)", () => {
  test("mobile metadata block (lg:hidden) is visible at 900 px (mid-tablet)", async ({ browser }) => {
    // 900 × 1024 is inside the tablet range (768–1023 px, below the lg breakpoint 1024 px).
    const context = await browser.newContext({ viewport: { width: 900, height: 1024 } });
    const page = await context.newPage();

    try {
      await stubApiForPhoto(page, PHOTO_FULL);
      await openPhotoDetail(page, PHOTO_FULL);

      // At 900 px (below lg=1024px), the lg:hidden mobile block must be visible.
      const dateRow = page.getByTestId("mobile-photo-date-row");
      await expect(dateRow, "Mobile metadata date row should be visible at tablet width").toBeVisible();

      // Photographer name should appear in the metadata block.
      const photographerName = page.getByText(PHOTO_FULL.photographerName);
      await expect(photographerName.first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("desktop sidebar (hidden lg:flex) is NOT visible at 900 px (mid-tablet)", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 900, height: 1024 } });
    const page = await context.newPage();

    try {
      await stubApiForPhoto(page, PHOTO_FULL);
      await openPhotoDetail(page, PHOTO_FULL);

      // The desktop sidebar has data-testid="photo-metadata-sidebar" and class "hidden lg:flex".
      // At 900 px it should be hidden by CSS.
      const sidebar = page.getByTestId("photo-metadata-sidebar");
      await expect(sidebar).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test("mobile metadata block visible at 768 px (the md breakpoint boundary)", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await context.newPage();

    try {
      await stubApiForPhoto(page, PHOTO_FULL);
      await openPhotoDetail(page, PHOTO_FULL);

      const dateRow = page.getByTestId("mobile-photo-date-row");
      await expect(dateRow, "Mobile metadata should be visible at the md breakpoint (768px)").toBeVisible();
    } finally {
      await context.close();
    }
  });
});
