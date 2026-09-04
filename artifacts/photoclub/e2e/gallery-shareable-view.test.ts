import { expect, test, type Page } from "@playwright/test";

async function stubGalleryApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    if (/\/api\/photos(\?|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            title: "Fox",
            description: null,
            imageUrl: "/fox.jpg",
            photographerId: 3,
            photographerName: "Ada",
            clubId: 1,
            clubName: "Lens Club",
            themeId: 2,
            themeName: "Wildlife",
            likeCount: 0,
            commentCount: 0,
            sortOrder: 0,
            createdAt: "2026-06-01T12:00:00.000Z",
          },
        ]),
      });
      return;
    }

    const responses: Array<[RegExp, unknown]> = [
      [/\/api\/clubs(\?|$)/, [{ id: 1, name: "Lens Club" }]],
      [/\/api\/themes(\?|$)/, [{ id: 2, name: "Wildlife" }]],
      [/\/api\/photographers(\?|$)/, [{ id: 3, name: "Ada" }]],
      [/\/api\/admins\/me(\?|$)/, { isAdmin: false, totalAdmins: 0 }],
    ];
    const response = responses.find(([pattern]) => pattern.test(url));
    await route.fulfill({
      status: response ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(response?.[1] ?? { error: "Not found (test stub)" }),
    });
  });
}

test("a shared Gallery URL restores and copies the complete view", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  if (baseURL) {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  }
  const page = await context.newPage();
  await stubGalleryApi(page);

  const sharedPath =
    "/photos?search=fox&clubs=1&themes=2&photographer=3&from=2026-01-01&to=2026-12-31&group=photographer&sort=photographer";
  await page.goto(sharedPath, { waitUntil: "networkidle" });

  await expect(page.locator("input").first()).toHaveValue("fox");
  await expect(page.getByTestId("gallery-club-filter")).toContainText("1 Clubs selected");
  await expect(page.getByTestId("gallery-theme-filter")).toContainText("1 Themes selected");
  await expect(page.getByTestId("gallery-photographer-filter")).toContainText("Ada");
  await expect(page.getByTestId("gallery-group-by")).toContainText("Photographer");
  await expect(page.getByTestId("gallery-sort")).toContainText("Photographer's order");
  await expect(page.getByTestId("gallery-date-from")).toHaveValue("2026-01-01");
  await expect(page.getByTestId("gallery-date-to")).toHaveValue("2026-12-31");

  await page.getByTestId("gallery-share").click();
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copiedUrl).pathname + new URL(copiedUrl).search).toBe(sharedPath);

  await context.close();
});

test("a shared Random view is reproducible until it is reshuffled", async ({ page }) => {
  await stubGalleryApi(page);
  await page.goto("/photos?group=random&seed=12345", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\?group=random&seed=12345$/);
  await page.getByRole("button", { name: "Show another random selection" }).click();
  await expect(page).not.toHaveURL(/\?group=random&seed=12345$/);
  await expect(page).toHaveURL(/\?group=random&seed=\d+$/);
});