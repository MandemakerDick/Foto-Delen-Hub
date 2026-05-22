import { Router } from "express";
import { db, photosTable, photographersTable, clubsTable, themesTable, commentsTable } from "@workspace/db";
import { eq, ilike, desc, sql, count } from "drizzle-orm";
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
} from "@workspace/api-zod";

const router = Router();

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
      commentCount: sql<number>`coalesce(${commentCountSq.commentCount}, 0)`,
      createdAt: photosTable.createdAt,
    })
    .from(photosTable)
    .leftJoin(photographersTable, eq(photosTable.photographerId, photographersTable.id))
    .leftJoin(clubsTable, eq(photosTable.clubId, clubsTable.id))
    .leftJoin(themesTable, eq(photosTable.themeId, themesTable.id))
    .leftJoin(commentCountSq, eq(photosTable.id, commentCountSq.photoId));
}

function mapPhoto(p: { createdAt: Date; [key: string]: unknown }) {
  return { ...p, createdAt: p.createdAt.toISOString() };
}

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

  const photos = await q.orderBy(desc(photosTable.createdAt));
  res.json(photos.map(mapPhoto));
});

router.post("/photos", async (req, res) => {
  const body = CreatePhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [photo] = await db.insert(photosTable).values(body.data).returning();

  const rows = await buildPhotoSelect().where(eq(photosTable.id, photo.id));
  res.status(201).json(mapPhoto(rows[0]));
});

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

router.patch("/photos/:id", async (req, res) => {
  const params = UpdatePhotoParams.safeParse({ id: Number(req.params.id) });
  const body = UpdatePhotoBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  await db.update(photosTable).set(body.data).where(eq(photosTable.id, params.data.id));
  const rows = await buildPhotoSelect().where(eq(photosTable.id, params.data.id));
  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(mapPhoto(rows[0]));
});

router.delete("/photos/:id", async (req, res) => {
  const params = DeletePhotoParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(photosTable).where(eq(photosTable.id, params.data.id));
  res.status(204).send();
});

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
