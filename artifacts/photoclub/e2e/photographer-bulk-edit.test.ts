/**
 * Photographer bulk-edit panel — Playwright smoke tests
 *
 * Verifies that an admin can open the bulk-edit panel on a photographer detail
 * page, edit a photo title, save (fires PATCH), see the gallery refresh with
 * the new value, and cancel without saving.  Also confirms non-admins see no
 * edit button.
 *
 * API calls are fully intercepted so the test works without a running API server.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------
const PHOTOGRAPHER = {
  id: 10,
  name: "Alice",
  bio: "A passionate photographer.",
  avatarUrl: null,
  photoCount: 2,
  createdAt: "2022-03-15T00:00:00.000Z",
  themes: [{ id: 1, name: "Nature" }],
  clubs: [{ id: 1, name: "Test Club", memberSince: "2022-03" }],
};

const THEMES = [
  { id: 1, name: "Nature" },
  { id: 2, name: "Urban" },
];

const CLUBS_LIST = [
  { id: 1, name: "Test Club", memberCount: 2, photoCount: 2, createdAt: "2020-01-01T00:00:00.000Z" },
  { id: 2, name: "Other Club", memberCount: 0, photoCount: 0, createdAt: "2021-01-01T00:00:00.000Z" },
];

const PHOTOS_ORIGINAL = [
  {
    id: 201,
    title: "Original Title A",
    imageUrl: "https://placehold.co/400x500/png",
    themeId: 1,
    themeName: "Nature",
    clubId: 1,
    clubName: "Test Club",
    photographerId: 10,
    photographerName: "Alice",
    createdAt: "2024-01-01T00:00:00.000Z",
    sortOrder: 0,
  },
  {
    id: 202,
    title: "Original Title B",
    imageUrl: "https://placehold.co/400x500/png",
    themeId: null,
    themeName: null,
    clubId: 1,
    clubName: "Test Club",
    photographerId: 10,
    photographerName: "Alice",
    createdAt: "2024-01-02T00:00:00.000Z",
    sortOrder: 1,
  },
];

// ---------------------------------------------------------------------------
// API stub registration
// ---------------------------------------------------------------------------

/** Tracks PATCH requests made during a test. */
type PatchRecord = { id: number; body: Record<string, unknown> };

/**
 * Register all route stubs on the page.
 *
 * The photos GET stub is stateful: after a PATCH is received the updated data
 * is applied to the in-memory store so subsequent GET /api/photos requests
 * (triggered by queryClient.invalidateQueries after save) return the new titles.
 */
async function setupStubs(
  page: Page,
  patchLog: PatchRecord[],
  isAdmin: boolean = true,
) {
  // Mutable store for photos — updated on each PATCH so invalidation refreshes correctly.
  const photoStore = PHOTOS_ORIGINAL.map((p) => ({ ...p }));

  await page.route("**/api/**", async (route: Route) => {
    const req = route.request();
    const url = req.url();

    // Let Clerk auth initialise normally.
    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    const method = req.method();

    // Admin status
    if (/\/api\/admins\/me(\?|$)/.test(url) && method === "GET") {
      if (isAdmin) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isAdmin: true }) });
      } else {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
      }
      return;
    }

    // Single photographer — must come before the list route
    if (/\/api\/photographers\/10(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTOGRAPHER) });
      return;
    }

    // My photographer profile
    if (/\/api\/photographers\/me(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
      return;
    }

    // Photographers list
    if (/\/api\/photographers(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([PHOTOGRAPHER]) });
      return;
    }

    // Clubs list
    if (/\/api\/clubs(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CLUBS_LIST) });
      return;
    }

    // Themes list
    if (/\/api\/themes(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(THEMES) });
      return;
    }

    // Theme proposals
    if (/\/api\/themes\/my-proposals(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }

    // Photos list — returns the current (possibly updated) store
    if (/\/api\/photos(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([...photoStore]) });
      return;
    }

    // PATCH /api/photos/:id — update store and record
    const patchMatch = url.match(/\/api\/photos\/(\d+)(\?|$)/);
    if (patchMatch && method === "PATCH") {
      const photoId = Number(patchMatch[1]);
      const body = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
      patchLog.push({ id: photoId, body });
      // Apply update to in-memory store so GET after invalidation reflects the change.
      const idx = photoStore.findIndex((p) => p.id === photoId);
      if (idx !== -1) {
        photoStore[idx] = { ...photoStore[idx], ...body };
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(photoStore[idx] ?? body) });
      return;
    }

    // Stats
    if (/\/api\/stats(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photographs: 2, clubs: 1, photographers: 1, themes: 2 }),
      });
      return;
    }

    // Fallback
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (stub)" }) });
  });
}

