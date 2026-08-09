/**
 * Club bulk-edit panel — Playwright smoke tests
 *
 * Verifies that an admin can open the bulk-edit panel on a club detail page,
 * edit a photo title, save (fires PATCH), see the gallery refresh with the new
 * value, and cancel without saving.  Also confirms non-admins see no edit button.
 *
 * API calls are fully intercepted so the test works without a running API server.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------
const CLUB = {
  id: 1,
  name: "Test Club",
  description: "A club for testing",
  location: "Utrecht",
  websiteUrl: null,
  logoUrl: null,
  yearEstablished: 2020,
  createdAt: "2020-01-01T00:00:00.000Z",
  memberCount: 2,
  photoCount: 2,
};

const THEMES = [
  { id: 1, name: "Nature" },
  { id: 2, name: "Urban" },
];

const CLUBS_LIST = [
  CLUB,
  { id: 2, name: "Other Club", memberCount: 0, photoCount: 0, createdAt: "2021-01-01T00:00:00.000Z" },
];

const PHOTOS_ORIGINAL = [
  {
    id: 101,
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
    id: 102,
    title: "Original Title B",
    imageUrl: "https://placehold.co/400x500/png",
    themeId: null,
    themeName: null,
    clubId: 1,
    clubName: "Test Club",
    photographerId: 11,
    photographerName: "Bob",
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

    // Single club
    if (/\/api\/clubs\/1(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CLUB) });
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

    // Photos list — returns the current (possibly updated) store
    if (/\/api\/photos(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([...photoStore]) });
      return;
    }

    // Photographers list
    if (/\/api\/photographers(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }

    // My photographer profile
    if (/\/api\/photographers\/me(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
      return;
    }

    // Theme proposals
    if (/\/api\/themes\/my-proposals(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
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
        body: JSON.stringify({ photographs: 2, clubs: 1, photographers: 2, themes: 2 }),
      });
      return;
    }

    // Fallback
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (stub)" }) });
  });
}

// ---------------------------------------------------------------------------
// Helper: navigate to club detail page
// ---------------------------------------------------------------------------
async function visitClubDetail(page: Page) {
  await page.goto("/clubs/1", { waitUntil: "networkidle" });
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
  await visitClubDetail(page);

  await expect(page.getByRole("button", { name: /edit photos/i })).toBeVisible();
});

test("Edit photos button is hidden for non-admin", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches, /* isAdmin */ false);
  await visitClubDetail(page);

  // No "Edit photos" button should exist in the DOM for a regular visitor.
  await expect(page.getByRole("button", { name: /edit photos/i })).toHaveCount(0);
});

test("Edit photos button toggles into bulk-edit mode", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

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
  await visitClubDetail(page);

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
  await visitClubDetail(page);

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

  // PATCH was fired for photo 101.
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(101);
  expect(patches[0].body.title).toBe("Updated Title A");

  // Gallery should refresh and show the updated title.
  await expect(page.getByText("Updated Title A")).toBeVisible({ timeout: 10_000 });
});

test("Saving multiple dirty photos fires a PATCH for each and gallery refreshes", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

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
  expect(ids).toEqual([101, 102]);

  // Gallery shows both updated titles.
  await expect(page.getByText("New Title A")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("New Title B")).toBeVisible({ timeout: 10_000 });
});

test("No-change save closes edit mode without firing PATCH", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

  // Enter edit mode without making changes.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Click the "no changes" save button.
  await page.getByRole("button", { name: /no changes/i }).click();

  // Panel closes immediately.
  await assertEditPanelClosed(page);
  expect(patches).toHaveLength(0);
});

test("Changing the theme dropdown and saving fires PATCH with the correct themeId", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // In edit mode the comboboxes are ordered: nth(0)=photo-101 theme, nth(1)=photo-101 club,
  // nth(2)=photo-102 theme, nth(3)=photo-102 club.
  // Photo 101 starts with themeId=1 (Nature). Change it to Urban (id=2).
  await page.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: "Urban" }).click();

  // Save button should indicate 1 pending change.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  // Panel closes after save.
  await assertEditPanelClosed(page);

  // PATCH was fired for photo 101 with the new themeId.
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(101);
  expect(patches[0].body.themeId).toBe(2);
});

test("Clearing the theme dropdown sends null in the PATCH body", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Photo 101 starts with themeId=1 (Nature). Clear it by selecting "No theme".
  // nth(0) is the theme combobox for photo 101.
  await page.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: "No theme" }).click();

  // Save.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  await assertEditPanelClosed(page);

  // PATCH should carry themeId: null.
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(101);
  expect(patches[0].body.themeId).toBeNull();
});

