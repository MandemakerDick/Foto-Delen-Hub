import { Router } from "express";
import { db, photosTable, clubsTable, themesTable, commentsTable, photographersTable, photographerClubsTable, photoLikesTable, photoAiAnalysesTable } from "@workspace/db";
import { eq, ilike, desc, asc, sql, count, and, isNull, or, inArray, gte } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  ListPhotosQueryParams,
  CreatePhotoBody,
  ListRecentPhotosQueryParams,
  ListGalleryPhotosQueryParams,
  ListGalleryPhotosResponse,
  GetPhotoParams,
  UpdatePhotoParams,
  UpdatePhotoBody,
  DeletePhotoParams,
  ReorderPhotosBody,
} from "@workspace/api-zod";
import { getPhotographerIdForClerkUser } from "../lib/db-helpers";
import { sendPhotoUploadConfirmation } from "../lib/notifications";
import { requireAdmin } from "./admins";
import {
  enqueuePhotoAiAnalysis,
  expandPhotoSearchQuery,
  enqueuePhotosMissingAiAnalysis,
} from "../lib/photo-ai";

const router = Router();

/**
 * Build the shared photo SELECT query with all joined fields.
 *
 * Every photo endpoint returns the same shape (with photographer name/avatar,
 * club name, theme name, like count, and comment count), so we centralise the
 * query here and let callers chain .where() / .orderBy() / .limit() on top.
 *
 * Comment count is aggregated via a subquery grouped by photoId.
 * The ::int cast is required because Postgres returns count() as bigint,
 * which the pg driver serialises as a string — casting forces a numeric result.
 */
export function buildPhotoSelect() {
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
      clubName: clubsTable.name,
      themeId: photosTable.themeId,
      themeName: themesTable.name,
      aiTags: photoAiAnalysesTable.tags,
      aiDescription: photoAiAnalysesTable.description,
      aiStatus: photoAiAnalysesTable.status,
       aiSuggestedThemeId: photoAiAnalysesTable.themeSuggestionId,
       aiSuggestedThemeConfidence: photoAiAnalysesTable.themeSuggestionConfidence,
       aiSuggestedThemeReason: photoAiAnalysesTable.themeSuggestionReason,
       aiThemeSuggestionStatus: photoAiAnalysesTable.themeSuggestionStatus,
       aiThemeReviewOutcome: photoAiAnalysesTable.themeReviewOutcome,
       aiThemeReviewedAt: photoAiAnalysesTable.themeReviewedAt,
      likeCount: photosTable.likeCount,
      commentCount: sql<number>`coalesce(${commentCountSq.commentCount}, 0)::int`,
       sortOrder: photosTable.sortOrder,
      createdAt: photosTable.createdAt,
    })
    .from(photosTable)
    .leftJoin(photographersTable, eq(photosTable.photographerId, photographersTable.id))
    .leftJoin(clubsTable, eq(photosTable.clubId, clubsTable.id))
    .leftJoin(themesTable, eq(photosTable.themeId, themesTable.id))
    .leftJoin(photoAiAnalysesTable, eq(photoAiAnalysesTable.photoId, photosTable.id))
    .leftJoin(commentCountSq, eq(photosTable.id, commentCountSq.photoId));
}

/** Serialise a photo row — convert the Date to an ISO string for JSON output. */
export function mapPhoto(p: { createdAt: Date; [key: string]: unknown }) {
  return { ...p, createdAt: p.createdAt.toISOString() };
}

export type GalleryQuery = {
  search?: string;
  clubIds?: string;
  themeIds?: string;
  photographerId?: number;
  from?: Date;
  to?: Date;
  group: "none" | "club" | "photographer" | "theme";
  sort: "newest" | "oldest" | "photographer" | "likes" | "comments" | "random";
  seed?: number;
  cursor?: string;
  limit: number;
};

function parseGalleryDate(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date("") : date;
}

