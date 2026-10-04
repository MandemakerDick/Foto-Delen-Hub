/**
 * Gallery filter bar overflow — mobile viewport smoke test
 *
 * Regression guard for the fix that changed filter selects from a fixed
 * `w-[160px]` to `flex-1 min-w-[130px]` so they don't push past the screen
 * edge on small devices.
 *
 * The test loads the gallery page at a typical iPhone viewport (390 × 844),
 * then measures the filter bar container: if `scrollWidth > clientWidth` the
 * bar overflows horizontally and the test fails.
 *
 * API calls are stubbed with empty-but-valid responses so the page renders
 * fully without a running API server.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// API stubs (mirrors the stubs used in dutch-i18n-smoke.test.ts)
// ---------------------------------------------------------------------------
async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    const stubs: { pattern: RegExp; status: number; body: unknown }[] = [
      { pattern: /\/api\/clubs(\?|$)/, status: 200, body: [] },
      { pattern: /\/api\/themes(\?|$)/, status: 200, body: [] },
      { pattern: /\/api\/photographers(\?|$)/, status: 200, body: [] },
      { pattern: /\/api\/photos\/recent(\?|$)/, status: 200, body: [] },
      { pattern: /\/api\/photos\/gallery(\?|$)/, status: 200, body: { items: [], total: 0, nextCursor: null, hasMore: false } },
      { pattern: /\/api\/photos(\?|$)/, status: 200, body: [] },
      {
        pattern: /\/api\/stats(\?|$)/,
        status: 200,
        body: { photographs: 0, clubs: 0, photographers: 0, themes: 0 },
      },
      { pattern: /\/api\/admins\/me(\?|$)/, status: 401, body: { error: "Not authenticated" } },
      { pattern: /\/api\/photographers\/me(\?|$)/, status: 404, body: { error: "Not found" } },
      { pattern: /\/api\/themes\/my-proposals(\?|$)/, status: 200, body: [] },
    ];

    const stub = stubs.find((s) => s.pattern.test(url));
    if (stub) {
      await route.fulfill({
        status: stub.status,
        contentType: "application/json",
        body: JSON.stringify(stub.body),
      });
      return;
    }

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
test("gallery filter bar does not overflow horizontally on mobile (390 × 844)", async ({
  browser,
}) => {
  // Create a mobile-sized context — 390 × 844 mimics a typical iPhone viewport.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await stubApiCalls(page);
  await page.goto("/photos", { waitUntil: "networkidle" });

  // Dismiss any Vite/Replit runtime-error overlay.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Locate the filter bar by its testid.
  const filterBar = page.getByTestId("gallery-filter-bar");
  await expect(filterBar).toBeVisible();

  // Measure overflow: scrollWidth > clientWidth means the bar scrolls horizontally.
  const overflows = await filterBar.evaluate((el: Element) => {
    const { scrollWidth, clientWidth } = el as HTMLElement;
    return { scrollWidth, clientWidth, overflows: scrollWidth > clientWidth };
  });

  expect(
    overflows.overflows,
    `Filter bar overflows on mobile: scrollWidth (${overflows.scrollWidth}px) > clientWidth (${overflows.clientWidth}px)`
  ).toBe(false);

  await context.close();
});

test("gallery search input does not extend past the viewport width on mobile (390 × 844) (#113)", async ({
  browser,
}) => {
  // Specifically guard the text search <Input> element: a fixed-width or
  // unconstrained input can push past the right edge of the screen even when
  // the surrounding filter bar container itself does not overflow.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await stubApiCalls(page);
  await page.goto("/photos", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const filterBar = page.getByTestId("gallery-filter-bar");
  await expect(filterBar).toBeVisible();

  // Search lives above the filter bar; its first input is a date filter.
  const searchInput = page.locator("form input").first();
  await expect(searchInput, "Expected the Gallery text search input").toBeVisible();
  await expect(searchInput).not.toHaveAttribute("type", "date");

  // Measure the rendered bounding box of the input element.
  const inputBox = await searchInput.boundingBox();
  expect(inputBox, "Could not measure the search input bounding box").not.toBeNull();

  // The right edge of the input must not exceed the 390 px viewport width.
  const rightEdge = inputBox!.x + inputBox!.width;
  expect(
    rightEdge,
    `Search input right edge (${rightEdge.toFixed(1)}px) extends past the 390px viewport — input is off-screen`,
  ).toBeLessThanOrEqual(390);

  await context.close();
});

test("gallery date filters fit the Samsung Fold cover viewport (360 × 800)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
  });
  const page = await context.newPage();

  await stubApiCalls(page);
  await page.goto("/photos", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const dateTo = page.getByTestId("gallery-date-to");
  await expect(dateTo).toBeVisible();

  const { clientWidth, scrollWidth, dateToRight } = await page.evaluate(() => {
    const dateToInput = document.querySelector("[data-testid='gallery-date-to']");
    const dateToRect = dateToInput?.getBoundingClientRect();
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      dateToRight: dateToRect?.right ?? 0,
    };
  });

  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  expect(dateToRight).toBeLessThanOrEqual(clientWidth);

  await context.close();
});
