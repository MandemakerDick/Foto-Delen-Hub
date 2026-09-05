import { expect, test, type Page } from "@playwright/test";

async function stubGalleryApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    if (/\/api\/photos\/gallery(\?|$)/.test(url)) {
      const requestUrl = new URL(url);
      const isNextPage = requestUrl.searchParams.get("cursor") === "page-2";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: isNextPage ? 2 : 1,
              title: isNextPage ? "Owl" : "Fox",
              description: null,
              imageUrl: isNextPage ? "/owl.jpg" : "/fox.jpg",
              photographerId: 3,
              photographerName: "Ada",
              clubId: 1,
              clubName: "Lens Club",
              themeId: 2,
              themeName: "Wildlife",
              likeCount: 0,
              commentCount: 0,
              sortOrder: isNextPage ? 1 : 0,
              createdAt: isNextPage ? "2026-05-01T12:00:00.000Z" : "2026-06-01T12:00:00.000Z",
            },
          ],
          total: 2,
          nextCursor: isNextPage ? null : "page-2",
          hasMore: !isNextPage,
        }),
      });
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
  await page.goto("/photos?sort=random&seed=12345", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\?sort=random&seed=12345$/);
  await page.getByRole("button", { name: "Show another random selection" }).click();
  await expect(page).not.toHaveURL(/\?sort=random&seed=12345$/);
  await expect(page).toHaveURL(/\?sort=random&seed=\d+$/);
});

test("Photographer's order automatically groups the Gallery by photographer", async ({ page }) => {
  await stubGalleryApi(page);
  await page.goto("/photos", { waitUntil: "networkidle" });

  await page.getByTestId("gallery-sort").click();
  await page.getByRole("option", { name: "Photographer's order" }).click();

  await expect(page.getByTestId("gallery-group-by")).toContainText("Photographer");
  await expect(page).toHaveURL(/\?group=photographer&sort=photographer$/);
});

test("the Gallery sends the complete shared view to the server", async ({ page }) => {
  await stubGalleryApi(page);
  const galleryRequest = page.waitForRequest((request) => request.url().includes("/api/photos/gallery?"));

  await page.goto(
    "/photos?search=fox&clubs=1&themes=2&photographer=3&from=2026-01-01&to=2026-12-31&group=photographer&sort=photographer",
  );

  const request = await galleryRequest;
  const params = new URL(request.url()).searchParams;
  expect(params.get("search")).toBe("fox");
  expect(params.get("clubIds")).toBe("1");
  expect(params.get("themeIds")).toBe("2");
  expect(params.get("photographerId")).toBe("3");
  expect(params.get("from")).toBe("2026-01-01");
  expect(params.get("to")).toBe("2026-12-31");
  expect(params.get("group")).toBe("photographer");
  expect(params.get("sort")).toBe("photographer");
  expect(params.get("limit")).toBe("24");
});

test("Load more appends the next cursor page without replacing current photos", async ({ page }) => {
  await stubGalleryApi(page);
  await page.goto("/photos");

  await expect(page.getByText("Fox", { exact: true })).toBeVisible();
  await page.getByTestId("gallery-load-more").click();

  await expect(page.getByText("Fox", { exact: true })).toBeVisible();
  await expect(page.getByText("Owl", { exact: true })).toBeVisible();
  await expect(page.getByTestId("gallery-load-more")).toHaveCount(0);
});