export function parseGalleryIds(value: string | undefined) {
  if (!value) return [];
  const ids = value.split(",").map((part) => Number(part.trim()));
  return ids.every((id) => Number.isSafeInteger(id) && id > 0) ? [...new Set(ids)] : undefined;
}

export function galleryCursor(query: GalleryQuery, offset: number) {
  const fingerprint = {
    search: query.search ?? "",
    clubIds: query.clubIds ?? "",
    themeIds: query.themeIds ?? "",
    photographerId: query.photographerId ?? null,
    from: query.from?.toISOString() ?? null,
    to: query.to?.toISOString() ?? null,
    group: query.group,
    sort: query.sort,
    seed: query.seed ?? 0,
  };
  return Buffer.from(JSON.stringify({ v: 1, offset, fingerprint })).toString("base64url");
}

export function parseGalleryCursor(cursor: string | undefined, query: GalleryQuery) {
  if (!cursor) return 0;
  try {
    // Re-encoding guards against non-canonical base64url input.
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return undefined;
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      parsed?.v !== 1 ||
      !Number.isSafeInteger(parsed.offset) ||
      parsed.offset < 0 ||
      JSON.stringify(parsed.fingerprint) !==
        JSON.stringify(JSON.parse(Buffer.from(galleryCursor(query, 0), "base64url").toString("utf8")).fingerprint)
    ) {
      return undefined;
    }
    return parsed.offset;
  } catch {
    return undefined;
  }
}

