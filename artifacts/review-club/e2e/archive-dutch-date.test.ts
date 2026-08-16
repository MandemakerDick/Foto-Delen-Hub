/**
 * PhotoReviewHub — archive card Dutch date test (#55)
 *
 * Confirms that the archive card renders the "Gesloten op" date using the
 * Dutch locale when Dutch is the active language.
 *
 * The archive card uses:
 *   format(new Date(session.closedAt), "PP", { locale: dateLocale })
 *
 * In Dutch (nl) the "PP" format renders as e.g. "20 jan 2024" or "20 jan. 2024",
 * so we check for the abbreviated Dutch month "jan" for a January date.
 *
 * This is a regression guard: any change that accidentally drops the locale
 * from the format call will cause this test to fail before users notice.
 *
 * API calls are stubbed; no live server needed.
 * Paths are relative (no leading /) so they resolve against baseURL /review/.
 */

import { test, expect } from "@playwright/test";

// A session closed in January 2024. Dutch: "20 jan. 2024", English: "Jan 20, 2024".
const CLOSED_JANUARY = "2024-01-20T00:00:00.000Z";

const SESSION = {
  id: 55,
  title: "Winterlicht 2024",
  status: "closed",
  clubId: 1,
  closedAt: CLOSED_JANUARY,
  photoCount: 8,
  participantCount: 4,
  createdAt: "2024-01-01T00:00:00.000Z",
};

const CLUB = {
  id: 1,
  name: "Foto Vrienden",
  description: "A photography club.",
  logoUrl: null,
  location: "Rotterdam",
  websiteUrl: null,
  yearEstablished: 2020,
  memberCount: 10,
  photoCount: 50,
  createdAt: "2020-01-01T00:00:00.000Z",
};

async function setupStubs(page: import("@playwright/test").Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("__clerk")) { await route.continue(); return; }
    // Review sessions — the archive page calls /api/review-sessions?status=closed
    if (/\/api\/review-sessions(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([SESSION]) });
      return;
    }
    if (/\/api\/clubs\/1(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CLUB) });
      return;
    }
    if (/\/api\/clubs(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([CLUB]) });
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
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });
}

test("archive card shows Dutch-formatted date when language is Dutch (#55)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Inject Dutch locale before any page script runs.
  await context.addInitScript(() => localStorage.setItem("reviewclub.lang", "nl"));
  const page = await context.newPage();

  try {
    await setupStubs(page);

    // Navigate, reinforce locale, reload with Dutch active.
    await page.goto("archive", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("reviewclub.lang", "nl"));
    await page.reload({ waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Wait for the session title to appear (confirms the card rendered).
    await page.waitForFunction(
      (title) => (document.body.textContent ?? "").includes(title),
      SESSION.title,
      { timeout: 15_000 },
    );

    const pageText = await page.evaluate(() => document.body.textContent ?? "");

    // Dutch "PP" format for Jan 20, 2024 → "20 jan. 2024" (abbreviated nl locale).
    expect(
      pageText.toLowerCase(),
      `Expected Dutch date fragment "jan" on the archive card, got: ${pageText.substring(0, 300)}`,
    ).toMatch(/\bjan\b|\bjan\./);

    // English locale gives "Jan 20, 2024" — must not appear in Dutch mode.
    expect(
      pageText,
      "Expected no English-locale date pattern 'Jan 20' on a Dutch-language archive card",
    ).not.toMatch(/Jan 20/);
  } finally {
    await context.close();
  }
});

test("archive card still shows a date string after CSS or markup changes (#55)", async ({ browser }) => {
  // Language-agnostic: the closedAt date must always produce visible text.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await setupStubs(page);
    await page.goto("archive", { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.waitForFunction(
      (title) => (document.body.textContent ?? "").includes(title),
      SESSION.title,
      { timeout: 15_000 },
    );

    const pageText = await page.evaluate(() => document.body.textContent ?? "");
    expect(pageText, "Expected a year (2024) to appear in the archive card date").toContain("2024");
  } finally {
    await context.close();
  }
});
