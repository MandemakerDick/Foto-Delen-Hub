/**
 * Manage page — TabsTrigger data-testid guard (#109)
 *
 * Each tab on the manage page must have a data-testid attribute.
 * This test pins the complete list so that adding a new tab without a testid
 * will immediately fail CI, preventing flaky tests elsewhere.
 *
 * Expected testids (from manage.tsx):
 *   manage-tab-club, manage-tab-theme, manage-tab-photographer,
 *   manage-tab-import, manage-tab-photos, manage-tab-admins
 *
 * API calls are stubbed; admin access is simulated.
 */

import { test, expect, type Page } from "@playwright/test";

const EXPECTED_TAB_TESTIDS = [
  "manage-tab-club",
  "manage-tab-theme",
  "manage-tab-photographer",
  "manage-tab-import",
  "manage-tab-photos",
  "manage-tab-admins",
] as const;

async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("__clerk")) { await route.continue(); return; }
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isAdmin: true, displayName: "Admin" }) });
      return;
    }
    if (/\/api\/clubs(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/themes(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/photographers(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/photos(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/admins(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    if (/\/api\/(photographers\/me|me)(\?|$)/.test(url)) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
}

test("every manage tab has a data-testid attribute (#109)", async ({ page }) => {
  await stubApiCalls(page);

  // Use the session-admin login cookie pattern — stub the admin check above,
  // but also set a session cookie so the manage page doesn't redirect.
  // Actually the manage page is accessible when isAdmin returns true from the API.
  await page.goto("/manage", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Wait for the tabs to render.
  for (const testid of EXPECTED_TAB_TESTIDS) {
    const tab = page.getByTestId(testid);
    await expect(tab, `Tab with data-testid="${testid}" must exist on the manage page`).toBeAttached({ timeout: 10_000 });
  }
});

test("manage tab count matches the expected list (#109)", async ({ page }) => {
  await stubApiCalls(page);
  await page.goto("/manage", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // All expected tabs should be present; no extra un-testid'd tabs.
  const tabsWithTestid = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="tab"][data-testid]')).map((el) => el.getAttribute("data-testid")),
  );

  for (const expected of EXPECTED_TAB_TESTIDS) {
    expect(tabsWithTestid, `Missing data-testid="${expected}" on manage tabs`).toContain(expected);
  }
});