// GET /api/photos/gallery — paginated Gallery contract.  Keep /photos above as
// the legacy, single-filter endpoint used by existing clients.
router.get("/photos/gallery", async (req, res) => {
  const queryResult = ListGalleryPhotosQueryParams.safeParse({
    search: req.query.search,
    clubIds: req.query.clubIds,
    themeIds: req.query.themeIds,
    photographerId: req.query.photographerId,
    from: parseGalleryDate(req.query.from),
    to: parseGalleryDate(req.query.to),
    group: req.query.group,
    sort: req.query.sort,
    seed: req.query.seed,
    cursor: req.query.cursor,
    limit: req.query.limit,
  });
  if (!queryResult.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const query: GalleryQuery = queryResult.data;
  const clubIds = parseGalleryIds(query.clubIds);
  const themeIds = parseGalleryIds(query.themeIds);
  const offset = parseGalleryCursor(query.cursor, query);
  if (!clubIds || !themeIds || offset === undefined) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  const conditions = [];
  if (clubIds.length) conditions.push(inArray(photosTable.clubId, clubIds));
  if (themeIds.length) conditions.push(inArray(photosTable.themeId, themeIds));
  if (query.photographerId) conditions.push(eq(photosTable.photographerId, query.photographerId));
  // Dates are calendar dates in UTC: `to` includes its complete UTC day.
  if (query.from) {
    const from = new Date(Date.UTC(query.from.getUTCFullYear(), query.from.getUTCMonth(), query.from.getUTCDate()));
    conditions.push(gte(photosTable.createdAt, from));
  }
  if (query.to) {
    const to = new Date(Date.UTC(query.to.getUTCFullYear(), query.to.getUTCMonth(), query.to.getUTCDate() + 1));
    conditions.push(sql`${photosTable.createdAt} < ${to}`);
  }
  if (query.search?.trim()) {
    let terms = [query.search.trim()];
    try {
      terms = await expandPhotoSearchQuery(query.search.trim());
    } catch (error) {
      req.log.warn({ err: error }, "Semantic photo search unavailable; using exact search");
    }
    conditions.push(
      or(
        ...terms.map((term) => {
          const pattern = `%${term}%`;
          return or(
            ilike(photosTable.title, pattern),
            ilike(photosTable.description, pattern),
            ilike(photographersTable.name, pattern),
            ilike(themesTable.name, pattern),
            ilike(photoAiAnalysesTable.description, pattern),
            sql`${photoAiAnalysesTable.tags}::text ILIKE ${pattern}`,
          );
        }),
      ),
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const ordering = [];
  if (query.group === "club") ordering.push(asc(clubsTable.name));
  if (query.group === "photographer") ordering.push(asc(photographersTable.name));
  if (query.group === "theme") ordering.push(asc(themesTable.name));
  if (query.sort === "newest") ordering.push(desc(photosTable.createdAt));
  if (query.sort === "oldest") ordering.push(asc(photosTable.createdAt));
  if (query.sort === "photographer") {
    ordering.push(
      asc(photographersTable.name),
      sql`${photosTable.sortOrder} ASC NULLS LAST`,
      desc(photosTable.createdAt),
    );
  }
  if (query.sort === "likes") ordering.push(desc(photosTable.likeCount), desc(photosTable.createdAt));
  if (query.sort === "comments") ordering.push(desc(sql`coalesce(comment_counts.comment_count, 0)`), desc(photosTable.createdAt));
  if (query.sort === "random") {
    // md5 gives a stable pseudo-random ordering for a supplied (or zero) seed.
    ordering.push(sql`md5(${query.seed ?? 0}::text || ${photosTable.id}::text) ASC`);
  }
  ordering.push(asc(photosTable.id));

  const totalQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(photosTable)
    .leftJoin(photographersTable, eq(photosTable.photographerId, photographersTable.id))
    .leftJoin(clubsTable, eq(photosTable.clubId, clubsTable.id))
    .leftJoin(themesTable, eq(photosTable.themeId, themesTable.id))
    .leftJoin(photoAiAnalysesTable, eq(photoAiAnalysesTable.photoId, photosTable.id));
  const totalRows = where ? await totalQuery.where(where) : await totalQuery;
  let photos = buildPhotoSelect();
  if (where) photos = photos.where(where) as typeof photos;
  const rows = await photos.orderBy(...ordering).limit(query.limit + 1).offset(offset);
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit).map(mapPhoto);
  const response = {
    items,
    total: Number(totalRows[0]?.total ?? 0),
    nextCursor: hasMore ? galleryCursor(query, offset + query.limit) : null,
    hasMore,
  };
  const validated = ListGalleryPhotosResponse.safeParse(response);
  if (!validated.success) {
    req.log.error({ err: validated.error }, "Gallery response failed contract validation");
    res.status(500).json({ error: "Could not build gallery response" });
    return;
  }
  res.json(validated.data);
});

// GET /api/photos/recent — most recent N photos (default 20)
router.get("/photos/recent", async (req, res) => {
  const query = ListRecentPhotosQueryParams.safeParse({
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  if (!query.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const limit = query.data.limit ?? 20;
  const photos = await buildPhotoSelect().orderBy(desc(photosTable.createdAt)).limit(limit);
  res.json(photos.map(mapPhoto));
});

// GET /api/photos — list photos, optionally filtered by one criterion at a time.
// Filters are mutually exclusive; if more than one is supplied the first match wins:
// search → clubId → themeId → photographerId
router.get("/photos", async (req, res) => {
  const query = ListPhotosQueryParams.safeParse({
    search: req.query.search,
    clubId: req.query.clubId ? Number(req.query.clubId) : undefined,
    themeId: req.query.themeId ? Number(req.query.themeId) : undefined,
    photographerId: req.query.photographerId ? Number(req.query.photographerId) : undefined,
  });
  if (!query.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { search, clubId, themeId, photographerId } = query.data;

  let q = buildPhotoSelect();
  if (search) {
    const pattern = `%${search}%`;
    const exactSearchCondition = or(
      ilike(photosTable.title, pattern),
      ilike(photosTable.description, pattern),
      ilike(photoAiAnalysesTable.description, pattern),
      sql`${photoAiAnalysesTable.tags}::text ILIKE ${pattern}`,
    );

    let expandedTerms = [search];
    try {
      expandedTerms = await expandPhotoSearchQuery(search);
    } catch (error) {
      req.log.warn({ err: error }, "Semantic photo search unavailable; using exact search");
    }

    const expandedTermConditions = expandedTerms.map((term) => {
      const expandedPattern = `%${term}%`;
      return or(
        ilike(photosTable.title, expandedPattern),
        ilike(photosTable.description, expandedPattern),
        ilike(photoAiAnalysesTable.description, expandedPattern),
        sql`${photoAiAnalysesTable.tags}::text ILIKE ${expandedPattern}`,
      );
    });
    q = q.where(or(...expandedTermConditions)) as typeof q;
    const relevanceScore = sql<number>`${sql.join(
      expandedTermConditions.map(
        (condition) => sql`CASE WHEN ${condition} THEN 1 ELSE 0 END`,
      ),
      sql` + `,
    )}`;

    const photos = photographerId
      ? await q.orderBy(
          sql`CASE WHEN ${exactSearchCondition} THEN 0 ELSE 1 END`,
          desc(relevanceScore),
          sql`${photosTable.sortOrder} ASC NULLS LAST`,
          desc(photosTable.createdAt),
        )
      : await q.orderBy(
          sql`CASE WHEN ${exactSearchCondition} THEN 0 ELSE 1 END`,
          desc(relevanceScore),
          desc(photosTable.createdAt),
        );
    res.json(photos.map(mapPhoto));
    return;
  } else if (clubId) {
    q = q.where(eq(photosTable.clubId, clubId)) as typeof q;
  } else if (themeId) {
    q = q.where(eq(photosTable.themeId, themeId)) as typeof q;
  } else if (photographerId) {
    q = q.where(eq(photosTable.photographerId, photographerId)) as typeof q;
  }

  const photos = photographerId
    ? await q.orderBy(sql`${photosTable.sortOrder} ASC NULLS LAST`, desc(photosTable.createdAt))
    : await q.orderBy(desc(photosTable.createdAt));
  res.json(photos.map(mapPhoto));
});

// POST /api/photos — upload a new photo.
// Clerk users: photographerId is resolved automatically from their linked profile.
// Session admins: must supply photographerId explicitly in the request body.
router.post("/photos", async (req: any, res) => {
  const { userId } = getAuth(req);
  const sessionAdminId = req.session?.adminId as number | undefined;

  let photographerId: number | undefined;

  if (userId) {
    const pid = await getPhotographerIdForClerkUser(userId);
    if (!pid) {
      res.status(403).json({ error: "Link a photographer profile before uploading" });
      return;
    }
    photographerId = pid;
  } else if (sessionAdminId) {
    const pid = Number(req.body?.photographerId);
    if (!pid || isNaN(pid)) {
      res.status(400).json({ error: "photographerId is required when uploading as admin" });
      return;
    }
    photographerId = pid;
  } else {
    res.status(401).json({ error: "Sign in to upload photos" });
    return;
  }

  const body = CreatePhotoBody.safeParse({ ...req.body, photographerId });
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  // Clerk photographers (non-admins) may only upload to clubs they belong to.
  if (userId && !sessionAdminId && body.data.clubId) {
    const membership = await db
      .select({ one: sql<number>`1` })
      .from(photographerClubsTable)
      .where(
        and(
          eq(photographerClubsTable.photographerId, photographerId!),
          eq(photographerClubsTable.clubId, body.data.clubId),
        ),
      );
    if (!membership.length) {
      res.status(403).json({ error: "You can only upload photos to clubs you are a member of" });
      return;
    }
  }

  const [photo] = await db.insert(photosTable).values(body.data).returning();
  // Re-fetch via buildPhotoSelect so the response includes all joined fields
  const rows = await buildPhotoSelect().where(eq(photosTable.id, photo.id));
  res.status(201).json(mapPhoto(rows[0]));

  void enqueuePhotoAiAnalysis(photo.id, { autoApplyTheme: true }).catch((error) => {
    req.log.warn({ err: error, photoId: photo.id }, "Could not queue AI photo analysis");
  });

  // Email delivery must never make a successful upload fail.
  void sendPhotoUploadConfirmation(photographerId!, photo.title);
});

// POST /api/photos/ai/backfill — queue unprocessed or failed photos (admin only).
router.post("/photos/ai/backfill", requireAdmin, async (req, res) => {
  const requestedLimit = Number(req.body?.limit ?? 25);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 25;
  const photoIds = await enqueuePhotosMissingAiAnalysis(limit);
  res.status(202).json({ queued: photoIds.length, photoIds });
});

// POST /api/photos/:id/ai-theme/accept — apply a pending AI theme suggestion (admin only).
router.post("/photos/:id/ai-theme/accept", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid photo id" });
    return;
  }

  const [row] = await db
    .select({
      photoId: photosTable.id,
      themeId: photosTable.themeId,
      suggestedThemeId: photoAiAnalysesTable.themeSuggestionId,
      suggestionStatus: photoAiAnalysesTable.themeSuggestionStatus,
    })
    .from(photosTable)
    .leftJoin(photoAiAnalysesTable, eq(photoAiAnalysesTable.photoId, photosTable.id))
    .where(eq(photosTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  if (row.themeId != null) {
    res.status(409).json({ error: "Photo already has a theme" });
    return;
  }
  if (
    row.suggestedThemeId == null ||
    row.suggestionStatus !== "pending"
  ) {
    res.status(409).json({ error: "No pending theme suggestion" });
    return;
  }

  const updatedPhotos = await db
    .update(photosTable)
    .set({ themeId: row.suggestedThemeId })
    .where(and(eq(photosTable.id, id), isNull(photosTable.themeId)))
    .returning({ id: photosTable.id });
  if (updatedPhotos.length === 0) {
    res.status(409).json({ error: "Photo already has a theme" });
    return;
  }
  await db
    .update(photoAiAnalysesTable)
    .set({
      themeSuggestionStatus: "accepted",
      themeReviewOutcome: "correct",
      themeReviewedAt: new Date(),
    })
    .where(eq(photoAiAnalysesTable.photoId, id));

  const rows = await buildPhotoSelect().where(eq(photosTable.id, id));
  res.json(mapPhoto(rows[0]));
});

// POST /api/photos/:id/ai-theme/reject — dismiss a pending AI theme suggestion (admin only).
router.post("/photos/:id/ai-theme/reject", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid photo id" });
    return;
  }

  const [photo] = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(eq(photosTable.id, id));
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  await db
    .update(photoAiAnalysesTable)
    .set({
      themeSuggestionStatus: "rejected",
      themeReviewOutcome: "incorrect",
      themeReviewedAt: new Date(),
    })
    .where(
      and(
        eq(photoAiAnalysesTable.photoId, id),
        eq(photoAiAnalysesTable.themeSuggestionStatus, "pending"),
      ),
    );
  res.json({ rejected: true, photoId: id });
});

// POST /api/photos/:id/ai-theme/review — record whether an AI-applied theme was correct.
router.post("/photos/:id/ai-theme/review", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const outcome = req.body?.outcome;
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid photo id" });
    return;
  }
  if (outcome !== "correct" && outcome !== "incorrect") {
    res.status(400).json({ error: "outcome must be correct or incorrect" });
    return;
  }

  const [photo] = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(eq(photosTable.id, id));
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const updated = await db
    .update(photoAiAnalysesTable)
    .set({
      themeReviewOutcome: outcome,
      themeReviewedAt: new Date(),
    })
    .where(
      and(
        eq(photoAiAnalysesTable.photoId, id),
        eq(photoAiAnalysesTable.themeSuggestionStatus, "auto_applied"),
      ),
    )
    .returning({ photoId: photoAiAnalysesTable.photoId });
  if (updated.length === 0) {
    res.status(409).json({ error: "No auto-applied theme is waiting for review" });
    return;
  }

  res.json({ reviewed: true, photoId: id, outcome });
});

// POST /api/photos/:id/ai/retry — re-run AI analysis for one photo (admin only).
router.post("/photos/:id/ai/retry", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid photo id" });
    return;
  }

  const [photo] = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(eq(photosTable.id, id));
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  await enqueuePhotoAiAnalysis(id);
  res.status(202).json({ queued: true, photoId: id });
});

