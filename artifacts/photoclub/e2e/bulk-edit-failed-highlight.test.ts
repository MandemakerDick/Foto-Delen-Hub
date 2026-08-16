/**
 * Bulk-edit — failed row highlight test (#93)
 *
 * When saving a photo in the bulk-edit panel returns a non-2xx response,
 * the row for that photo must gain the destructive border/background styling
 * so admins can immediately see which row failed without guessing.
 *
 * This test stubs a PATCH failure for one photo and verifies the row class.
 *
 * API calls are stubbed; no live server needed.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const PHOTOGRAPHER = {
  id: 11,
  name: "Chris Feld",
  bio: "Documentary photographer.",
  avatarUrl: null,
  photoCount: 2,
  createdAt: "2023-01-01T00:00:00.000Z",
  themes: [],
  clubs: [],
};

const PHOTOS = [
  {
    id: 901,
    title: "Morning Mist",
    imageUrl: "https://placehold.co/80x80/png",
    description: null,
    themeId: null,
    themeName: null,
    clubId: null,
    clubName: null,
    photographerId: 11,
    photographerName: "Chris Feld",
    photographerAvatarUrl: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    sortOrder: 0,
    likeCount: 0,
    likesCount: 0,
  },
  {
    id: 902,
    title: "Evening Glow",
    imageUrl: "https://placehold.co/80x80/png",
    description: null,
    themeId: null,
    themeName: null,
    clubId: null,
    clubName: null,
    photographerId: 11,
    photographerName: "Chris Feld",
    photographerAvatarUrl: null,
    createdAt: "2024-01-02T00:00:00.000Z",
    sortOrder: 1,
    likeCount: 0,
    likesCount: 0,
  },
];

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------
async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("__clerk")) { await route.continue(); return; }

    if (/\/api\/photographers\/11(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTOGRAPHER) });
      return;
    }
    if (/\/api\/photos(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTOS) });
      return;
    }
    // PATCH photo 901 — simulate server error
    if (method === "PATCH" && /\/api\/photos\/901(\?|$)/.test(url)) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal server error" }) });
      return;
    }
    // PATCH photo 902 — success
    if (method === "PATCH" && /\/api\/photos\/902(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...PHOTOS[1], title: "Evening Glow Updated" }) });
      return;
    }
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isAdmin: true }) });
      return;
    }
    if (/\/api\/(clubs|themes)(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/photographers(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/(photographers\/me|me)(\?|$)/.test(url)) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test("failed photo row gets destructive highlight after a PATCH error (#93)", async ({ page }) => {
  await stubApiCalls(page);
  await page.goto("/photographers/11", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.waitForFunction(
    (name) => (document.body.textContent ?? "").includes(name),
    PHOTOGRAPHER.name,
    { timeout: 15_000 },
  );

  // Click "Edit photos" to enter bulk-edit mode.
  const editBtn = page.getByRole("button", { name: /edit photos/i });
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();

  // Wait for the edit panel to render — the input fields appear (not visible in textContent,
  // so we check for the presence of at least 2 input elements in the DOM).
  await page.waitForFunction(
    () => document.querySelectorAll("input[placeholder]").length >= 2,
    { timeout: 10_000 },
  );

  // Dirty photo 901 by changing its title input.
  const titleInputs = page.getByRole("textbox");
  const firstTitleInput = titleInputs.first();
  await firstTitleInput.fill("Updated Title That Will Fail");

  // Also dirty photo 902.
  const secondTitleInput = titleInputs.nth(1);
  await secondTitleInput.fill("Evening Glow Updated");

  // Click Save.
  const saveBtn = page.getByRole("button", { name: /save/i }).last();
  await expect(saveBtn).toBeEnabled({ timeout: 3_000 });
  await saveBtn.click();

  // After the PATCH completes (one success, one failure), photo 901's row must
  // have destructive border/background styling.
  // Photographer-detail.tsx adds `border-destructive/60 bg-destructive/5` on failure.
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll("[class*='border-destructive']");
      return rows.length > 0;
    },
    { timeout: 10_000 },
  );

  const failedRow = page.locator("[class*='border-destructive']").first();
  await expect(failedRow, "Expected at least one row with destructive border after PATCH failure").toBeVisible();
});
