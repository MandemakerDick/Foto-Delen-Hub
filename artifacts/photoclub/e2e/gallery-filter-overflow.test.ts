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