// GET /api/photos/:id — fetch a single photo by id
router.get("/photos/:id", async (req, res) => {
  const params = GetPhotoParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await buildPhotoSelect().where(eq(photosTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(mapPhoto(rows[0]));
});

// PATCH /api/photos/bulk-club — bulk-assign a club to multiple photos (admin only)
router.patch("/photos/bulk-club", async (req, res) => {
  const isAdmin = !!(req.session as any)?.adminId;
  if (!isAdmin) { res.status(403).json({ error: "Admin access required" }); return; }

  const { photoIds, clubId } = req.body ?? {};

  if (
    !Array.isArray(photoIds) ||
    photoIds.length === 0 ||
    photoIds.some((id) => typeof id !== "number" || !Number.isInteger(id) || id <= 0)
  ) {
    res.status(400).json({ error: "photoIds must be a non-empty array of positive integers" });
    return;
  }

  if (clubId !== null && (typeof clubId !== "number" || !Number.isInteger(clubId) || clubId <= 0)) {
    res.status(400).json({ error: "clubId must be a positive integer or null" });
    return;
  }

  await Promise.all(
    (photoIds as number[]).map((id) =>
      db.update(photosTable).set({ clubId: clubId as number | null }).where(eq(photosTable.id, id)),
    ),
  );

  res.json({ updated: (photoIds as number[]).length });
});

// DELETE /api/photos/bulk-delete — permanently delete multiple photos (admin only)
router.delete("/photos/bulk-delete", async (req, res) => {
  const isAdmin = !!(req.session as any)?.adminId;
  if (!isAdmin) { res.status(403).json({ error: "Admin access required" }); return; }

  const { photoIds } = req.body ?? {};

  if (
    !Array.isArray(photoIds) ||
    photoIds.length === 0 ||
    photoIds.some((id) => typeof id !== "number" || !Number.isInteger(id) || id <= 0)
  ) {
    res.status(400).json({ error: "photoIds must be a non-empty array of positive integers" });
    return;
  }

  await Promise.all(
    (photoIds as number[]).map((id) =>
      db.delete(photosTable).where(eq(photosTable.id, id)),
    ),
  );

  res.json({ deleted: (photoIds as number[]).length });
});

// PATCH /api/photos/:id — update a photo's metadata (owner or admin)
router.patch("/photos/:id", async (req, res) => {
  const { userId } = getAuth(req);
  const isAdmin = !!(req.session as any)?.adminId;
  if (!userId && !isAdmin) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = UpdatePhotoParams.safeParse({ id: Number(req.params.id) });
  const body = UpdatePhotoBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const existing = await db
    .select({ photographerId: photosTable.photographerId })
    .from(photosTable)
    .where(eq(photosTable.id, params.data.id));
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }

  if (!isAdmin) {
    const photographerId = await getPhotographerIdForClerkUser(userId!);
    if (existing[0].photographerId !== photographerId) {
      res.status(403).json({ error: "You can only edit your own photos" });
      return;
    }
    // If the update changes the club, verify the photographer is a member of the new club.
    if (body.data.clubId != null) {
      const membership = await db
        .select({ one: sql<number>`1` })
        .from(photographerClubsTable)
        .where(
          and(
            eq(photographerClubsTable.photographerId, photographerId!),
            eq(photographerClubsTable.clubId, body.data.clubId),
          ),
        );
      if (!membership.length) {
        res.status(403).json({ error: "You can only assign photos to clubs you are a member of" });
        return;
      }
    }
  }

  await db.update(photosTable).set(body.data).where(eq(photosTable.id, params.data.id));
  const rows = await buildPhotoSelect().where(eq(photosTable.id, params.data.id));
  res.json(mapPhoto(rows[0]));
});

// DELETE /api/photos/:id — delete a photo (owner or admin)
router.delete("/photos/:id", async (req, res) => {
  const { userId } = getAuth(req);
  const isAdmin = !!(req.session as any)?.adminId;
  if (!userId && !isAdmin) { res.status(401).json({ error: "Sign in to delete photos" }); return; }

  const params = DeletePhotoParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const existing = await db
    .select({ photographerId: photosTable.photographerId })
    .from(photosTable)
    .where(eq(photosTable.id, params.data.id));
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }

  if (!isAdmin) {
    const photographerId = await getPhotographerIdForClerkUser(userId!);
    if (existing[0].photographerId !== photographerId) {
      res.status(403).json({ error: "You can only delete your own photos" });
      return;
    }
  }

  await db.delete(photosTable).where(eq(photosTable.id, params.data.id));
  res.status(204).send();
});

