/**
 * OG meta-tag smoke tests — PhotographersHub
 *
 * Verifies that the PhotographerDetail and ClubDetail pages render:
 *   - a document <title> that contains the photographer/club name
 *   - a non-empty og:title meta tag
 *   - a non-empty og:image meta tag
 *
 * API calls are fully intercepted so the test works without a running API server.
 */

import { test, expect, type Page } from "@playwright/test";
import { ogMiddleware } from "../vite-og-plugin";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------
const PHOTOGRAPHER = {
  id: 42,
  name: "Jane Doe",
  bio: "Street and portrait photographer.",
  avatarUrl: "https://placehold.co/200x200/png",
  photoCount: 3,
  createdAt: "2021-06-01T00:00:00.000Z",
  themes: [{ id: 1, name: "Street" }],
  clubs: [{ id: 7, name: "City Shooters", memberSince: "2021-06" }],
};

const CLUB = {
  id: 7,
  name: "City Shooters",
  description: "Urban photography collective.",
  logoUrl: "https://placehold.co/200x200/png",
  location: "Amsterdam",
  websiteUrl: "https://example.com",
  yearEstablished: 2015,
  memberCount: 12,
  photoCount: 88,
  createdAt: "2015-04-01T00:00:00.000Z",
};

const PHOTOS: unknown[] = [
  {
    id: 101,
    title: "Street Corner",
    imageUrl: "https://placehold.co/400x500/png",
    themeId: 1,
    themeName: "Street",
    clubId: 7,
    clubName: "City Shooters",
    photographerId: 42,
    photographerName: "Jane Doe",
    createdAt: "2024-01-01T00:00:00.000Z",
    sortOrder: 0,
  },
];

// ---------------------------------------------------------------------------
// API stub helper
// ---------------------------------------------------------------------------
async function stubApiCalls(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    // Let Clerk auth requests through
    if (url.includes("__clerk")) {
      await route.continue();
      return;
    }

    // Photographer detail
    if (/\/api\/photographers\/42(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTOGRAPHER) });
      return;
    }
    // Club detail
    if (/\/api\/clubs\/7(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CLUB) });
      return;
    }
    // Photos for the photographer
    if (/\/api\/photos(\?|$)/.test(url)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTOS) });
      return;
    }
    // List endpoints → empty arrays
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
    // Auth / admin — not signed in
    if (/\/api\/admins\/me(\?|$)/.test(url)) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
      return;
    }
    if (/\/api\/photographers\/me(\?|$)/.test(url)) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
      return;
    }
    // Fallback
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (test stub)" }) });
  });
}

// ---------------------------------------------------------------------------
// Helpers for reading head tags
//
// react-helmet-async v3 APPENDS new <meta> / <title> elements rather than
// replacing the static ones baked into index.html.  So querySelector always
// returns the original "PhotoMatrix" entry first.  We must scan ALL matching
// elements and look for the Helmet-injected one.
// ---------------------------------------------------------------------------

/** Return the content of the first meta[property] element whose content
 *  includes `expectedText`, or null if none matches. */
function findMetaContent(page: Page, property: string, expectedText: string): Promise<string | null> {
  return page.evaluate(
    ([prop, text]) => {
      const els = Array.from(document.querySelectorAll<HTMLMetaElement>(`meta[property="${prop}"]`));
      return els.find((el) => el.content.includes(text))?.content ?? null;
    },
    [property, expectedText] as [string, string],
  );
}

/** Return true when any meta[property] element's content includes expectedText. */
function anyMetaContains(page: Page, property: string, text: string): Promise<boolean> {
  return page.evaluate(
    ([prop, t]) => {
      const els = Array.from(document.querySelectorAll<HTMLMetaElement>(`meta[property="${prop}"]`));
      return els.some((el) => el.content.includes(t));
    },
    [property, text] as [string, string],
  );
}

/** Return true when any meta[property] element has non-empty content. */
function anyMetaNonEmpty(page: Page, property: string): Promise<boolean> {
  return page.evaluate(
    (prop) => {
      const els = Array.from(document.querySelectorAll<HTMLMetaElement>(`meta[property="${prop}"]`));
      return els.some((el) => (el.content?.length ?? 0) > 0);
    },
    property,
  );
}

