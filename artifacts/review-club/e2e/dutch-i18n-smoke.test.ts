/**
 * PhotoReviewHub — Dutch i18n smoke test (#51)
 *
 * Loads each main page with Dutch as the active language and asserts that no
 * raw i18next translation keys appear in the rendered page text.
 *
 * Language is set via addInitScript + page.evaluate + reload to guarantee
 * i18next picks up the locale before rendering.
 *
 * API calls are stubbed; no live server needed.
 * Paths are relative (no leading /) so they resolve against baseURL /review/.
 */

import { test, expect, type Page } from "@playwright/test";

const KNOWN_NAMESPACES = [
  "nav", "common", "footer", "home", "archive", "admin", "session",
  "results", "photoReview", "languageSwitcher", "notFound", "status",
  "review", "adminLogin", "adminCredentials",
];

const RAW_KEY_PATTERN = `\\b(${KNOWN_NAMESPACES.join("|")})\\.[a-zA-Z_][a-zA-Z0-9_.]*`;

async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("__clerk")) { await route.continue(); return; }
    // Home page might list active sessions — /api/review-sessions
    if (/\/api\/review-sessions(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/clubs(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
      return;
    }
    if (/\/api\/admins\/status(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isAdmin: false, totalAdmins: 1 }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (test stub)" }) });
  });
}

async function findRawKeys(page: Page, pattern: string): Promise<string[]> {
  return page.evaluate((pat) => {
    const re = new RegExp(pat, "g");
    const text = document.body.innerText ?? "";
    return Array.from(new Set(text.match(re) ?? []));
  }, pattern);
}

// Use relative paths — resolved against baseURL http://localhost:5184/review/.
// Absolute paths (starting with /) replace the base path and land on the wrong URL.
const PAGES = [
  { name: "Sessions (home)", path: "/" },
  { name: "Archive", path: "archive" },
];

for (const { name, path } of PAGES) {
  test(`${name} page shows no raw i18next keys in Dutch (#51)`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => localStorage.setItem("reviewclub.lang", "nl"));
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => localStorage.setItem("reviewclub.lang", "nl"));
      await page.reload({ waitUntil: "networkidle" });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      const rawKeys = await findRawKeys(page, RAW_KEY_PATTERN);
      expect(rawKeys, `Found raw i18next keys on Dutch "${name}" page: ${rawKeys.join(", ")}`).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  test(`${name} page: Dutch language is active (sanity check) (#51)`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => localStorage.setItem("reviewclub.lang", "nl"));
    const page = await context.newPage();

    try {
      await stubApiCalls(page);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => localStorage.setItem("reviewclub.lang", "nl"));
      await page.reload({ waitUntil: "networkidle" });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      const pageText = await page.evaluate(() => document.body.innerText ?? "");
      const hasDutchText =
        pageText.includes("Sessies") ||
        pageText.includes("Archief") ||
        pageText.includes("Inloggen") ||
        pageText.includes("Gesloten") ||
        pageText.includes("Geen");
      expect(hasDutchText, `Expected Dutch text on "${name}" page — got: ${pageText.substring(0, 200)}`).toBe(true);
    } finally {
      await context.close();
    }
  });
}