// PATCH /api/me/photos/order — set sort_order for all photos belonging to the authenticated photographer.
// Body: { photoIds: number[] } — full ordered list; index becomes sort_order value.
router.patch("/me/photos/order", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to reorder photos" }); return; }

  const body = ReorderPhotosBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const photographerId = await getPhotographerIdForClerkUser(userId);
  if (!photographerId) { res.status(404).json({ error: "Photographer profile not found" }); return; }

  // Verify all supplied IDs belong to this photographer, then bulk-update in parallel.
  const owned = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(and(eq(photosTable.photographerId, photographerId)));
  const ownedIds = new Set(owned.map((r) => r.id));

  const updates = body.data.photoIds
    .filter((id) => ownedIds.has(id))
    .map((id, idx) => db.update(photosTable).set({ sortOrder: idx }).where(eq(photosTable.id, id)));

  await Promise.all(updates);
  res.status(204).send();
});

// GET /api/photos/:id/like — private state for the authenticated member.
router.get("/photos/:id/like", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to view your like state" }); return; }

  const params = GetPhotoParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select({ photoId: photoLikesTable.photoId })
    .from(photoLikesTable)
    .where(and(eq(photoLikesTable.photoId, params.data.id), eq(photoLikesTable.clerkUserId, userId)));
  res.setHeader("Cache-Control", "no-store");
  res.json({ liked: !!existing });
});