// ---------------------------------------------------------------------------
// Helper: wait until a string appears somewhere in the page body text.
// react-helmet-async updates <head> after React renders; we gate on the
// visible content so we know the component has fully rendered with real data
// before asserting on meta tags.
// ---------------------------------------------------------------------------
async function waitForBodyText(page: Page, text: string, timeoutMs = 15_000) {
  await page.waitForFunction(
    (t) => (document.body.textContent ?? "").includes(t),
    text,
    { timeout: timeoutMs },
  );
}

// ---------------------------------------------------------------------------
// Tests: PhotographerDetail OG tags
// ---------------------------------------------------------------------------
test.describe("PhotographerDetail OG meta tags", () => {
  test.beforeEach(async ({ page }) => {
    await stubApiCalls(page);
    await page.goto("/photographers/42", { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    // Wait for the page to render with real fixture data before asserting.
    await waitForBodyText(page, PHOTOGRAPHER.name);
  });

  /**
   * document.title is set imperatively via useEffect once the photographer
   * data loads, bypassing the react-helmet-async v3 + React 19 hoisting bug
   * that left the tab title as the static "PhotoMatrix" from index.html.
   */
  test("document.title contains the photographer name", async ({ page }) => {
    await page.waitForFunction(
      (name) => document.title.includes(name),
      PHOTOGRAPHER.name,
      { timeout: 10_000 },
    );
    const title = await page.title();
    expect(title).toContain(PHOTOGRAPHER.name);
  });

  test("og:title meta tag contains the photographer name", async ({ page }) => {
    // react-helmet-async v3 + React 19 APPENDS a second og:title element rather
    // than replacing the static one from index.html.  We must check ALL matches.
    await page.waitForFunction(
      (name) => Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:title"]')).some((el) => el.content.includes(name)),
      PHOTOGRAPHER.name,
      { timeout: 10_000 },
    );
    const content = await findMetaContent(page, "og:title", PHOTOGRAPHER.name);
    expect(content, `Expected an og:title containing "${PHOTOGRAPHER.name}"`).toBeTruthy();
    expect(content).toContain(PHOTOGRAPHER.name);
  });

  test("og:image meta tag contains the photographer avatar URL", async ({ page }) => {
    // Wait for the Helmet-injected og:image that carries the fixture avatarUrl.
    // react-helmet-async appends a second og:image rather than replacing the
    // static index.html one, so we check ALL matching meta tags.
    await page.waitForFunction(
      (url) => Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:image"]')).some((el) => el.content.includes(url)),
      PHOTOGRAPHER.avatarUrl,
      { timeout: 10_000 },
    );
    const content = await findMetaContent(page, "og:image", PHOTOGRAPHER.avatarUrl);
    expect(content, `Expected an og:image containing the fixture avatarUrl`).toBeTruthy();
    expect(content).toContain(PHOTOGRAPHER.avatarUrl);
  });
});

// ---------------------------------------------------------------------------
// Tests: PhotoDetail OG tags
// ---------------------------------------------------------------------------
test.describe("PhotoDetail OG meta tags", () => {
  const PHOTO = PHOTOS[0] as {
    id: number;
    title: string;
    imageUrl: string;
    photographerId: number;
    photographerName: string;
    clubId: number;
    clubName: string;
    themeId: number;
    themeName: string;
    createdAt: string;
    sortOrder: number;
  };

  test.beforeEach(async ({ page }) => {
    // Stub all API calls, including photo-detail-specific endpoints.
    await page.route("**/api/**", async (route) => {
      const url = route.request().url();

      // Let Clerk auth requests through
      if (url.includes("__clerk")) {
        await route.continue();
        return;
      }

      // Single photo detail — must come before the list pattern
      if (new RegExp(`/api/photos/${PHOTO.id}(\\?|$)`).test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTO) });
        return;
      }
      // Comments for the photo
      if (new RegExp(`/api/photos/${PHOTO.id}/comments(\\?|$)`).test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
        return;
      }
      // Photos list
      if (/\/api\/photos(\?|$)/.test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTOS) });
        return;
      }
      // List endpoints → empty arrays
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
      // Auth / admin — not signed in
      if (/\/api\/admins\/me(\?|$)/.test(url)) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
        return;
      }
      if (/\/api\/photographers\/me(\?|$)/.test(url)) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
        return;
      }
      // Fallback
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (test stub)" }) });
    });

    await page.goto(`/photos/${PHOTO.id}`, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    // Wait for the page to render with real fixture data before asserting on meta tags.
    await waitForBodyText(page, PHOTO.title);
  });

  test("og:title meta tag contains the photo title", async ({ page }) => {
    // react-helmet-async v3 + React 19 APPENDS a second og:title element rather
    // than replacing the static one from index.html. We must check ALL matches.
    await page.waitForFunction(
      (title) => Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:title"]')).some((el) => el.content.includes(title)),
      PHOTO.title,
      { timeout: 10_000 },
    );
    const content = await findMetaContent(page, "og:title", PHOTO.title);
    expect(content, `Expected an og:title containing "${PHOTO.title}"`).toBeTruthy();
    expect(content).toContain(PHOTO.title);
  });

  test("og:image meta tag contains the photo imageUrl (not a fallback)", async ({ page }) => {
    // Wait for the Helmet-injected og:image that carries the fixture imageUrl.
    await page.waitForFunction(
      (url) => Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:image"]')).some((el) => el.content.includes(url)),
      PHOTO.imageUrl,
      { timeout: 10_000 },
    );
    const content = await findMetaContent(page, "og:image", PHOTO.imageUrl);
    expect(content, `Expected an og:image containing the fixture imageUrl, not a fallback`).toBeTruthy();
    expect(content).toContain(PHOTO.imageUrl);
  });
});

