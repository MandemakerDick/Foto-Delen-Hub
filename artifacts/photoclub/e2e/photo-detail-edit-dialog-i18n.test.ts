/**
 * Photo detail — edit dialog i18n smoke test
 *
 * #13 — confirms the "Theme" label in the edit photo dialog shows the
 * translated string ("Thema" in Dutch, "Theme" in English) and never the
 * raw i18next key ("photoDetail.theme").
 *
 * Strategy
 * --------
 * - Navigate to the photo detail page as admin (adminStatus.isAdmin = true
 *   so canEdit is true and the action dropdown renders).
 * - Open the (…) DropdownMenu in the desktop sidebar and click "Edit details".
 * - Inspect the <label> element for the Theme field — must be a real
 *   translated string, never the dotted key "photoDetail.theme".
 *
 * Language switching
 * ------------------
 * We navigate to "/" first, set localStorage via page.evaluate(), then
 * navigate to the photo page.  This guarantees i18next sees the locale key
 * before it initialises rather than relying on storageState origin matching.
 *
 * API calls are stubbed; no live server needed.
 */

import { test, expect, type Page } from "@playwright/test";

const PHOTO = {
  id: 801,
  title: "Mountain Reflection",
  imageUrl: "https://placehold.co/400x500/png",
  description: null,
  themeId: null,
  themeName: null,
  clubId: null,
  clubName: null,
  photographerId: 3,
  photographerName: "Tom van Berg",
  photographerAvatarUrl: null,
  createdAt: "2024-08-01T00:00:00.000Z",
  sortOrder: 0,
  likeCount: 0,
  likesCount: 0,
};

async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("__clerk")) { await route.continue(); return; }
    if (new RegExp(`/api/photos/${PHOTO.id}/comments(\\?|$)`).test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (new RegExp(`/api/photos/${PHOTO.id}(\\?|$)`).test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTO) });
      return;
    }
    if (/\/api\/photos(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([PHOTO]) });
      return;
    }
    if (/\/api\/(clubs|themes|photographers)(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    // Admin — makes canEdit true so the action button is rendered.
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isAdmin: true }) });
      return;
    }
    if (/\/api\/(photographers\/me|me)(\?|$)/.test(url)) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
      return;
    }
    if (/\/api\/themes\/my-proposals(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });
}

/** Set the i18n language by loading a page, writing to localStorage, then reloading. */
async function setLanguage(page: Page, lang: string) {
  // Load root to have a valid origin, then set locale before the real navigation.
  await page.evaluate((l) => localStorage.setItem("photoclub.lang", l), lang);
}

/** Open the (…) action dropdown in the desktop sidebar and click Edit. */
async function openEditDialog(page: Page) {
  // At 1280px the sidebar is visible. The actionMenu renders in both mobile and desktop
  // sections; scope to the sidebar to avoid the strict-mode 2-element match.
  const sidebar = page.getByTestId("photo-metadata-sidebar");
  const moreButton = sidebar.getByTestId("photo-action-menu");
  await expect(moreButton).toBeVisible({ timeout: 8_000 });
  await moreButton.click();

  // The first menuitem in the dropdown is "Edit details".
  const editItem = page.getByRole("menuitem").first();
  await expect(editItem).toBeVisible({ timeout: 3_000 });
  await editItem.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test.describe("Photo edit dialog — theme label i18n (#13)", () => {
  test("theme label shows 'Theme' in English (not the raw key)", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Set English before the real page load via addInitScript.
    await context.addInitScript(() => localStorage.setItem("photoclub.lang", "en"));
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      // Navigate, set language, reload.
      await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "domcontentloaded" });
      await setLanguage(page, "en");
      await page.reload({ waitUntil: "networkidle" });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await page.waitForFunction(
        (t) => (document.body.textContent ?? "").includes(t),
        PHOTO.title,
        { timeout: 15_000 },
      );

      await openEditDialog(page);

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // Target the <label> element specifically to avoid matching "Theme" in button text.
      const themeLabel = dialog.locator("label").filter({ hasText: "Theme" });
      await expect(themeLabel.first()).toBeVisible();

      // Raw key must never appear.
      await expect(dialog.getByText("photoDetail.theme")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("theme label shows 'Thema' in Dutch (not the raw key)", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Set Dutch before the real page load.
    await context.addInitScript(() => localStorage.setItem("photoclub.lang", "nl"));
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      // Navigate, reinforce language in localStorage, reload.
      await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "domcontentloaded" });
      await setLanguage(page, "nl");
      await page.reload({ waitUntil: "networkidle" });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await page.waitForFunction(
        (t) => (document.body.textContent ?? "").includes(t),
        PHOTO.title,
        { timeout: 15_000 },
      );

      await openEditDialog(page);

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // The theme label must say "Thema" (Dutch translation), not raw key.
      const themeLabel = dialog.locator("label").filter({ hasText: "Thema" });
      await expect(themeLabel.first()).toBeVisible();

      // Raw key must never appear.
      await expect(dialog.getByText("photoDetail.theme")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
