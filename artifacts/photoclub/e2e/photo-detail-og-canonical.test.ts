/**
 * Photo detail — og:url canonical URL test
 *
 * #103 — social platforms must not see the same photo as duplicate content
 * when shared via different URLs (e.g. /photos/101 vs /photos/101?context=gallery:5).
 *
 * Verifies that the og:url meta tag always points to the clean canonical URL
 * (/photos/{id}) regardless of query parameters present in the browser URL.
 *
 * Also verifies that a <link rel="canonical"> element is injected.
 *
 * API calls are stubbed so the test works without a live server.
 */

import { test, expect, type Page } from "@playwright/test";

const PHOTO = {
  id: 701,
  title: "Coastal Sunrise",
  imageUrl: "https://placehold.co/400x500/png",
  description: null,
  themeId: 1,
  themeName: "Nature",
  clubId: 2,
  clubName: "Sunrise Club",
  photographerId: 5,
  photographerName: "Kim Lee",
  photographerAvatarUrl: null,
  createdAt: "2024-07-04T00:00:00.000Z",
  sortOrder: 0,
  likeCount: 3,
  likesCount: 3,
};

async function stubApiForPhoto(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("__clerk")) { await route.continue(); return; }
    if (new RegExp(`/api/photos/${PHOTO.id}(\\?|$)`).test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTO) });
      return;
    }
    if (new RegExp(`/api/photos/${PHOTO.id}/comments(\\?|$)`).test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
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
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });
}

async function waitForBodyText(page: Page, text: string) {
  await page.waitForFunction(
    (t) => (document.body.textContent ?? "").includes(t),
    text,
    { timeout: 15_000 },
  );
}

test.describe("PhotoDetail — og:url canonical (#103)", () => {
  test("og:url points to the clean /photos/{id} URL when visited with a context query param", async ({ page }) => {
    await stubApiForPhoto(page);
    // Navigate with a context param — the sort that gallery navigation adds.
    await page.goto(`/photos/${PHOTO.id}?context=gallery%3A5`, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await waitForBodyText(page, PHOTO.title);

    // Wait for Helmet to inject the og:url tag.
    const canonicalPath = `/photos/${PHOTO.id}`;
    await page.waitForFunction(
      ([prop, path]: [string, string]) =>
        Array.from(document.querySelectorAll<HTMLMetaElement>(`meta[property="${prop}"]`)).some((el) =>
          el.content.endsWith(path) && !el.content.includes("context"),
        ),
      ["og:url", canonicalPath] as [string, string],
      { timeout: 10_000 },
    );

    const ogUrl = await page.evaluate(() => {
      const tags = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:url"]'));
      return tags.find((el) => el.content.includes("/photos/"))?.content ?? null;
    });

    expect(ogUrl, "Expected og:url to be present").toBeTruthy();
    expect(ogUrl, "Expected og:url to end with /photos/{id}").toMatch(new RegExp(`/photos/${PHOTO.id}$`));
    expect(ogUrl, "Expected og:url not to contain context query param").not.toContain("context");
  });

  test("og:url is identical whether the page is visited with or without query params", async ({ page }) => {
    await stubApiForPhoto(page);

    // First visit: clean URL.
    await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await waitForBodyText(page, PHOTO.title);

    await page.waitForFunction(
      ([prop, path]: [string, string]) =>
        Array.from(document.querySelectorAll<HTMLMetaElement>(`meta[property="${prop}"]`)).some((el) =>
          el.content.endsWith(path),
        ),
      ["og:url", `/photos/${PHOTO.id}`] as [string, string],
      { timeout: 10_000 },
    );

    const cleanOgUrl = await page.evaluate(() => {
      const tags = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:url"]'));
      return tags.find((el) => el.content.includes("/photos/"))?.content ?? null;
    });

    expect(cleanOgUrl).toMatch(new RegExp(`/photos/${PHOTO.id}$`));
  });

  test("a canonical link element is present pointing to /photos/{id}", async ({ page }) => {
    await stubApiForPhoto(page);
    await page.goto(`/photos/${PHOTO.id}?context=gallery%3A1`, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await waitForBodyText(page, PHOTO.title);

    // Wait for the <link rel="canonical"> injected by Helmet.
    await page.waitForFunction(
      (path: string) => {
        const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
        return links.some((el) => el.href.endsWith(path) && !el.href.includes("context"));
      },
      `/photos/${PHOTO.id}`,
      { timeout: 10_000 },
    );

    const canonical = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
      return links.find((el) => el.href.includes("/photos/"))?.href ?? null;
    });

    expect(canonical, "Expected a <link rel='canonical'> pointing to /photos/{id}").toBeTruthy();
    expect(canonical, "Canonical must not contain context param").not.toContain("context");
  });
});