// ---------------------------------------------------------------------------
// Helper: navigate to photographer detail page
// ---------------------------------------------------------------------------
async function visitPhotographerDetail(page: Page) {
  await page.goto("/photographers/10", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

/** Assert that no title-input (edit panel) is visible. Uses first() to stay strict-mode safe. */
async function assertEditPanelClosed(page: Page) {
  // Count-based assertion avoids strict-mode multi-element issues.
  await expect(page.getByPlaceholder(/title/i)).toHaveCount(0, { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("Edit photos button is visible for admin", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches, /* isAdmin */ true);
  await visitPhotographerDetail(page);

  await expect(page.getByRole("button", { name: /edit photos/i })).toBeVisible();
});

test("Edit photos button is hidden for non-admin", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches, /* isAdmin */ false);
  await visitPhotographerDetail(page);

  // No "Edit photos" button should exist in the DOM for a regular visitor.
  await expect(page.getByRole("button", { name: /edit photos/i })).toHaveCount(0);
});

test("Edit photos button toggles into bulk-edit mode", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  await page.getByRole("button", { name: /edit photos/i }).click();

  // Title inputs for both photos should appear.
  await expect(page.getByPlaceholder(/title/i).first()).toBeVisible();
  await expect(page.getByPlaceholder(/title/i)).toHaveCount(2);

  // Save button should be present.
  await expect(page.getByRole("button", { name: /no changes|save/i })).toBeVisible();
});

test("Cancel exits edit mode without sending a PATCH", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  // Enter edit mode and modify a title.
  await page.getByRole("button", { name: /edit photos/i }).click();
  await page.getByPlaceholder(/title/i).first().fill("Changed Title");

  // Cancel — must close the panel without saving.
  await page.getByRole("button", { name: /cancel/i }).click();

  await assertEditPanelClosed(page);
  expect(patches).toHaveLength(0);

  // Gallery should still show original titles.
  await expect(page.getByText("Original Title A")).toBeVisible();
});

test("Changing a title and saving fires PATCH and the gallery refreshes with the new value", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Update the first photo's title.
  await page.getByPlaceholder(/title/i).first().fill("Updated Title A");

  // Save button should indicate 1 pending change.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  // Panel closes after save.
  await assertEditPanelClosed(page);

  // PATCH was fired for photo 201.
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(201);
  expect(patches[0].body.title).toBe("Updated Title A");

  // Gallery should refresh and show the updated title.
  await expect(page.getByText("Updated Title A")).toBeVisible({ timeout: 10_000 });
});

test("Saving multiple dirty photos fires a PATCH for each and gallery refreshes", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Update both title inputs.
  const inputs = page.getByPlaceholder(/title/i);
  await inputs.nth(0).fill("New Title A");
  await inputs.nth(1).fill("New Title B");

  // Save.
  await page.getByRole("button", { name: /save.*2|2.*change/i }).click();

  // Panel closes.
  await assertEditPanelClosed(page);

  // Two PATCHes should have been fired.
  expect(patches).toHaveLength(2);
  const ids = patches.map((p) => p.id).sort((a, b) => a - b);
  expect(ids).toEqual([201, 202]);

  // Gallery shows both updated titles.
  await expect(page.getByText("New Title A")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("New Title B")).toBeVisible({ timeout: 10_000 });
});

