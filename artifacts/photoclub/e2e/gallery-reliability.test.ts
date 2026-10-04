import { expect, test } from "@playwright/test";
import { mockGalleryLibrary } from "./fixtures/gallery-library";
declare global { interface Window { __refreshGallery: () => Promise<void> } }

test("initial and next-page failures recover without false empty results or lost photos", async ({ page }) => {
  const api = await mockGalleryLibrary(page);
  api.initialFailure(true);
  await page.goto("/photos?search=Fox&sort=oldest");
  await expect(page.getByTestId("gallery-load-error")).toBeVisible();
  await expect(page.getByText("No photographs match these filters", { exact: true })).toHaveCount(0);
  api.initialFailure(false);
  await page.getByTestId("gallery-load-error").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("photo-card-10")).toBeVisible();
  api.nextFailure(true);
  await page.getByTestId("gallery-load-more").click();
  await expect(page.getByTestId("gallery-load-error")).toContainText("Your loaded photographs and filters have been kept");
  await expect(page.getByTestId("photo-card-10")).toBeVisible();
  await expect(page.locator("input").first()).toHaveValue("Fox");
  api.nextFailure(false);
  api.overlappingPages();
  await page.getByTestId("gallery-load-error").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("photo-card-480")).toBeVisible();
  const ids = await page.locator('[data-testid^="photo-card-"]').evaluateAll(elements => elements.map(el => el.getAttribute("data-testid")));
  expect(ids).toHaveLength(48);
  expect(new Set(ids).size).toBe(48);
});

test("Reset clears search, combined filters, grouping and sorting; invalid date ranges make no request", async ({ page }) => {
  const api = await mockGalleryLibrary(page);
  await page.goto("/photos?search=missing&clubs=1&themes=2&photographer=3&group=club&sort=oldest");
  await expect(page.getByText("No photographs match these filters", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await expect(page).toHaveURL(/\/photos$/);
  await expect(page.getByTestId("photo-card-1200")).toBeVisible();
  await page.getByTestId("gallery-date-from").fill("2026-02-01");
  await page.getByTestId("gallery-date-to").fill("2026-01-01");
  await expect(page.getByTestId("gallery-date-error")).toBeVisible();
  expect(api.requests.some(r => r.path.includes("from=2026-02-01") && r.path.includes("to=2026-01-01"))).toBe(false);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.locator("input").first().fill("Fox");
  await expect(page.getByRole("button", { name: "Clear filters", exact: true })).toBeVisible();
});

test("background refresh failures keep the loaded Gallery; retry recovers", async ({ page }) => {
  const api = await mockGalleryLibrary(page);
  await page.goto("/photos?search=Fox&sort=oldest");
  await expect(page.getByTestId("photo-card-10")).toBeVisible();
  api.initialFailure(true);
  await page.evaluate(() => window.__refreshGallery());
  await expect(page.getByTestId("gallery-load-error")).toContainText("previously loaded photographs are still shown");
  await expect(page.getByTestId("photo-card-10")).toBeVisible();
  api.initialFailure(false);
  await page.getByTestId("gallery-load-error").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("gallery-load-error")).toHaveCount(0);
});

test("filter-option failures preserve the active selection and offer recovery", async ({ page }) => {
  const api = await mockGalleryLibrary(page);
  api.filterFailure(true);
  await page.goto("/photos?clubs=1&themes=2&photographer=1&sort=oldest");
  await expect(page.getByTestId("gallery-filter-error")).toBeVisible();
  await expect(page.getByTestId("photo-card-46")).toBeVisible();
  await expect(page.getByTestId("gallery-photographer-filter")).toContainText("Photographer 1");
  api.filterFailure(false);
  await page.getByTestId("gallery-filter-error").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("gallery-filter-error")).toHaveCount(0);
  await page.getByTestId("gallery-club-filter").click();
  await expect(page.locator("label").filter({ hasText: "Club 1" }).getByRole("checkbox")).toBeChecked();
});

