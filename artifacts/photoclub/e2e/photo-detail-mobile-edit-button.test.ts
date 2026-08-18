/**
 * Photo detail — mobile edit button (…) smoke test
 *
 * Regression guard for the layout that places the edit/delete dropdown (…)
 * next to the date row in the mobile metadata block, directly beneath the
 * photo image.
 *
 * On mobile (≤ 768 px) an authorised user (admin or owner) must be able to:
 *   1. See the (…) button in the date row below the photo.
 *   2. Click it and get a dropdown with "Edit details" and "Remove photograph".
 *
 * We simulate an admin session (isAdmin: true) to satisfy `canEdit` without
 * requiring a live Clerk sign-in; the canEdit check is
 * `myProfile?.id === photo.photographerId || adminStatus?.isAdmin`.
 *
 * A future layout change that orphans or hides the button will cause this
 * test to fail before any user notices.
 *
 * API calls are stubbed so the test works without a running API server.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const PHOTO = {
  id: 401,
  title: "Misty Forest Path",
  imageUrl: "https://placehold.co/400x500/png",
  description: "Fog rolling through ancient pines.",
  themeId: null,
  themeName: null,
  clubId: null,
  clubName: null,
  photographerId: 7,
  photographerName: "Sam Visser",
  photographerAvatarUrl: null,
  createdAt: "2024-09-20T00:00:00.000Z",
  sortOrder: 0,
  likeCount: 2,
  likesCount: 2,
};

// ---------------------------------------------------------------------------
// API stub helper
// ---------------------------------------------------------------------------
/** Stubs all API calls needed to render the photo detail page.
 *
 * @param asAdmin - when true, /api/admins/me returns { isAdmin: true },
 *                  which makes canEdit true for any photo regardless of Clerk
 *                  sign-in state.  When false it returns 401.
 */
async function stubApiCalls(page: Page, photoId: number, asAdmin: boolean) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    // Let Clerk auth requests through
    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    // Single photo detail — must come before the list pattern
    if (new RegExp(`/api/photos/${photoId}(\\?|$)`).test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PHOTO),
      });
      return;
    }
    // Comments for the photo
    if (new RegExp(`/api/photos/${photoId}/comments(\\?|$)`).test(url)) {
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
    if (/\/api\/(clubs|themes|photographers)(\?|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }
    // Admin status — controls canEdit when Clerk is not signed in
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      if (asAdmin) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ isAdmin: true }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Not authenticated" }),
        });
      }
      return;
    }
    // Profile endpoint — not signed in via Clerk in tests
    if (/\/api\/(photographers\/me|me)(\?|$)/.test(url)) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not authenticated" }),
      });
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

