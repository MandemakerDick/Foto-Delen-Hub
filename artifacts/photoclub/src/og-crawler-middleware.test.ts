/**
 * Unit tests for the vite-og-plugin crawler middleware.
 *
 * The ogMiddleware intercepts requests from social-media crawlers and returns
 * a lightweight HTML page with the correct OG meta tags for photographer and
 * club detail pages.  These tests mock the internal API fetch so they run
 * without a live server and verify the exact title, og:title, and og:image
 * values that crawlers receive when they expand a shared link.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ogMiddleware, escapeHtml } from "../vite-og-plugin";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLACKBOT_UA =
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)";
const DISCORD_UA = "Discordbot/2.0";
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

const API_BASE = "https://example.replit.dev";
const API_INTERNAL = "http://localhost:19999"; // port unlikely to conflict
const FALLBACK_IMAGE = `${API_BASE}/opengraph.jpg`;

// ---------------------------------------------------------------------------
// Fixture data (mirrors the e2e fixtures)
// ---------------------------------------------------------------------------

const PHOTOGRAPHER = {
  id: 42,
  name: "Jane Doe",
  bio: "Street and portrait photographer.",
  avatarUrl: "https://placehold.co/200x200/png",
};

const CLUB = {
  id: 7,
  name: "City Shooters",
  description: "Urban photography collective.",
  logoUrl: "https://placehold.co/300x300/png",
};

// ---------------------------------------------------------------------------
// Helpers for creating minimal mock IncomingMessage / ServerResponse
// ---------------------------------------------------------------------------

function makeReq(url: string, ua: string): IncomingMessage {
  return {
    url,
    headers: { "user-agent": ua },
  } as unknown as IncomingMessage;
}

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader(name: string, value: string): void;
  end(data: string): void;
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(data) {
      this.body = data;
    },
  };
  return res;
}

/** Parse meta tag attribute from raw HTML, e.g. property="og:title" content="..." */
function parseMetaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property="${property}"[^>]+content="([^"]*)"`,
    "i",
  );
  const m = re.exec(html);
  if (m) return m[1];
  // Try reverse attribute order: content="..." property="..."
  const re2 = new RegExp(
    `<meta[^>]+content="([^"]*)"[^>]+property="${property}"`,
    "i",
  );
  const m2 = re2.exec(html);
  return m2 ? m2[1] : null;
}

/** Parse <title> text content from raw HTML. */
function parseTitle(html: string): string | null {
  const m = /<title>([^<]*)<\/title>/i.exec(html);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Test setup: mock global fetch before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helper: make fetch return JSON for the given entity
// ---------------------------------------------------------------------------

function mockFetchOk(data: unknown) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetch404() {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: "Not found" }),
  } as Response);
}

// ---------------------------------------------------------------------------
// Photographer detail page — crawler UA
// ---------------------------------------------------------------------------