// ---------------------------------------------------------------------------
// Tests: PhotoDetail OG tags — description fallback
// ---------------------------------------------------------------------------
test.describe("PhotoDetail OG meta tags — description fallback", () => {
  const PHOTO_NO_DESC = {
    id: 202,
    title: "Misty Morning",
    imageUrl: "https://placehold.co/400x500/png",
    description: null,
    photographerId: 42,
    photographerName: "Jane Doe",
    clubId: 7,
    clubName: "City Shooters",
    themeId: 1,
    themeName: "Street",
    createdAt: "2024-03-01T00:00:00.000Z",
    sortOrder: 1,
  };

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      const url = route.request().url();

      if (url.includes("__clerk")) {
        await route.continue();
        return;
      }

      // Single photo detail — must come before the list pattern
      if (new RegExp(`/api/photos/${PHOTO_NO_DESC.id}(\\?|$)`).test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTO_NO_DESC) });
        return;
      }
      // Comments for the photo
      if (new RegExp(`/api/photos/${PHOTO_NO_DESC.id}/comments(\\?|$)`).test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
        return;
      }
      // Photos list
      if (/\/api\/photos(\?|$)/.test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([PHOTO_NO_DESC]) });
        return;
      }
      // List endpoints → empty arrays
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
      // Auth / admin — not signed in
      if (/\/api\/admins\/me(\?|$)/.test(url)) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not authenticated" }) });
        return;
      }
      if (/\/api\/photographers\/me(\?|$)/.test(url)) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
        return;
      }
      // Fallback
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (test stub)" }) });
    });

    await page.goto(`/photos/${PHOTO_NO_DESC.id}`, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    // Wait for the page to render with real fixture data before asserting on meta tags.
    await waitForBodyText(page, PHOTO_NO_DESC.title);
  });

  test("og:description contains the photographer name fallback when photo has no description", async ({ page }) => {
    // This browser-side test guards the client-side JSX fallback in photo-detail.tsx:
    //   photo.description ?? `A photograph by ${photo.photographerName ?? "a PhotoMatrix member"}`
    // react-helmet-async v3 appends a second og:description after React renders; we scan all tags.
    const expectedFallback = `A photograph by ${PHOTO_NO_DESC.photographerName}`;
    await page.waitForFunction(
      ([prop, text]: [string, string]) =>
        Array.from(document.querySelectorAll<HTMLMetaElement>(`meta[property="${prop}"]`)).some((el) =>
          el.content.includes(text),
        ),
      ["og:description", expectedFallback] as [string, string],
      { timeout: 10_000 },
    );
    const content = await findMetaContent(page, "og:description", expectedFallback);
    expect(content, `Expected an og:description containing "${expectedFallback}"`).toBeTruthy();
    expect(content).toContain(PHOTO_NO_DESC.photographerName);
    // Must not be the static site-wide tag.
    expect(content).not.toContain("Capture. Connect. Create.");
  });

  test("og:description is non-empty even when the photo has no description", async ({ page }) => {
    // Confirm Helmet injected a photo-specific og:description (≥2 tags in DOM) with fallback text.
    const expectedFallback = `A photograph by ${PHOTO_NO_DESC.photographerName}`;
    await page.waitForFunction(
      ([prop, text]: [string, string]) => {
        const els = Array.from(document.querySelectorAll<HTMLMetaElement>(`meta[property="${prop}"]`));
        return els.length >= 2 && els.some((el) => el.content.includes(text));
      },
      ["og:description", expectedFallback] as [string, string],
      { timeout: 10_000 },
    );
    const nonEmpty = await anyMetaNonEmpty(page, "og:description");
    expect(nonEmpty, "Expected og:description to be non-empty even for a description-less photo").toBe(true);
    const content = await findMetaContent(page, "og:description", expectedFallback);
    expect(content).toContain("A photograph by");
  });
});