test("a canceled filter request cannot overwrite the next selection", async ({ page }) => {
  await mockGalleryLibrary(page);
  await page.route("**/api/photos/gallery?**", async route => {
    if (new URL(route.request().url()).searchParams.get("search") === "Photo") {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    await route.fallback();
  });
  await page.goto("/photos");
  const oldRequest = page.waitForRequest(r => new URL(r.url()).searchParams.get("search") === "Photo");
  await page.locator("input").first().fill("Photo");
  await oldRequest;
  await page.locator("input").first().fill("Fox");
  await expect(page.getByTestId("photo-card-1200")).toBeVisible();
  await page.waitForTimeout(900);
  const ids = await page.locator('[data-testid^="photo-card-"]').evaluateAll(elements => elements.map(el => Number(el.getAttribute("data-testid")!.split("-").at(-1))));
  expect(ids).toHaveLength(24);
  expect(ids.every(id => id % 10 === 0)).toBe(true);
});

test("same-page history navigation restores the Gallery controls and selection", async ({ page }) => {
  await mockGalleryLibrary(page);
  await page.goto("/photos?clubs=1&sort=oldest");
  await expect(page.getByTestId("photo-card-1")).toBeVisible();
  await page.evaluate(() => history.pushState(null, "", "/photos?search=Fox&sort=oldest"));
  await expect(page.locator("input").first()).toHaveValue("Fox");
  await expect(page.getByTestId("photo-card-10")).toBeVisible();
  await page.goBack();
  await expect(page.locator("input").first()).toHaveValue("");
  await expect(page.getByTestId("gallery-club-filter")).toContainText("1 Clubs selected");
  await expect(page.getByTestId("photo-card-1")).toBeVisible();
});

test("seeded combined views keep the same order across reload, pagination and detail return", async ({ page }) => {
  await mockGalleryLibrary(page);
  await page.goto("/photos?clubs=1,2&themes=1,3&group=theme&sort=random&seed=12345");
  await expect(page.locator('[data-testid^="photo-card-"]')).toHaveCount(24);
  const ids = () => page.locator('[data-testid^="photo-card-"]').evaluateAll(elements =>
    elements.map(el => Number(el.getAttribute("data-testid")!.split("-").at(-1))));
  const initial = await ids();
  const viewURL = page.url();
  await page.reload();
  await expect(page.locator('[data-testid^="photo-card-"]')).toHaveCount(24);
  expect(await ids()).toEqual(initial);
  await page.getByTestId("gallery-load-more").click();
  await expect(page.locator('[data-testid^="photo-card-"]')).toHaveCount(48);
  expect((await ids()).slice(0, 24)).toEqual(initial);
  await page.getByTestId(`photo-card-${initial[0]}`).getByRole("img").click();
  await expect(page.getByRole("link", { name: "Next photo", exact: true })).toHaveAttribute("href", new RegExp(`/photos/${initial[1]}\\?`));
  await page.getByRole("link", { name: "Back to Gallery", exact: true }).click();
  await expect(page).toHaveURL(viewURL);
  await expect(page.locator('[data-testid^="photo-card-"]')).toHaveCount(48);
});

test("detail navigation retains the filtered selection, return path and next-page recovery", async ({ page }) => {
  const api = await mockGalleryLibrary(page);
  await page.goto("/photos?search=Fox&sort=oldest");
  await page.getByTestId("photo-card-10").getByRole("img").click();
  await expect(page.getByRole("link", { name: "Next photo", exact: true })).toHaveAttribute("href", /\/photos\/20\?ctx=gallery&view=/);
  expect(api.requests.some(r => r.path === "/api/photos")).toBe(false);
  await page.getByRole("link", { name: "Next photo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fox 20", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Previous photo", exact: true })).toHaveAttribute("href", /\/photos\/10\?/);
  await page.getByRole("link", { name: "Back to Gallery", exact: true }).click();
  await expect(page).toHaveURL(/\/photos\?search=Fox&sort=oldest$/);
  await expect(page.locator("input").first()).toHaveValue("Fox");
  await page.getByTestId("photo-card-240").getByRole("img").click();
  api.nextFailure(true);
  await page.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(page.getByTestId("photo-navigation-error")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fox 240", exact: true })).toBeVisible();
  api.nextFailure(false);
  await page.getByTestId("photo-navigation-error").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Fox 250", exact: true })).toBeVisible();
  expect(api.requests.some(r => r.path === "/api/photos")).toBe(false);
});

test("a 240-card library reveals appended cards promptly without refetching the whole library", async ({ page }) => {
  const api = await mockGalleryLibrary(page);
  await page.goto("/photos?sort=oldest");
  for (let i = 0; i < 9; i++) {
    await page.getByTestId("gallery-load-more").click();
    await expect(page.locator('[data-testid^="photo-card-"]')).toHaveCount((i + 2) * 24);
  }
  await expect(page.getByTestId("photo-card-240")).toHaveCSS("opacity", "1", { timeout: 2000 });
  const galleryRequests = api.requests.filter(r => r.path.startsWith("/api/photos/gallery"));
  expect(galleryRequests).toHaveLength(10);
  expect(api.requests.some(r => r.path === "/api/photos")).toBe(false);
  console.log("MEASURED: 240 cards, 10 page requests; first page bytes =", galleryRequests[0].bytes);
});

test("photo request failures are not called missing photos and retain the Gallery return path", async ({ page }) => {
  const api = await mockGalleryLibrary(page);
  await page.goto("/photos?search=Fox&sort=oldest");
  api.photoFailure(true);
  await page.getByTestId("photo-card-10").getByRole("img").click();
  await expect(page.getByTestId("photo-load-error")).toBeVisible();
  await expect(page.getByText("Photograph not found", { exact: true })).toHaveCount(0);
  api.photoFailure(false);
  await page.getByTestId("photo-load-error").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Fox 10", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Gallery", exact: true })).toHaveAttribute("href", "/photos?search=Fox&sort=oldest");
});

for (const width of [360, 768, 1280]) {
  test(`populated combined Gallery filters fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockGalleryLibrary(page);
    await page.goto("/photos?clubs=1,2,3&themes=1,2,3,4&photographer=1&group=club&sort=likes");
    await expect(page.locator('[data-testid^="photo-card-"]').first()).toBeVisible();
    const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(size.scroll).toBeLessThanOrEqual(size.client);
  });
}

test("Dutch Gallery failures and photo navigation labels remain translated", async ({ page }) => {
  const api = await mockGalleryLibrary(page);
  api.initialFailure(true);
  await page.goto("/photos?search=Fox&sort=oldest");
  await page.getByRole("button", { name: /language/i }).click();
  await page.getByRole("menuitem", { name: "Nederlands" }).click();
  await expect(page.getByTestId("gallery-load-error")).toContainText("De galerij kon niet worden geladen");
  api.initialFailure(false);
  await page.getByTestId("gallery-load-error").getByRole("button", { name: "Opnieuw proberen" }).click();
  await page.getByTestId("photo-card-10").getByRole("img").click();
  await expect(page.getByRole("link", { name: "Volgende foto", exact: true })).toBeVisible();
});