describe("ogMiddleware — photographer detail — crawler UA", () => {
  it("returns 200 with og HTML, not calling next()", async () => {
    mockFetchOk(PHOTOGRAPHER);
    const req = makeReq(`/photographers/${PHOTOGRAPHER.id}`, SLACKBOT_UA);
    const res = makeRes();
    const next = vi.fn();

    await ogMiddleware(
      req,
      res as unknown as ServerResponse,
      next,
      API_BASE,
      API_INTERNAL,
      FALLBACK_IMAGE,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("<title> contains the photographer name and site name", async () => {
    mockFetchOk(PHOTOGRAPHER);
    const req = makeReq(`/photographers/${PHOTOGRAPHER.id}`, SLACKBOT_UA);
    const res = makeRes();
    await ogMiddleware(req, res as unknown as ServerResponse, vi.fn(), API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    const title = parseTitle(res.body);
    expect(title, "<title> must be present").toBeTruthy();
    expect(title).toContain(PHOTOGRAPHER.name);
    expect(title).toContain("PhotoMatrix");
  });

  it("og:title contains the photographer name", async () => {
    mockFetchOk(PHOTOGRAPHER);
    const req = makeReq(`/photographers/${PHOTOGRAPHER.id}`, DISCORD_UA);
    const res = makeRes();
    await ogMiddleware(req, res as unknown as ServerResponse, vi.fn(), API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    const ogTitle = parseMetaContent(res.body, "og:title");
    expect(ogTitle, "og:title must be present").toBeTruthy();
    expect(ogTitle).toContain(PHOTOGRAPHER.name);
  });

  it("og:image contains the fixture avatarUrl", async () => {
    mockFetchOk(PHOTOGRAPHER);
    const req = makeReq(`/photographers/${PHOTOGRAPHER.id}`, SLACKBOT_UA);
    const res = makeRes();
    await ogMiddleware(req, res as unknown as ServerResponse, vi.fn(), API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    const ogImage = parseMetaContent(res.body, "og:image");
    expect(ogImage, "og:image must be present").toBeTruthy();
    // Must reflect the fixture's avatarUrl, not the generic fallback
    expect(ogImage).toBe(escapeHtml(PHOTOGRAPHER.avatarUrl));
  });

  it("fetches from the correct internal API URL", async () => {
    mockFetchOk(PHOTOGRAPHER);
    const req = makeReq(`/photographers/${PHOTOGRAPHER.id}`, SLACKBOT_UA);
    const res = makeRes();
    await ogMiddleware(req, res as unknown as ServerResponse, vi.fn(), API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_INTERNAL}/api/photographers/${PHOTOGRAPHER.id}`,
    );
  });

  it("falls back to generic OG when photographer is not found (API 404)", async () => {
    mockFetch404();
    const req = makeReq("/photographers/9999", SLACKBOT_UA);
    const res = makeRes();
    const next = vi.fn();
    await ogMiddleware(req, res as unknown as ServerResponse, next, API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    // Still returns the OG page (with default values), does not call next
    expect(next).not.toHaveBeenCalled();
    const ogImage = parseMetaContent(res.body, "og:image");
    expect(ogImage).toBe(escapeHtml(FALLBACK_IMAGE));
    const title = parseTitle(res.body);
    expect(title).toContain("PhotoMatrix");
  });

  it("passes through (calls next) for a non-crawler user-agent", async () => {
    const req = makeReq(`/photographers/${PHOTOGRAPHER.id}`, BROWSER_UA);
    const res = makeRes();
    const next = vi.fn();
    await ogMiddleware(req, res as unknown as ServerResponse, next, API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    expect(next).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
    expect(res.body).toBe(""); // no HTML written
  });
});

// ---------------------------------------------------------------------------
// Club detail page — crawler UA
// ---------------------------------------------------------------------------

describe("ogMiddleware — club detail — crawler UA", () => {
  it("returns 200 with og HTML, not calling next()", async () => {
    mockFetchOk(CLUB);
    const req = makeReq(`/clubs/${CLUB.id}`, SLACKBOT_UA);
    const res = makeRes();
    const next = vi.fn();

    await ogMiddleware(
      req,
      res as unknown as ServerResponse,
      next,
      API_BASE,
      API_INTERNAL,
      FALLBACK_IMAGE,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("<title> contains the club name and site name", async () => {
    mockFetchOk(CLUB);
    const req = makeReq(`/clubs/${CLUB.id}`, SLACKBOT_UA);
    const res = makeRes();
    await ogMiddleware(req, res as unknown as ServerResponse, vi.fn(), API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    const title = parseTitle(res.body);
    expect(title, "<title> must be present").toBeTruthy();
    expect(title).toContain(CLUB.name);
    expect(title).toContain("PhotoMatrix");
  });

  it("og:title contains the club name", async () => {
    mockFetchOk(CLUB);
    const req = makeReq(`/clubs/${CLUB.id}`, DISCORD_UA);
    const res = makeRes();
    await ogMiddleware(req, res as unknown as ServerResponse, vi.fn(), API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    const ogTitle = parseMetaContent(res.body, "og:title");
    expect(ogTitle, "og:title must be present").toBeTruthy();
    expect(ogTitle).toContain(CLUB.name);
  });

  it("og:image contains the fixture logoUrl", async () => {
    mockFetchOk(CLUB);
    const req = makeReq(`/clubs/${CLUB.id}`, SLACKBOT_UA);
    const res = makeRes();
    await ogMiddleware(req, res as unknown as ServerResponse, vi.fn(), API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    const ogImage = parseMetaContent(res.body, "og:image");
    expect(ogImage, "og:image must be present").toBeTruthy();
    // Must reflect the fixture's logoUrl, not the generic fallback
    expect(ogImage).toBe(escapeHtml(CLUB.logoUrl));
  });

  it("fetches from the correct internal API URL", async () => {
    mockFetchOk(CLUB);
    const req = makeReq(`/clubs/${CLUB.id}`, SLACKBOT_UA);
    const res = makeRes();
    await ogMiddleware(req, res as unknown as ServerResponse, vi.fn(), API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      `${API_INTERNAL}/api/clubs/${CLUB.id}`,
    );
  });

  it("falls back to generic OG when club is not found (API 404)", async () => {
    mockFetch404();
    const req = makeReq("/clubs/9999", SLACKBOT_UA);
    const res = makeRes();
    const next = vi.fn();
    await ogMiddleware(req, res as unknown as ServerResponse, next, API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    expect(next).not.toHaveBeenCalled();
    const ogImage = parseMetaContent(res.body, "og:image");
    expect(ogImage).toBe(escapeHtml(FALLBACK_IMAGE));
    const title = parseTitle(res.body);
    expect(title).toContain("PhotoMatrix");
  });

  it("passes through (calls next) for a non-crawler user-agent", async () => {
    const req = makeReq(`/clubs/${CLUB.id}`, BROWSER_UA);
    const res = makeRes();
    const next = vi.fn();
    await ogMiddleware(req, res as unknown as ServerResponse, next, API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    expect(next).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
    expect(res.body).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Non-detail routes — always pass through even for crawlers
// ---------------------------------------------------------------------------

describe("ogMiddleware — non-detail routes", () => {
  it("passes through for the home page", async () => {
    const req = makeReq("/", SLACKBOT_UA);
    const res = makeRes();
    const next = vi.fn();
    await ogMiddleware(req, res as unknown as ServerResponse, next, API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    expect(next).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it("passes through for the photos gallery", async () => {
    const req = makeReq("/photos", SLACKBOT_UA);
    const res = makeRes();
    const next = vi.fn();
    await ogMiddleware(req, res as unknown as ServerResponse, next, API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    expect(next).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Error resilience — fetch rejection should fall through to SPA
// ---------------------------------------------------------------------------

describe("ogMiddleware — error resilience", () => {
  it("calls next() when the internal API fetch throws", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const req = makeReq(`/photographers/${PHOTOGRAPHER.id}`, SLACKBOT_UA);
    const res = makeRes();
    const next = vi.fn();
    await ogMiddleware(req, res as unknown as ServerResponse, next, API_BASE, API_INTERNAL, FALLBACK_IMAGE);

    expect(next).toHaveBeenCalledOnce();
    expect(res.body).toBe("");
  });
});