// ---------------------------------------------------------------------------
// Tests: PhotoDetail OG HTML served to crawlers — description fallback
//
// These tests call ogMiddleware() directly (unit-style) so they verify the
// server-rendered HTML a social-media crawler actually receives, independent
// of client-side React hydration.
// ---------------------------------------------------------------------------
test.describe("PhotoDetail OG HTML served to crawlers — description fallback", () => {
  const PHOTO_NO_DESC_FIXTURE = {
    title: "Misty Morning",
    description: null,
    imageUrl: "https://placehold.co/400x500/png",
    photographerName: "Jane Doe",
  };

  /** Install a temporary fetch mock so ogMiddleware returns PHOTO_NO_DESC_FIXTURE. */
  function mockFetchForPhoto(photoId: number, fixture: typeof PHOTO_NO_DESC_FIXTURE) {
    const originalFetch = global.fetch;
    global.fetch = (async (url: string | URL | Request) => {
      const href = typeof url === "string" ? url
        : url instanceof URL ? url.href
        : (url as Request).url;
      if (new RegExp(`/api/photos/${photoId}(\\?|$)`).test(href)) {
        return new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }) as typeof fetch;
    return () => { global.fetch = originalFetch; };
  }

  test("crawler receives the photographer-name fallback in og:description for a photo with no description", async () => {
    const restore = mockFetchForPhoto(202, PHOTO_NO_DESC_FIXTURE);
    let htmlOut = "";
    let nextCalled = false;
    const req = { headers: { "user-agent": "Slackbot 1.0 (+https://api.slack.com/robots)" }, url: "/photos/202" };
    const res = { statusCode: 0, setHeader(_k: string, _v: string) {}, end(body: string) { htmlOut = body; } };
    try {
      await ogMiddleware(req as never, res as never, () => { nextCalled = true; }, "http://localhost:5183", "http://localhost:5183", "http://localhost:5183/opengraph.jpg");
    } finally {
      restore();
    }
    expect(nextCalled, "ogMiddleware should handle the crawler request, not call next()").toBe(false);
    expect(htmlOut).toContain('property="og:description"');
    expect(htmlOut).toContain("A photograph by Jane Doe");
    // Must not fall back to the generic site-wide description.
    expect(htmlOut).not.toContain("Capture. Connect. Create.");
  });

  test("og:description in crawler HTML is non-empty for a description-less photo", async () => {
    const restore = mockFetchForPhoto(202, PHOTO_NO_DESC_FIXTURE);
    let htmlOut = "";
    const req = { headers: { "user-agent": "facebookexternalhit/1.1" }, url: "/photos/202" };
    const res = { statusCode: 0, setHeader(_k: string, _v: string) {}, end(body: string) { htmlOut = body; } };
    try {
      await ogMiddleware(req as never, res as never, () => {}, "http://localhost:5183", "http://localhost:5183", "http://localhost:5183/opengraph.jpg");
    } finally {
      restore();
    }
    // Extract og:description content from the server-rendered HTML.
    const descMatch = htmlOut.match(/property="og:description"\s+content="([^"]+)"/);
    expect(descMatch, "Expected og:description to be present in crawler HTML").toBeTruthy();
    const descContent = descMatch?.[1] ?? "";
    expect(descContent.length, "Expected og:description to be non-empty in crawler HTML").toBeGreaterThan(0);
    expect(descContent).toContain("A photograph by");
  });
});

