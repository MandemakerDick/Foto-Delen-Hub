/**
 * URL Import routes — admin-only endpoints for scanning a photographer
 * portfolio page and bulk-importing the discovered images into PhotoClub.
 *
 * POST /api/admins/import-from-url/scan   — fetch page, extract images
 * POST /api/admins/import-from-url/import — download + upload + create records
 */
import { Router } from "express";
import * as cheerio from "cheerio";
import { db, photosTable, photographersTable, commentsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { setObjectAclPolicy, ObjectAclPolicy, ObjectPermission } from "../lib/objectAcl";
import { requireAdmin } from "./admins";

const router = Router();
const objectStorageService = new ObjectStorageService();

// ── Helpers ──────────────────────────────────────────────────────────────────

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Convert a potentially relative image src to an absolute URL. */
function resolveImageUrl(src: string, baseUrl: string): string | null {
  if (!src || src.startsWith("data:")) return null;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

/** Best-effort guess at the photographer name from page metadata. */
function guessPhotographerName($: ReturnType<typeof cheerio.load>, pageTitle: string): string | null {
  // Try explicit og:site_name or author meta first
  const author = $('meta[name="author"]').attr("content")?.trim();
  if (author && author.length > 1 && author.length < 80) return author;

  const siteName = $('meta[property="og:site_name"]').attr("content")?.trim();
  if (siteName && siteName.length > 1 && siteName.length < 80) return siteName;

  // Try the page <title> or og:title — strip common suffixes
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || pageTitle.trim();
  if (ogTitle) {
    // Remove trailing " | Portfolio", " – Photography", etc.
    const cleaned = ogTitle
      .replace(/\s*[\|–—-]\s*(photography|portfolio|photos?|images?|prints?).*$/i, "")
      .trim();
    if (cleaned.length > 1 && cleaned.length < 80) return cleaned;
  }

  // Fall back to the first <h1>
  const h1 = $("h1").first().text().trim();
  if (h1 && h1.length > 1 && h1.length < 80) return h1;

  return null;
}

/** Build the shared photo SELECT with all joined fields (same as photos route). */
function buildPhotoSelect() {
  const commentCountSq = db
    .select({ photoId: commentsTable.photoId, commentCount: count().as("comment_count") })
    .from(commentsTable)
    .groupBy(commentsTable.photoId)
    .as("comment_counts");

  return db
    .select({
      id: photosTable.id,
      title: photosTable.title,
      description: photosTable.description,
      imageUrl: photosTable.imageUrl,
      photographerId: photosTable.photographerId,
      photographerName: photographersTable.name,
      photographerAvatarUrl: photographersTable.avatarUrl,
      clubId: photosTable.clubId,
      clubName: sql<string | null>`null`,
      themeId: photosTable.themeId,
      themeName: sql<string | null>`null`,
      likeCount: photosTable.likeCount,
      commentCount: sql<number>`coalesce(${commentCountSq.commentCount}, 0)::int`,
      createdAt: photosTable.createdAt,
    })
    .from(photosTable)
    .leftJoin(photographersTable, eq(photosTable.photographerId, photographersTable.id))
    .leftJoin(commentCountSq, eq(photosTable.id, commentCountSq.photoId));
}

function mapPhoto(p: { createdAt: Date; [key: string]: unknown }) {
  return { ...p, createdAt: p.createdAt.toISOString() };
}

// ── POST /api/admins/import-from-url/scan ─────────────────────────────────────

router.post("/admins/import-from-url/scan", requireAdmin, async (req: any, res) => {
  const { url } = req.body as { url?: string };

  if (!url?.trim()) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Invalid protocol");
  } catch {
    res.status(400).json({ error: "Invalid URL — must start with http:// or https://" });
    return;
  }

  let html: string;
  try {
    const response = await fetch(parsedUrl.href, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      res.status(400).json({ error: `Page returned HTTP ${response.status}` });
      return;
    }
    const ct = response.headers.get("content-type") ?? "";
    if (!ct.includes("html")) {
      res.status(400).json({ error: "URL does not point to an HTML page" });
      return;
    }
    html = await response.text();
  } catch (err: any) {
    req.log?.error({ err }, "Failed to fetch portfolio URL");
    res.status(400).json({ error: "Could not fetch the page — check the URL and try again" });
    return;
  }

  const $ = cheerio.load(html);
  const pageTitle = $("title").first().text().trim();
  const photographerName = guessPhotographerName($, pageTitle);

  // Collect all <img> srcs, resolve to absolute, deduplicate
  const seen = new Set<string>();
  const images: Array<{ src: string; alt: string | null; width: number | null; height: number | null }> = [];

  $("img").each((_, el) => {
    // Skip images inside structural/navigation elements — they're almost always
    // site logos, nav icons, or footer decorations, not portfolio photos.
    if ($(el).closest("header, nav, footer").length > 0) return;

    const rawSrc =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-lazy-src") ||
      $(el).attr("data-original") ||
      "";

    const src = resolveImageUrl(rawSrc, parsedUrl.href);
    if (!src || seen.has(src)) return;
    seen.add(src);

    const widthAttr = $(el).attr("width");
    const heightAttr = $(el).attr("height");
    const width = widthAttr ? parseInt(widthAttr, 10) : null;
    const height = heightAttr ? parseInt(heightAttr, 10) : null;

    // Filter out tiny images that are clearly icons/decorations (when dims are known)
    if (width !== null && width < 100) return;
    if (height !== null && height < 100) return;

    images.push({
      src,
      alt: $(el).attr("alt")?.trim() || null,
      width: isNaN(width!) ? null : width,
      height: isNaN(height!) ? null : height,
    });
  });

  res.json({ url: parsedUrl.href, photographerName, images });
});

// ── POST /api/admins/import-from-url/import ───────────────────────────────────

router.post("/admins/import-from-url/import", requireAdmin, async (req: any, res) => {
  const body = req.body as {
    images?: Array<{ src: string; title: string; description?: string | null }>;
    photographerId?: number | null;
    photographerName?: string | null;
    clubId?: number | null;
    themeId?: number | null;
  };

  const images = body.images;
  if (!images || images.length === 0) {
    res.status(400).json({ error: "At least one image is required" });
    return;
  }

  // Resolve photographer: use existing ID or create a new one from name
  let photographerId: number | null = body.photographerId ?? null;

  if (!photographerId && body.photographerName?.trim()) {
    const name = body.photographerName.trim();
    const [newPh] = await db
      .insert(photographersTable)
      .values({ name, clubId: body.clubId ?? null, themeId1: null, themeId2: null })
      .returning({ id: photographersTable.id });
    photographerId = newPh.id;
  }

  const importedPhotos: ReturnType<typeof mapPhoto>[] = [];
  let failed = 0;

  for (const img of images) {
    try {
      // 1. Download the image
      const response = await fetch(img.src, {
        headers: { "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      if (!contentType.startsWith("image/")) throw new Error(`Not an image (${contentType})`);

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1024) throw new Error("File too small — probably not a photo");

      // 2. Upload to object storage
      const objectPath = await objectStorageService.uploadBufferAsEntity(buffer, contentType);

      // 3. Set ACL: private (requires Clerk auth to serve)
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        await setObjectAclPolicy(objectFile, {
          visibility: "private",
          permission: ObjectPermission.READ,
        } as unknown as ObjectAclPolicy);
      } catch {
        // ACL setting is best-effort; proceed even if it fails
      }

      const imageUrl = `/api/storage${objectPath}`;

      // 4. Create photo record
      const title = img.title?.trim() || "Untitled";
      const [photo] = await db
        .insert(photosTable)
        .values({
          title,
          description: img.description?.trim() || null,
          imageUrl,
          photographerId: photographerId ?? null,
          clubId: body.clubId ?? null,
          themeId: body.themeId ?? null,
        })
        .returning();

      // Re-fetch with full joins
      const rows = await buildPhotoSelect().where(eq(photosTable.id, photo.id));
      if (rows[0]) importedPhotos.push(mapPhoto(rows[0]));
    } catch (err: any) {
      req.log?.warn({ err, src: img.src }, "Failed to import image");
      failed++;
    }
  }

  res.json({ imported: importedPhotos.length, failed, photos: importedPhotos });
});

export default router;