test("No-change save closes edit mode without firing PATCH", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  // Enter edit mode without making changes.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Click the "no changes" save button.
  await page.getByRole("button", { name: /no changes/i }).click();

  // Panel closes immediately.
  await assertEditPanelClosed(page);
  expect(patches).toHaveLength(0);
});

test("Changing the theme select fires PATCH with the correct themeId", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // The bulk-edit rows render two selects per photo (theme, club), alternating.
  // Index 0 = photo 201 theme select (currently "Nature"/id:1).
  const themeSelect = page.getByRole("combobox").nth(0);
  await themeSelect.click();

  // Pick "Urban" (id:2) from the open dropdown.
  await page.getByRole("option", { name: /urban/i }).click();

  // Save button should reflect 1 dirty photo.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  // Panel closes after save.
  await assertEditPanelClosed(page);

  // PATCH for photo 201 must carry themeId: 2.
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(201);
  expect(patches[0].body.themeId).toBe(2);
});

test("Changing the club select fires PATCH with the correct clubId", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Index 1 = photo 201 club select (currently "Test Club"/id:1).
  const clubSelect = page.getByRole("combobox").nth(1);
  await clubSelect.click();

  // Pick "Other Club" (id:2) from the open dropdown.
  await page.getByRole("option", { name: /other club/i }).click();

  // Save.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  // Panel closes.
  await assertEditPanelClosed(page);

  // PATCH for photo 201 must carry clubId: 2.
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(201);
  expect(patches[0].body.clubId).toBe(2);
});

test("Resetting a select to none sends null in the PATCH body", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Photo 201 starts with clubId:1 ("Test Club"). Reset it to none.
  // Index 1 = photo 201 club select.
  const clubSelect = page.getByRole("combobox").nth(1);
  await clubSelect.click();

  // Pick the "no club" sentinel option.
  await page.getByRole("option", { name: /no club/i }).click();

  // Save.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  // Panel closes.
  await assertEditPanelClosed(page);

  // PATCH must carry clubId: null (not "none").
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(201);
  expect(patches[0].body.clubId).toBeNull();
});

test("Changing title AND theme for the same photo fires exactly one PATCH with both fields", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Change the title of photo 201.
  await page.getByPlaceholder(/title/i).first().fill("Combined Edit Title");

  // Change the theme of photo 201 from "Nature" to "Urban".
  // Index 0 = photo 201 theme select.
  const themeSelect = page.getByRole("combobox").nth(0);
  await themeSelect.click();
  await page.getByRole("option", { name: /urban/i }).click();

  // Save button should reflect exactly 1 dirty photo.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  // Panel closes after save.
  await assertEditPanelClosed(page);

  // Exactly one PATCH must have been fired (not one per field).
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(201);
  // Both updated fields must be present in the single PATCH body.
  expect(patches[0].body.title).toBe("Combined Edit Title");
  expect(patches[0].body.themeId).toBe(2);
});

test("Changing title AND club for the same photo fires exactly one PATCH with both fields", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitPhotographerDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Change the title of photo 201.
  await page.getByPlaceholder(/title/i).first().fill("Title And Club Edit");

  // Change the club of photo 201 from "Test Club" to "Other Club".
  // Index 1 = photo 201 club select.
  const clubSelect = page.getByRole("combobox").nth(1);
  await clubSelect.click();
  await page.getByRole("option", { name: /other club/i }).click();

  // Save button should reflect exactly 1 dirty photo.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  // Panel closes after save.
  await assertEditPanelClosed(page);

  // Exactly one PATCH must have been fired (not one per field).
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(201);
  // Both updated fields must be present in the single PATCH body.
  expect(patches[0].body.title).toBe("Title And Club Edit");
  expect(patches[0].body.clubId).toBe(2);
});
