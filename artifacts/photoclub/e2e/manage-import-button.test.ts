/**
 * Playwright E2E — Import tab: Import button enabled at step 3
 *
 * Three historical bugs all caused the Import button to stay disabled when an
 * admin arrived at step 3 without any extra interaction:
 *
 *   1. Club falsely required  — club is optional; clubId "none" must not block.
 *   2. Photographer name wiped after scan — the name set by the scan result
 *      must still be present when step 3 renders.
 *   3. Undefined `idx` in title map — the per-photo edits array is indexed by
 *      position in the *filtered* selection, which must match the filtered
 *      render loop; any off-by-one leaves importPhotoEdits[idx] undefined,
 *      which produces an empty title that triggers the warning guard.
 *
 * This test stubs POST /api/admins/import-from-url/scan to return a small
 * fixture that includes a photographerName and one image with a meaningful
 * (non-file-slug) alt text.  It walks through the three-step import flow and
 * asserts that the Import button in step 3 is enabled without any extra
 * interaction from the user.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture — minimal UrlScanResult that satisfies the manage page
// ---------------------------------------------------------------------------

const SCAN_FIXTURE = {
  url: "https://example.com/portfolio",
  photographerName: "Alice Smith",
  bio: "Landscape photographer based in Amsterdam.",
  images: [
    {
      src: "https://example.com/photo1.jpg",
      alt: "Sunset at the dunes",
      width: 1200,
      height: 800,
    },
  ],
};

// ---------------------------------------------------------------------------
// Admin identity stub — signed-in admin, same shape as AdminStatusResponse
// ---------------------------------------------------------------------------

const ADMIN_STATUS = {
  isAdmin: true,
  totalAdmins: 1,
  displayName: "Test Admin",
  photographerId: null,
};

const ADMIN_LIST = [
  {
    id: 1,
    clerkUserId: null,
    displayName: "Test Admin",
    email: "admin@example.com",
    isOwner: true,
    hasPassword: true,
    addedAt: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Route stubs
// ---------------------------------------------------------------------------

async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Let Clerk handle its own auth initialisation.
    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    // ── Scan endpoint (POST) ────────────────────────────────────────────────
    // This is the key stub: return a fixture with photographerName so the
    // Import button guard for "new photographer with empty name" is satisfied.
    if (
      /\/api\/admins\/import-from-url\/scan(\?|$)/.test(url) &&
      method === "POST"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SCAN_FIXTURE),
      });
      return;
    }

    // ── Image proxy ─────────────────────────────────────────────────────────
    // The manage page loads thumbnails via /api/admins/import-from-url/proxy.
    // Return a transparent 1×1 pixel GIF so the <img> elements resolve without
    // real network traffic.
    if (/\/api\/admins\/import-from-url\/proxy(\?|$)/.test(url)) {
      const gif1x1 =
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      const buf = Buffer.from(gif1x1, "base64");
      await route.fulfill({
        status: 200,
        contentType: "image/gif",
        body: buf,
      });
      return;
    }

    // ── Auth / admin identity ───────────────────────────────────────────────
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ADMIN_STATUS),
      });
      return;
    }
    if (/\/api\/admins(\?|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ADMIN_LIST),
      });
      return;
    }

    // ── Regular list endpoints ──────────────────────────────────────────────
    if (
      /\/api\/(clubs|themes|photographers|photos)(\/|(\?|$))/.test(url) ||
      /\/api\/stats(\?|$)/.test(url) ||
      /\/api\/invites(\?|$)/.test(url) ||
      /\/api\/themes\/proposals(\?|$)/.test(url) ||
      /\/api\/themes\/my-proposals(\?|$)/.test(url)
    ) {
      const body =
        /\/api\/stats(\?|$)/.test(url)
          ? { photographs: 0, clubs: 0, photographers: 0, themes: 0 }
          : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      return;
    }

    // Photographer profile for the current user — not linked.
    if (/\/api\/photographers\/me(\?|$)/.test(url)) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not found" }),
      });
      return;
    }

    // Unknown endpoint — structured 404.
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

test(
  "Import step 3 — Import button is enabled after a scan that returns a photographerName",
  async ({ page }) => {
    // Set language to English so button labels match English text.
    await page.addInitScript(() => {
      localStorage.setItem("photoclub.lang", "en");
    });

    await stubApiCalls(page);

    // Navigate to /manage as a signed-in admin.
    await page.goto("/manage", { waitUntil: "networkidle" });

    // Dismiss any stray Vite / Replit error overlay.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // ── Step 1: open the Import tab and submit a URL ──────────────────────
    const importTab = page.getByTestId("manage-tab-import");
    await importTab.waitFor({ state: "visible", timeout: 10_000 });
    await importTab.click();
    await page.waitForTimeout(300);

    // Fill in a URL.
    const urlInput = page.getByPlaceholder(
      "https://photographer-portfolio.com"
    );
    await urlInput.waitFor({ state: "visible", timeout: 5_000 });
    await urlInput.fill("https://example.com/portfolio");

    // Click "Scan for Photos" to trigger the stubbed POST request.
    const scanBtn = page.getByRole("button", { name: /Scan for Photos/ });
    await scanBtn.click();

    // ── Step 2: image selection ───────────────────────────────────────────
    // Wait for the "Select Photos" heading that appears in step 2.
    await page
      .getByRole("heading", { name: "Select Photos" })
      .waitFor({ state: "visible", timeout: 10_000 });

    // The single fixture image should be pre-selected (all selected by
    // default after scan).  Click "Next" to proceed to step 3.
    const nextBtn = page.getByRole("button", { name: /Next: Assign/ });
    await nextBtn.waitFor({ state: "visible", timeout: 5_000 });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // ── Step 3: assert the Import button is enabled ───────────────────────
    // Wait for the "Assign & Import" heading that appears in step 3.
    await page
      .getByRole("heading", { name: "Assign & Import" })
      .waitFor({ state: "visible", timeout: 10_000 });

    // The Import button must be enabled without any additional interaction:
    //   • photographerName pre-filled from scan → photographer guard is clear
    //   • clubId defaults to "none" (optional) → club guard is clear
    //   • photo title is "Sunset at the dunes" (not a file slug) → title guard
    //     is clear and no warning acknowledgement is needed
    const importBtn = page.getByRole("button", { name: /Import 1 photos/ });
    await importBtn.waitFor({ state: "visible", timeout: 10_000 });
    await expect(importBtn).toBeEnabled();
  }
);
