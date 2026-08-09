/**
 * Dutch i18n Playwright smoke test — PhotographersHub /admin-login page
 *
 * The public-page smoke tests (dutch-i18n-smoke.test.ts) skip /admin-login
 * because it uses its own `adminLogin.*` namespace keys.  This file fills that
 * gap: it visits /admin-login with Dutch set in localStorage and asserts that
 * no raw i18next translation keys appear in the rendered text.
 *
 * A raw key looks like a dotted namespace path, e.g. "adminLogin.heading",
 * "adminLogin.signInBtn".  If a component references a translation key via a
 * dynamic expression the static JSON tests would never catch it, but it would
 * appear verbatim in the rendered DOM.
 *
 * Language is set via localStorage ("photoclub.lang" = "nl") before the page
 * loads — matching the detection order configured in src/i18n/config.ts.
 *
 * The /admin-login page does not require authentication, so no auth stubs are
 * needed.  API stubs are still registered to silence background requests that
 * React Query may fire during mount.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Known i18next top-level namespaces (mirrors dutch-i18n-smoke.test.ts).
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
 * Regex that matches a raw i18next key: a known namespace prefix followed by
 * a dot and at least one identifier character.  Word-boundary anchors prevent
 * false positives inside longer strings (URLs, version numbers, emails).
 */
const RAW_KEY_RE = new RegExp(
  `\\b(${NAMESPACES.join("|")})\\.[a-zA-Z_][a-zA-Z0-9_.]*`,
  "g"
);

// ---------------------------------------------------------------------------
// API stubs — silence any background requests without blocking page render.
// ---------------------------------------------------------------------------
type ApiStub = { urlPattern: RegExp; status: number; body: unknown };

const API_STUBS: ApiStub[] = [
  { urlPattern: /\/api\/admins\/me(\?|$)/, status: 401, body: { error: "Not authenticated" } },
  { urlPattern: /\/api\/clubs(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/themes(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/photographers(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/photos\/recent(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/photos(\?|$)/, status: 200, body: [] },
  {
    urlPattern: /\/api\/stats(\?|$)/,
    status: 200,
    body: { photographs: 0, clubs: 0, photographers: 0, themes: 0 },
  },
  { urlPattern: /\/api\/photographers\/me(\?|$)/, status: 404, body: { error: "Not found" } },
  { urlPattern: /\/api\/themes\/my-proposals(\?|$)/, status: 200, body: [] },
];

/** Register all API stubs. Clerk requests are passed through unchanged. */
async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    // Let Clerk handle its own auth initialisation.
    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    const stub = API_STUBS.find((s) => s.urlPattern.test(url));
    if (stub) {
      await route.fulfill({
        status: stub.status,
        contentType: "application/json",
        body: JSON.stringify(stub.body),
      });
      return;
    }

    // Unknown endpoint — return a structured 404 rather than an HTML page.
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found (test stub)" }),
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set Dutch in localStorage, register API stubs, then navigate to /admin-login
 * and wait for React to settle.
 */
async function visitAdminLoginInDutch(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("photoclub.lang", "nl");
  });

  await stubApiCalls(page);

  await page.goto("/admin/login", { waitUntil: "networkidle" });

  // Dismiss any stray Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

/** Extract visible body text, excluding <script> and <style> nodes. */
async function getPageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script, style").forEach((el) => el.remove());
    return clone.textContent ?? "";
  });
}

/** Assert that no raw i18next keys are visible in the current page text. */
async function assertNoRawKeys(page: Page, pageLabel: string) {
  const bodyText = await getPageText(page);

  // Guard against vacuous passes: the page must have rendered real content.
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
// Tests
// ---------------------------------------------------------------------------

test("Admin login page shows no raw i18next keys in Dutch", async ({ page }) => {
  await visitAdminLoginInDutch(page);
  await assertNoRawKeys(page, "Admin login");
});

test("Admin login page: Dutch language is active (sanity check)", async ({ page }) => {
  await visitAdminLoginInDutch(page);
  const bodyText = await getPageText(page);
  // "Aanmelden" is the Dutch translation of "adminLogin.signInBtn".
  expect(bodyText, "Expected Dutch text 'Aanmelden' in the admin login page body").toMatch(
    /Aanmelden/
  );
});