// ---------------------------------------------------------------------------
// Tests: PhotoDetail OG — no photographer name fallback (#107)
// ---------------------------------------------------------------------------
test.describe("PhotoDetail OG — description fallback with no photographer name (#107)", () => {
  const PHOTO_NO_PHOTOGRAPHER = {
    id: 203,
    title: "Unnamed Work",
    imageUrl: "https://placehold.co/400x500/png",
    description: null,
    photographerId: null,
    photographerName: null,
    clubId: null,
    clubName: null,
    themeId: null,
    themeName: null,
    createdAt: "2024-04-01T00:00:00.000Z",
    sortOrder: 0,
    likeCount: 0,
    likesCount: 0,
  };

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      const url = route.request().url();
      if (url.includes("__clerk")) { await route.continue(); return; }
      if (new RegExp(`/api/photos/${PHOTO_NO_PHOTOGRAPHER.id}(\\?|$)`).test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTO_NO_PHOTOGRAPHER) });
        return;
      }
      if (new RegExp(`/api/photos/${PHOTO_NO_PHOTOGRAPHER.id}/comments(\\?|$)`).test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
        return;
      }
      if (/\/api\/photos(\?|$)/.test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([PHOTO_NO_PHOTOGRAPHER]) });
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
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (test stub)" }) });
    });

    await page.goto(`/photos/${PHOTO_NO_PHOTOGRAPHER.id}`, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await waitForBodyText(page, PHOTO_NO_PHOTOGRAPHER.title);
  });

  test("og:description falls back to the generic member phrase when photographer name is null (#107)", async ({ page }) => {
    const expectedFallback = "A photograph by a PhotoMatrix member";
    await page.waitForFunction(
      ([prop, text]: [string, string]) =>
        Array.from(document.querySelectorAll<HTMLMetaElement>(`meta[property="${prop}"]`)).some((el) =>
          el.content.includes(text),
        ),
      ["og:description", expectedFallback] as [string, string],
      { timeout: 10_000 },
    );
    const content = await findMetaContent(page, "og:description", expectedFallback);
    expect(content, `Expected og:description to contain "${expectedFallback}"`).toBeTruthy();
    expect(content).toContain("a PhotoMatrix member");
    expect(content).not.toContain("Capture. Connect. Create.");
  });

  test("crawler HTML includes generic fallback in og:description when photographer name is null (#107)", async () => {
    const fixture = PHOTO_NO_PHOTOGRAPHER;
    const originalFetch = global.fetch;
    global.fetch = (async (url: string | URL | Request) => {
      const href = typeof url === "string" ? url : url instanceof URL ? url.href : (url as Request).url;
      if (new RegExp(`/api/photos/${fixture.id}(\\?|$)`).test(href)) {
        return new Response(JSON.stringify(fixture), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }) as typeof fetch;

    let htmlOut = "";
    const req = { headers: { "user-agent": "facebookexternalhit/1.1" }, url: `/photos/${fixture.id}` };
    const res = { statusCode: 0, setHeader(_k: string, _v: string) {}, end(body: string) { htmlOut = body; } };
    try {
      await ogMiddleware(req as never, res as never, () => {}, "http://localhost:5183", "http://localhost:5183", "http://localhost:5183/opengraph.jpg");
    } finally {
      global.fetch = originalFetch;
    }
    expect(htmlOut).toContain('property="og:description"');
    expect(htmlOut).toContain("a PhotoMatrix member");
    expect(htmlOut).not.toContain("Capture. Connect. Create.");
  });
});