// POST /api/photos/:id/like — toggle the current member's unique like.
router.post("/photos/:id/like", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to like photos" }); return; }

  const params = GetPhotoParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [photo] = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(eq(photosTable.id, params.data.id));
  if (!photo) { res.status(404).json({ error: "Not found" }); return; }

  // Serialize toggles for this one member/photo pair. The relationship update
  // and denormalised public counter are then committed atomically, so retries
  // or double-clicks cannot make like_count drift from member reactions.
  const liked = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`photo-like:${params.data.id}:${userId}`}))`);
    const [existing] = await tx
      .select({ photoId: photoLikesTable.photoId })
      .from(photoLikesTable)
      .where(and(eq(photoLikesTable.photoId, params.data.id), eq(photoLikesTable.clerkUserId, userId)));

    if (existing) {
      const [removed] = await tx
        .delete(photoLikesTable)
        .where(and(eq(photoLikesTable.photoId, params.data.id), eq(photoLikesTable.clerkUserId, userId)))
        .returning({ photoId: photoLikesTable.photoId });
      if (removed) {
        await tx
          .update(photosTable)
          .set({ likeCount: sql`greatest(${photosTable.likeCount} - 1, 0)` })
          .where(eq(photosTable.id, params.data.id));
      }
      return false;
    }

    const [inserted] = await tx
      .insert(photoLikesTable)
      .values({ photoId: params.data.id, clerkUserId: userId })
      .onConflictDoNothing()
      .returning({ photoId: photoLikesTable.photoId });
    if (inserted) {
      await tx
        .update(photosTable)
        .set({ likeCount: sql`${photosTable.likeCount} + 1` })
        .where(eq(photosTable.id, params.data.id));
    }
    return !!inserted;
  });

  const rows = await buildPhotoSelect().where(eq(photosTable.id, params.data.id));
  res.setHeader("Cache-Control", "no-store");
  res.json({ photo: mapPhoto(rows[0]!), liked });
});

export default router;