test("Changing the club dropdown and saving fires PATCH with the correct clubId", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Photo 101 starts with clubId=1 (Test Club). Change it to Other Club (id=2).
  // nth(1) is the club combobox for photo 101 (after its theme combobox at nth(0)).
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Other Club" }).click();

  // Save button should indicate 1 pending change.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  // Panel closes after save.
  await assertEditPanelClosed(page);

  // PATCH was fired for photo 101 with the new clubId.
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(101);
  expect(patches[0].body.clubId).toBe(2);
});

test("Clearing the club dropdown sends null in the PATCH body", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Photo 101 starts with clubId=1 (Test Club). Clear it by selecting "No club".
  // nth(1) is the club combobox for photo 101.
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "No club" }).click();

  // Save.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  await assertEditPanelClosed(page);

  // PATCH should carry clubId: null.
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(101);
  expect(patches[0].body.clubId).toBeNull();
});

test("Clearing a photo title triggers the amber warning row and keeps Save enabled", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Clear the first photo's title.
  const firstInput = page.getByPlaceholder(/title/i).first();
  await firstInput.clear();

  // The row wrapping the first photo should now carry the amber border class.
  // Each bulk-edit row is a flex div with rounded-md; the first one belongs to photo 101.
  const firstRow = page.locator("div.flex.items-start.gap-2.rounded-md").nth(0);
  await expect(firstRow).toHaveClass(/border-amber-400/);

  // The title input itself should also reflect the amber styling.
  await expect(firstInput).toHaveClass(/border-amber-400/);

  // The Save button must still be enabled — blank title is a warning, not a hard block.
  // Clearing the title makes the photo dirty, so the button reads "save 1 change".
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeVisible();
  await expect(saveBtn).toBeEnabled();
});

test("Filling in a blank title removes the amber warning from the row", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  const firstInput = page.getByPlaceholder(/title/i).first();
  const firstRow = page.locator("div.flex.items-start.gap-2.rounded-md").nth(0);

  // Clear the title — amber warning should appear.
  await firstInput.clear();
  await expect(firstRow).toHaveClass(/border-amber-400/);

  // Fill in a valid title — amber warning should disappear.
  await firstInput.fill("A real title");
  await expect(firstRow).not.toHaveClass(/border-amber-400/);

  // Input itself should also lose the amber styling.
  await expect(firstInput).not.toHaveClass(/border-amber-400/);
});

test("Saving with a blank title does not send the title field in the PATCH body", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);
  await visitClubDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Clear the first photo's title (makes it dirty with a blank value).
  const firstInput = page.getByPlaceholder(/title/i).first();
  await firstInput.clear();

  // Save — the amber-warned photo is still dirty so the button is enabled.
  const saveBtn = page.getByRole("button", { name: /save.*1|1.*change/i });
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();

  // Panel closes — the save went through.
  await assertEditPanelClosed(page);

  // One PATCH was fired for photo 101.
  expect(patches).toHaveLength(1);
  expect(patches[0].id).toBe(101);

  // The `title` field must NOT be present in the PATCH body (blank title is
  // omitted so the server keeps the existing value).
  expect(patches[0].body).not.toHaveProperty("title");
});

test("Failed PATCH keeps the bulk-edit panel open, shows an error toast, and preserves edited values", async ({ page }) => {
  const patches: PatchRecord[] = [];
  await setupStubs(page, patches);

  // Register a PATCH override AFTER setupStubs so it takes precedence (Playwright
  // matches routes in reverse-registration order — last registered wins).
  await page.route("**/api/photos/**", async (route: Route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
      return;
    }
    await route.continue();
  });

  await visitClubDetail(page);

  // Enter edit mode.
  await page.getByRole("button", { name: /edit photos/i }).click();

  // Modify the first photo's title.
  const firstInput = page.getByPlaceholder(/title/i).first();
  await firstInput.fill("Changed Title");

  // Attempt to save — should fire the PATCH and get a 500.
  await page.getByRole("button", { name: /save.*1|1.*change/i }).click();

  // Panel must remain open — title inputs are still present.
  await expect(firstInput).toBeVisible({ timeout: 10_000 });

  // The changed value must still be displayed in the input (no state loss).
  await expect(firstInput).toHaveValue("Changed Title");

  // An error toast must be visible ("Could not save all changes." per en.json).
  // Use .first() because the text can appear in both the visible toast element
  // and a hidden ARIA live-region — at least one must be visible.
  await expect(
    page.getByText(/could not save all changes/i).first(),
  ).toBeVisible({ timeout: 5_000 });
});