// ---------------------------------------------------------------------------
// Tests: PhotoDetail OG — photo description shown in link preview (#108)
// ---------------------------------------------------------------------------
test.describe("PhotoDetail OG — photo description shown in link preview (#108)", () => {
  const PHOTO_WITH_DESC = {
    id: 204,
    title: "City Reflections",
    imageUrl: "https://placehold.co/400x500/png",
    description: "Puddles mirror the neon lights of a rain-soaked street.",
    photographerId: 42,
    photographerName: "Jane Doe",
    clubId: 7,
    clubName: "City Shooters",
    themeId: 1,
    themeName: "Street",
    createdAt: "2024-05-01T00:00:00.000Z",
    sortOrder: 0,
    likeCount: 0,
    likesCount: 0,
  };

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      const url = route.request().url();
      if (url.includes("__clerk")) { await route.continue(); return; }
      if (new RegExp(`/api/photos/${PHOTO_WITH_DESC.id}(\\?|$)`).test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PHOTO_WITH_DESC) });
        return;
      }
      if (new RegExp(`/api/photos/${PHOTO_WITH_DESC.id}/comments(\\?|$)`).test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
        return;
      }
      if (/\/api\/photos(\?|$)/.test(url)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([PHOTO_WITH_DESC]) });
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
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found (test stub)" }) });
    });

    await page.goto(`/photos/${PHOTO_WITH_DESC.id}`, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await waitForBodyText(page, PHOTO_WITH_DESC.title);
  });

  test("og:description contains the photo's own description (#108)", async ({ page }) => {
    await page.waitForFunction(
      ([prop, text]: [string, string]) =>
        Array.from(document.querySelectorAll<HTMLMetaElement>(`meta[property="${prop}"]`)).some((el) =>
          el.content.includes(text),
        ),
      ["og:description", PHOTO_WITH_DESC.description] as [string, string],
      { timeout: 10_000 },
    );
    const content = await findMetaContent(page, "og:description", PHOTO_WITH_DESC.description);
    expect(content, `Expected og:description to contain "${PHOTO_WITH_DESC.description}"`).toBeTruthy();
    expect(content).toContain(PHOTO_WITH_DESC.description);
    // Must not fall back to the generic phrase.
    expect(content).not.toContain("A photograph by");
    expect(content).not.toContain("Capture. Connect. Create.");
  });

  test("crawler HTML shows the photo description in og:description (#108)", async () => {
    const fixture = PHOTO_WITH_DESC;
    const originalFetch = global.fetch;
    global.fetch = (async (url: string | URL | Request) => {
      const href = typeof url === "string" ? url : url instanceof URL ? url.href : (url as Request).url;
      if (new RegExp(`/api/photos/${fixture.id}(\\?|$)`).test(href)) {
        return new Response(JSON.stringify(fixture), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }) as typeof fetch;

    let htmlOut = "";
    const req = { headers: { "user-agent": "Slackbot 1.0 (+https://api.slack.com/robots)" }, url: `/photos/${fixture.id}` };
    const res = { statusCode: 0, setHeader(_k: string, _v: string) {}, end(body: string) { htmlOut = body; } };
    try {
      await ogMiddleware(req as never, res as never, () => {}, "http://localhost:5183", "http://localhost:5183", "http://localhost:5183/opengraph.jpg");
    } finally {
      global.fetch = originalFetch;
    }
    expect(htmlOut).toContain('property="og:description"');
    // The crawler HTML must contain the actual description text.
    expect(htmlOut).toContain(fixture.description);
    // Must not fall back to the photographer-name-based phrase.
    expect(htmlOut).not.toContain("A photograph by");
  });
});

// ---------------------------------------------------------------------------
// Tests: ClubDetail OG tags
// ---------------------------------------------------------------------------
test.describe("ClubDetail OG meta tags", () => {
  test.beforeEach(async ({ page }) => {
    await stubApiCalls(page);
    await page.goto("/clubs/7", { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    // Wait for the page to render with real fixture data before asserting.
    await waitForBodyText(page, CLUB.name);
  });

  /**
   * document.title is set imperatively via useEffect once the club data loads,
   * bypassing the react-helmet-async v3 + React 19 hoisting bug.
   */
  test("document.title contains the club name", async ({ page }) => {
    await page.waitForFunction(
      (name) => document.title.includes(name),
      CLUB.name,
      { timeout: 10_000 },
    );
    const title = await page.title();
    expect(title).toContain(CLUB.name);
  });

  test("og:title meta tag contains the club name", async ({ page }) => {
    await page.waitForFunction(
      (name) => Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:title"]')).some((el) => el.content.includes(name)),
      CLUB.name,
      { timeout: 10_000 },
    );
    const content = await findMetaContent(page, "og:title", CLUB.name);
    expect(content, `Expected an og:title containing "${CLUB.name}"`).toBeTruthy();
    expect(content).toContain(CLUB.name);
  });

  test("og:image meta tag contains the club logo URL", async ({ page }) => {
    // Wait for the Helmet-injected og:image that carries the fixture logoUrl.
    await page.waitForFunction(
      (url) => Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property="og:image"]')).some((el) => el.content.includes(url)),
      CLUB.logoUrl,
      { timeout: 10_000 },
    );
    const content = await findMetaContent(page, "og:image", CLUB.logoUrl);
    expect(content, `Expected an og:image containing the fixture logoUrl`).toBeTruthy();
    expect(content).toContain(CLUB.logoUrl);
  });
});
