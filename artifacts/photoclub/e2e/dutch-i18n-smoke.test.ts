/**
 * Dutch i18n Playwright smoke tests — PhotographersHub
 *
 * These tests load each main page with Dutch as the active language and assert
 * that no raw i18next translation keys appear in the rendered page text.
 *
 * A raw key looks like a dotted namespace path, e.g. "nav.gallery",
 * "home.heroTitle1", "gallery.clearFilters".  If a component references a
 * translation key via a dynamic expression the static JSON tests would never
 * catch it, but it would appear verbatim in the rendered DOM.
 *
 * Language is set via localStorage ("photoclub.lang" = "nl") before each
 * page load — matching the detection order configured in src/i18n/config.ts.
 *
 * API calls are intercepted and stubbed with empty-but-valid responses so the
 * pages render fully even when the API server is not running.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Known i18next top-level namespaces in this app (from en.json keys).
// We build a targeted regex so we don't flag legitimate text that happens to
// contain a dot (e.g. URLs, version numbers, emails).
// ---------------------------------------------------------------------------
const NAMESPACES = [
  "nav",
  "common",
  "footer",
  "manage",
  "toasts",
  "home",
  "clubs",
  "themes",
  "photographers",
  "photographerDetail",
  "themeDetail",
  "clubDetail",
  "photoDetail",
  "gallery",
  "upload",
  "myPhotos",
  "search",
  "notFound",
  "languageSwitcher",
  "join",
  "adminLogin",
];

/**
 * Regex that matches a raw i18next key: one of the known namespace prefixes
 * followed by a dot and at least one word character, optionally followed by
 * further dot-separated segments.  Word boundary anchors prevent matching
 * inside longer words.
 *
 * Example matches: "nav.gallery", "home.recent.heading"
 * Example non-matches: "foo.bar", "connectingthedots.fit", "3.14"
 */
const RAW_KEY_RE = new RegExp(
  `\\b(${NAMESPACES.join("|")})\\.[a-zA-Z_][a-zA-Z0-9_.]*`,
  "g"
);

// ---------------------------------------------------------------------------
// Stub API responses
// Route patterns match relative API paths served by the dev server under /api.
// We return minimal valid responses so React Query does not receive unexpected
// types that would cause runtime errors.
// ---------------------------------------------------------------------------
type ApiStub = {
  urlPattern: RegExp;
  status: number;
  body: unknown;
};

const API_STUBS: ApiStub[] = [
  // List endpoints → empty arrays
  { urlPattern: /\/api\/clubs(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/themes(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/photographers(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/photos\/recent(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/photos(\?|$)/, status: 200, body: [] },
  // Stats endpoint
  {
    urlPattern: /\/api\/stats(\?|$)/,
    status: 200,
    body: { photographs: 0, clubs: 0, photographers: 0, themes: 0 },
  },
  // Auth / admin endpoints → 401 (not signed in is a normal state)
  { urlPattern: /\/api\/admins\/me(\?|$)/, status: 401, body: { error: "Not authenticated" } },
  // My photos / photographer profile endpoints
  { urlPattern: /\/api\/photographers\/me(\?|$)/, status: 404, body: { error: "Not found" } },
  // Theme proposals for the current user
  { urlPattern: /\/api\/themes\/my-proposals(\?|$)/, status: 200, body: [] },
];

/**
 * Register all API stubs on the page.  Clerk requests (__clerk/*) are
 * intentionally NOT stubbed so authentication initialises normally.
 */
async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    // Pass Clerk requests through — Clerk handles its own auth init.
    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    // Find a matching stub.
    const stub = API_STUBS.find((s) => s.urlPattern.test(url));
    if (stub) {
      await route.fulfill({
        status: stub.status,
        contentType: "application/json",
        body: JSON.stringify(stub.body),
      });
      return;
    }

    // Unknown API endpoint — return 404 so the page handles the error state
    // gracefully rather than receiving an HTML page that causes type errors.
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found (test stub)" }),
    });
  });
}

// ---------------------------------------------------------------------------
// Helper: set Dutch in localStorage, stub API calls, then navigate and wait
// for the React app to mount.
// ---------------------------------------------------------------------------
async function visitInDutch(page: Page, path: string) {
  // addInitScript runs before any page scripts — this guarantees the
  // LanguageDetector reads "nl" from localStorage on the very first render.
  await page.addInitScript(() => {
    localStorage.setItem("photoclub.lang", "nl");
  });

  // Stub API calls before navigation so they are active from the first request.
  await stubApiCalls(page);

  await page.goto(path, { waitUntil: "networkidle" });

  // Dismiss any remaining Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Helper: collect all page text (including content behind overlays) and
// check for raw i18next keys.
// <script> and <style> nodes are removed to avoid false positives from
// bundled code embedded in the page.
// ---------------------------------------------------------------------------
async function getPageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script, style").forEach((el) => el.remove());
    return clone.textContent ?? "";
  });
}

async function assertNoRawKeys(page: Page, pageLabel: string) {
  const bodyText = await getPageText(page);

  // Guard against vacuous passes: the page must have rendered some content.
  expect(
    bodyText.trim().length,
    `Page "${pageLabel}" produced empty body text — React may not have rendered`
  ).toBeGreaterThan(10);

  const hits = Array.from(bodyText.matchAll(RAW_KEY_RE)).map((m) => m[0]);
  const unique = [...new Set(hits)];

  expect(
    unique,
    `Page "${pageLabel}" shows raw i18next keys in Dutch:\n${unique.join("\n")}`
  ).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Pages to smoke-test.  Add new routes here whenever a new page is added.
// ---------------------------------------------------------------------------
const PAGES: { label: string; path: string }[] = [
  { label: "Home",          path: "/" },
  { label: "Gallery",       path: "/photos" },
  { label: "Themes",        path: "/themes" },
  { label: "Clubs",         path: "/clubs" },
  { label: "Photographers", path: "/photographers" },
  { label: "Upload",        path: "/upload" },
];

// ---------------------------------------------------------------------------
// Raw-key smoke tests — one per page.
// ---------------------------------------------------------------------------
for (const { label, path } of PAGES) {
  test(`${label} page shows no raw i18next keys in Dutch`, async ({ page }) => {
    await visitInDutch(page, path);
    await assertNoRawKeys(page, label);
  });
}

// ---------------------------------------------------------------------------
// Language-sanity checks: verify Dutch is active on each page by asserting
// "Galerij" (Dutch for "Gallery") appears in the DOM.
// The nav renders synchronously from i18n without API calls, so it's
// reliably present after hydration.
// ---------------------------------------------------------------------------
async function assertDutchNavPresent(page: Page) {
  const bodyText = await getPageText(page);
  expect(bodyText, "Expected Dutch nav text 'Galerij' in page body").toMatch(/Galerij/);
}

for (const { label, path } of PAGES) {
  test(`${label} page: Dutch language is active (sanity check)`, async ({ page }) => {
    await visitInDutch(page, path);
    await assertDutchNavPresent(page);
  });
}