/** Navigate to the photo detail page and wait for it to fully render. */
async function openPhotoDetail(page: Page, photoId: number, title: string) {
  await page.goto(`/photos/${photoId}`, { waitUntil: "networkidle" });
  // Dismiss any Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  // Wait for the component to fully render.
  await page.waitForFunction(
    (t) => (document.body.textContent ?? "").includes(t),
    title,
    { timeout: 15_000 },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test.describe("PhotoDetail — mobile edit button (390 × 844)", () => {
  test("(…) button is visible in the date row below the photo for an admin", async ({
    browser,
  }) => {
    // 390 × 844 mimics an iPhone 14 — well below the lg breakpoint (1024 px),
    // so the mobile metadata block (lg:hidden) is active.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page, PHOTO.id, /* asAdmin */ true);
      await openPhotoDetail(page, PHOTO.id, PHOTO.title);

      // The date row must be present and visible.
      const dateRow = page.getByTestId("mobile-photo-date-row");
      await expect(dateRow).toBeVisible();

      // The (…) button lives inside the date row.
      const editButton = dateRow.getByRole("button");
      await expect(
        editButton,
        "Expected the (…) edit button to be visible in the mobile date row",
      ).toBeVisible();

      // Confirm the button is positioned below the photo image.
      const photoContainer = page.getByTestId("photo-image-container");
      const imgBox = await photoContainer.boundingBox();
      const btnBox = await editButton.boundingBox();

      expect(imgBox, "Could not measure the photo image container bounding box").not.toBeNull();
      expect(btnBox, "Could not measure the edit button bounding box").not.toBeNull();

      expect(
        btnBox!.y,
        `Expected edit button top (${btnBox!.y}px) to be below the photo image top (${imgBox!.y}px)`,
      ).toBeGreaterThan(imgBox!.y);
    } finally {
      await context.close();
    }
  });

  test("clicking (…) opens a dropdown with Edit and Remove options", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page, PHOTO.id, /* asAdmin */ true);
      await openPhotoDetail(page, PHOTO.id, PHOTO.title);

      // Click the (…) button in the mobile date row.
      const dateRow = page.getByTestId("mobile-photo-date-row");
      const editButton = dateRow.getByRole("button");
      await expect(editButton).toBeVisible({ timeout: 10_000 });
      await editButton.click();

      // The dropdown must show "Edit details" and "Remove photograph".
      // These are the English values for t("photoDetail.edit") and
      // t("photoDetail.remove") respectively.
      await expect(
        page.getByRole("menuitem", { name: /edit details/i }),
        'Expected an "Edit details" menu item in the dropdown',
      ).toBeVisible({ timeout: 5_000 });

      await expect(
        page.getByRole("menuitem", { name: /remove photograph/i }),
        'Expected a "Remove photograph" menu item in the dropdown',
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await context.close();
    }
  });

  test("clicking Edit details in the (…) dropdown opens the edit dialog (#122)", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page, PHOTO.id, /* asAdmin */ true);
      await openPhotoDetail(page, PHOTO.id, PHOTO.title);

      // Open the (…) dropdown.
      const dateRow = page.getByTestId("mobile-photo-date-row");
      const editButton = dateRow.getByRole("button");
      await expect(editButton).toBeVisible({ timeout: 10_000 });
      await editButton.click();

      // Click the "Edit details" menu item.
      const editMenuItem = page.getByRole("menuitem", { name: /edit details/i });
      await expect(editMenuItem).toBeVisible({ timeout: 5_000 });
      await editMenuItem.click();

      // The edit dialog must open — its title is "Edit Photograph".
      await expect(
        page.getByRole("dialog"),
        "Expected the edit dialog to open after clicking Edit details",
      ).toBeVisible({ timeout: 5_000 });

      await expect(
        page.getByRole("dialog").getByText(/edit photograph/i),
        'Expected the dialog title to contain "Edit Photograph"',
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await context.close();
    }
  });

  test("clicking Remove photograph in the (…) dropdown opens the delete confirmation (#123)", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page, PHOTO.id, /* asAdmin */ true);
      await openPhotoDetail(page, PHOTO.id, PHOTO.title);

      // Open the (…) dropdown.
      const dateRow = page.getByTestId("mobile-photo-date-row");
      const editButton = dateRow.getByRole("button");
      await expect(editButton).toBeVisible({ timeout: 10_000 });
      await editButton.click();

      // Click the "Remove photograph" menu item.
      const removeMenuItem = page.getByRole("menuitem", { name: /remove photograph/i });
      await expect(removeMenuItem).toBeVisible({ timeout: 5_000 });
      await removeMenuItem.click();

      // The delete confirmation AlertDialog must appear.
      await expect(
        page.getByRole("alertdialog"),
        "Expected the delete confirmation dialog to open after clicking Remove photograph",
      ).toBeVisible({ timeout: 5_000 });

      await expect(
        page.getByRole("alertdialog").getByText(/are you absolutely sure/i),
        'Expected the alert dialog to contain "Are you absolutely sure?"',
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await context.close();
    }
  });

  test("(…) button is absent when the viewer has no edit permission", async ({
    browser,
  }) => {
    // Sanity-check the inverse: a non-admin, non-owner sees no edit button,
    // so canEdit is false and actionMenu is null.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    try {
      await stubApiCalls(page, PHOTO.id, /* asAdmin */ false);
      await openPhotoDetail(page, PHOTO.id, PHOTO.title);

      // The date row is still present but must contain no button.
      const dateRow = page.getByTestId("mobile-photo-date-row");
      await expect(dateRow).toBeVisible();

      const editButton = dateRow.getByRole("button");
      await expect(
        editButton,
        "Expected no (…) button in the mobile date row for a non-admin/non-owner",
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
