/**
 * Photo detail — Dutch date formatting test (#56)
 *
 * Confirms that dates displayed on the PhotographersHub use Dutch formatting
 * when the Dutch language is active. For example, a photo uploaded in January
 * 2024 should display "januari" not "January".
 *
 * The photo detail page uses format(date, "d MMMM yyyy", { locale: dateLocale })
 * where dateLocale comes from useDateLocale(). In Dutch (nl), January → "januari".
 *
 * Language switching: navigate to the page first, reinforce localStorage to
 * "nl", then reload so i18next picks up the new locale before rendering.
 *
 * API calls are stubbed so the test runs without a live server.
 */

import { test, expect } from "@playwright/test";

const PHOTO = {
  id: 551,
  title: "Dunes at Sunset",
  imageUrl: "https://placehold.co/400x500/png",
  description: null,
  themeId: null,
  themeName: null,
  clubId: null,
  clubName: null,
  photographerId: 55,
  photographerName: "Eva Dijkstra",
  photographerAvatarUrl: null,
  // January — Dutch: "januari"
  createdAt: "2024-01-20T00:00:00.000Z",
  sortOrder: 0,
  likeCount: 0,
  likesCount: 0,
};

const DUTCH_MONTH = "januari";
const ENGLISH_MONTH = "January";

function routeStubs(page: ReturnType<typeof import("@playwright/test")["test"]["info"]>): never;
function routeStubs(_: unknown) { throw new Error("use setupStubs"); }

async function setupStubs(page: import("@playwright/test").Page) {
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
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
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

test("photo dates show Dutch month names when language is Dutch (#56)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Inject locale via addInitScript (before any page script).
  await context.addInitScript(() => localStorage.setItem("photoclub.lang", "nl"));
  const page = await context.newPage();

  try {
    await setupStubs(page);

    // Navigate, reinforce the locale setting, reload with locale active.
    await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("photoclub.lang", "nl"));
    await page.reload({ waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.waitForFunction(
      (t) => (document.body.textContent ?? "").includes(t),
      PHOTO.title,
      { timeout: 15_000 },
    );

    const pageText = await page.evaluate(() => document.body.textContent ?? "");
    expect(
      pageText.toLowerCase(),
      `Expected Dutch month "${DUTCH_MONTH}" in the page, got: ${pageText.substring(0, 300)}`,
    ).toContain(DUTCH_MONTH);

    expect(
      pageText,
      `Expected no English month "${ENGLISH_MONTH}" on a Dutch-locale page`,
    ).not.toContain(ENGLISH_MONTH);
  } finally {
    await context.close();
  }
});

test("photo date is rendered with a year (locale-agnostic sanity check) (#56)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await setupStubs(page);
    await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.waitForFunction(
      (t) => (document.body.textContent ?? "").includes(t),
      PHOTO.title,
      { timeout: 15_000 },
    );

    const pageText = await page.evaluate(() => document.body.textContent ?? "");
    expect(pageText, "Expected the photo year (2024) to appear in the date display").toContain("2024");
  } finally {
    await context.close();
  }
});
