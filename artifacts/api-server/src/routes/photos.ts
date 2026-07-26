import { Router } from "express";
import { db, photosTable, clubsTable, themesTable, commentsTable, photographersTable, photographerClubsTable } from "@workspace/db";
import { eq, ilike, desc, asc, sql, count, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  ListPhotosQueryParams,
  CreatePhotoBody,
  ListRecentPhotosQueryParams,
  GetPhotoParams,
  UpdatePhotoParams,
  UpdatePhotoBody,
  DeletePhotoParams,
  LikePhotoParams,
  LikePhotoBody,
  ReorderPhotosBody,
} from "@workspace/api-zod";
import { getPhotographerIdForClerkUser } from "../lib/db-helpers";

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
      clubName: clubsTable.name,
      themeId: photosTable.themeId,
      themeName: themesTable.name,
      likeCount: photosTable.likeCount,
      commentCount: sql<number>`coalesce(${commentCountSq.commentCount}, 0)::int`,
      createdAt: photosTable.createdAt,
    })
    .from(photosTable)
    .leftJoin(photographersTable, eq(photosTable.photographerId, photographersTable.id))
    .leftJoin(clubsTable, eq(photosTable.clubId, clubsTable.id))
    .leftJoin(themesTable, eq(photosTable.themeId, themesTable.id))
    .leftJoin(commentCountSq, eq(photosTable.id, commentCountSq.photoId));
}

/** Serialise a photo row — convert the Date to an ISO string for JSON output. */
function mapPhoto(p: { createdAt: Date; [key: string]: unknown }) {
  return { ...p, createdAt: p.createdAt.toISOString() };
}

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
    q = q.where(ilike(photosTable.title, `%${search}%`)) as typeof q;
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

// POST /api/photos/:id/like — increment the like counter (no per-user dedup by design)
router.post("/photos/:id/like", async (req, res) => {
  const params = LikePhotoParams.safeParse({ id: Number(req.params.id) });
  const body = LikePhotoBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  await db
    .update(photosTable)
    .set({ likeCount: sql`${photosTable.likeCount} + 1` })
    .where(eq(photosTable.id, params.data.id));
  const rows = await buildPhotoSelect().where(eq(photosTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(mapPhoto(rows[0]));
});

export default router;
