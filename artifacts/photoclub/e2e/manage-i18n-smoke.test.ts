/**
 * Dutch i18n Playwright smoke test — PhotographersHub admin /manage page
 *
 * The public-page smoke tests (dutch-i18n-smoke.test.ts) skip /manage because
 * it requires authentication.  This file fills that gap: it stubs the auth
 * endpoints so the page renders as a signed-in admin, then asserts that no raw
 * i18next translation keys appear in the Dutch-locale render.
 *
 * A raw key looks like a dotted namespace path, e.g. "manage.tabs.club",
 * "manage.admins.heading".  If a component references a translation key via a
 * dynamic expression the static JSON tests would never catch it, but it would
 * appear verbatim in the rendered DOM.
 *
 * Language is set via localStorage ("photoclub.lang" = "nl") before the page
 * loads — matching the detection order configured in src/i18n/config.ts.
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
// Minimal stub data — valid shapes that satisfy the TypeScript types used by
// the manage page without triggering any runtime type errors.
// ---------------------------------------------------------------------------

/** AdminStatusResponse: signed-in admin with one admin in total. */
const ADMIN_STATUS = {
  isAdmin: true,
  totalAdmins: 1,
  displayName: "Test Admin",
  photographerId: null,
};

/** AdminUser list — a single admin entry. */
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

/** ThemeProposal list — empty, no pending proposals. */
const THEME_PROPOSALS: unknown[] = [];

/** InviteToken list — empty, no active invite links. */
const INVITE_LIST: unknown[] = [];

// ---------------------------------------------------------------------------
// API stubs — list and detail endpoints the manage page queries.
// ---------------------------------------------------------------------------
type ApiStub = { urlPattern: RegExp; status: number; body: unknown };

const API_STUBS: ApiStub[] = [
  // Auth / admin identity
  { urlPattern: /\/api\/admins\/me(\?|$)/, status: 200, body: ADMIN_STATUS },
  { urlPattern: /\/api\/admins(\?|$)/, status: 200, body: ADMIN_LIST },

  // Theme proposals
  {
    urlPattern: /\/api\/themes\/proposals(\?|$)/,
    status: 200,
    body: THEME_PROPOSALS,
  },

  // Invite tokens
  { urlPattern: /\/api\/invites(\?|$)/, status: 200, body: INVITE_LIST },

  // Regular list endpoints — empty-but-valid arrays
  { urlPattern: /\/api\/clubs(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/themes(\?|$)/, status: 200, body: [] },
  {
    urlPattern: /\/api\/photographers(\?|$)/,
    status: 200,
    body: [
      {
        id: 9,
        name: "Harry Michiels",
        bio: "",
        email: null,
        avatarUrl: null,
        clubs: [{ id: 4, name: "Fotoclub Veghel", memberSince: null }],
        themes: [],
        createdAt: "2026-07-23T12:00:00.000Z",
        photoCount: 22,
        claimed: false,
      },
    ],
  },
  { urlPattern: /\/api\/photos\/recent(\?|$)/, status: 200, body: [] },
  { urlPattern: /\/api\/photos(\?|$)/, status: 200, body: [] },

  // Stats
  {
    urlPattern: /\/api\/stats(\?|$)/,
    status: 200,
    body: { photographs: 0, clubs: 0, photographers: 0, themes: 0 },
  },

  // Photographer profile (current user) — not linked
  {
    urlPattern: /\/api\/photographers\/me(\?|$)/,
    status: 404,
    body: { error: "Not found" },
  },

  // Theme proposals for the current user (my-proposals)
  {
    urlPattern: /\/api\/themes\/my-proposals(\?|$)/,
    status: 200,
    body: [],
  },
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
// Helpers shared by all manage-page tests.
// ---------------------------------------------------------------------------

/**
 * Set Dutch in localStorage, register API stubs (including admin auth), then
 * navigate to the given path and wait for React to settle.
 */
async function visitManageInDutch(page: Page, path = "/manage") {
  await page.addInitScript(() => {
    localStorage.setItem("photoclub.lang", "nl");
  });

  await stubApiCalls(page);

  await page.goto(path, { waitUntil: "networkidle" });

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

test("Manage page shows no raw i18next keys in Dutch (default tab)", async ({
  page,
}) => {
  await visitManageInDutch(page);
  await assertNoRawKeys(page, "Manage (default tab)");
});

test("Manage page: Dutch language is active (sanity check)", async ({
  page,
}) => {
  await visitManageInDutch(page);
  const bodyText = await getPageText(page);
  // "Beheer" is the Dutch translation of "manage.title" / the page heading.
  expect(bodyText, "Expected Dutch text 'Beheer' in the manage page body").toMatch(
    /Beheer/
  );
});

/**
 * Iterate over each manage tab by clicking it and asserting no raw keys are
 * visible.  Tabs are located by their stable data-testid attribute so the test
 * remains correct even if labels are renamed or reordered.  A final assertion
 * confirms that every expected tab was actually exercised.
 */
const MANAGE_TABS = [
  { label: "Club tab",         testId: "manage-tab-club" },
  { label: "Theme tab",        testId: "manage-tab-theme" },
  { label: "Photographer tab", testId: "manage-tab-photographer" },
  { label: "Import tab",       testId: "manage-tab-import" },
  { label: "Photos tab",       testId: "manage-tab-photos" },
  { label: "Admins tab",       testId: "manage-tab-admins" },
];

/**
 * Sanity-check: the number of tab buttons in the DOM must match the number of
 * entries in MANAGE_TABS.  If a new tab is added to manage.tsx without a
 * corresponding MANAGE_TABS entry, this test fails loudly instead of silently
 * skipping the new tab.
 */
test("Manage page — tab count matches expected MANAGE_TABS list", async ({
  page,
}) => {
  await visitManageInDutch(page);

  // Count all role="tab" elements inside the manage TabsList.
  const tabCount = await page.getByRole("tab").count();

  expect(
    tabCount,
    `Found ${tabCount} tab(s) in the DOM but MANAGE_TABS lists ${MANAGE_TABS.length}. ` +
      "Add or remove an entry in MANAGE_TABS to keep the smoke test in sync."
  ).toBe(MANAGE_TABS.length);
});

for (const { label, testId } of MANAGE_TABS) {
  test(`Manage page — ${label} shows no raw i18next keys in Dutch`, async ({
    page,
  }) => {
    await visitManageInDutch(page);

    // Locate the tab by its stable data-testid attribute.
    const tab = page.getByTestId(testId);
    await tab.waitFor({ state: "visible", timeout: 10_000 });
    await tab.click();

    // Wait for the tab panel content to settle.
    await page.waitForTimeout(400);

    await assertNoRawKeys(page, `Manage / ${label}`);
  });
}

test("Photographer names remain visible when unclaimed-profile actions need to wrap", async ({ page }) => {
  await page.setViewportSize({ width: 950, height: 900 });
  await visitManageInDutch(page);
  await page.getByTestId("manage-tab-photographer").click();

  const name = page.getByText("Harry Michiels", { exact: true });
  await expect(name).toBeVisible();
  expect((await name.boundingBox())?.width ?? 0).toBeGreaterThan(100);
  await expect(page.getByRole("button", { name: "Uitnodiging sturen" })).toBeVisible();
});
