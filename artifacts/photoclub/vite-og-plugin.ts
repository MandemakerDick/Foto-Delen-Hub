/**
 * vite-og-plugin.ts
 *
 * A Vite plugin that intercepts requests from social-media crawlers
 * (Slack, WhatsApp, Discord, Twitter/X, Facebook, LinkedIn, …) and
 * returns a lightweight HTML page containing the correct og:title,
 * og:description, and og:image meta tags for photographer and club
 * detail pages.
 *
 * Regular browsers receive the normal SPA (index.html) because they
 * don't match the crawler user-agent list.
 *
 * Works in both the Vite dev server (configureServer) and the Vite
 * preview server (configurePreviewServer).
 */

import type { Plugin, ViteDevServer, PreviewServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

/** User-agent patterns that belong to social-media / link-preview crawlers. */
const CRAWLER_RE =
  /slackbot|facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|googlebot|bingbot|applebot|embedly|outbrain|pinterest|quora link preview|rogerbot|showyoubot|vkshare|w3c_validator|redditbot|iframely/i;

/** Routes we want to enrich — captures the numeric id as group 1. */
const PHOTOGRAPHER_RE = /^\/photographers\/(\d+)(?:\/.*)?$/;
const CLUB_RE = /^\/clubs\/(\d+)(?:\/.*)?$/;
const PHOTO_RE = /^\/photos\/(\d+)(?:\/.*)?$/;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOgHtml(opts: {
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
}): string {
  const { title, description, imageUrl, canonicalUrl } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <meta http-equiv="refresh" content="0; url=${escapeHtml(canonicalUrl)}" />
</head>
<body>
  <a href="${escapeHtml(canonicalUrl)}">${escapeHtml(title)}</a>
</body>
</html>`;
}

/** Make an image URL absolute. Relative paths (starting with /) are resolved
 *  against the public apiBase; already-absolute URLs are returned unchanged. */
function resolveImageUrl(url: string | null | undefined, apiBase: string, fallback: string): string {
  if (!url) return fallback;
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function ogMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  apiBase: string,
  apiInternal: string,
  fallbackImageUrl: string,
) {
  const ua = req.headers["user-agent"] ?? "";
  if (!CRAWLER_RE.test(ua)) {
    return next();
  }

  const rawUrl = req.url ?? "/";
  const pathname = rawUrl.split("?")[0];

  const photographerMatch = PHOTOGRAPHER_RE.exec(pathname);
  const clubMatch = CLUB_RE.exec(pathname);
  const photoMatch = PHOTO_RE.exec(pathname);

  if (!photographerMatch && !clubMatch && !photoMatch) {
    return next();
  }

  const canonicalUrl = `${apiBase}${rawUrl}`;

  try {
    let ogTitle = "PhotoMatrix";
    let ogDescription =
      "A community for photography clubs — share photos, discover photographers.";
    let ogImage = fallbackImageUrl;

    if (photographerMatch) {
      const id = photographerMatch[1];
      const resp = await fetch(`${apiInternal}/api/photographers/${id}`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          name?: string;
          bio?: string | null;
          avatarUrl?: string | null;
        };
        ogTitle = `${data.name ?? "Photographer"} — PhotoMatrix`;
        ogDescription =
          data.bio ?? `Portfolio of ${data.name ?? "a photographer"} on PhotoMatrix`;
        ogImage = resolveImageUrl(data.avatarUrl, apiBase, fallbackImageUrl);
      }
    } else if (clubMatch) {
      const id = clubMatch[1];
      const resp = await fetch(`${apiInternal}/api/clubs/${id}`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          name?: string;
          description?: string | null;
          logoUrl?: string | null;
        };
        ogTitle = `${data.name ?? "Club"} — PhotoMatrix`;
        ogDescription = data.description ?? `${data.name ?? "A club"} on PhotoMatrix`;
        ogImage = resolveImageUrl(data.logoUrl, apiBase, fallbackImageUrl);
      }
    } else if (photoMatch) {
      const id = photoMatch[1];
      const resp = await fetch(`${apiInternal}/api/photos/${id}`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          title?: string;
          description?: string | null;
          imageUrl?: string | null;
          photographerName?: string | null;
        };
        ogTitle = `${data.title ?? "Photo"} — PhotoMatrix`;
        // Mirror the client-side fallback in photo-detail.tsx line 273 exactly:
        // photo.description ?? `A photograph by ${photo.photographerName ?? "a PhotoMatrix member"}`
        ogDescription =
          data.description ??
          `A photograph by ${data.photographerName ?? "a PhotoMatrix member"}`;
        ogImage = resolveImageUrl(data.imageUrl, apiBase, fallbackImageUrl);
      }
    }

    const html = buildOgHtml({
      title: ogTitle,
      description: ogDescription,
      imageUrl: ogImage,
      canonicalUrl,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.statusCode = 200;
    res.end(html);
  } catch {
    // On any error fall through to the normal SPA handling.
    next();
  }
}

function buildMiddleware(apiBase: string, apiInternal: string, fallbackImageUrl: string) {
  return (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => ogMiddleware(req, res, next, apiBase, apiInternal, fallbackImageUrl);
}

export function ogPlugin(opts: {
  /** Public base URL of the site, e.g. "https://abc.replit.dev". Used for
   *  the canonical redirect URL and to resolve relative image paths. */
  apiBase: string;
  /** Internal base URL for server-to-server API calls, e.g. "http://localhost:8080".
   *  Defaults to apiBase when not provided. */
  apiInternal?: string;
  /** Absolute URL of the fallback OG image. */
  fallbackImageUrl: string;
}): Plugin {
  const { apiBase, fallbackImageUrl } = opts;
  const apiInternal = opts.apiInternal ?? apiBase;

  return {
    name: "vite-og-plugin",
    configureServer(server: ViteDevServer) {
      // Runs before Vite's own middleware so we intercept first.
      server.middlewares.use(buildMiddleware(apiBase, apiInternal, fallbackImageUrl));
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(buildMiddleware(apiBase, apiInternal, fallbackImageUrl));
    },
  };
}
