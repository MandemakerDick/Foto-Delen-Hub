import { Router } from "express";
import { db, photographersTable, clubsTable, photosTable } from "@workspace/db";
import { eq, ilike, count } from "drizzle-orm";
import { ListPhotographersQueryParams, CreatePhotographerBody, GetPhotographerParams } from "@workspace/api-zod";

const router = Router();

router.get("/photographers", async (req, res) => {
  const query = ListPhotographersQueryParams.safeParse({
    search: req.query.search,
    clubId: req.query.clubId ? Number(req.query.clubId) : undefined,
  });
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { search, clubId } = query.data;

  const rows = await db
    .select({
      id: photographersTable.id,
      name: photographersTable.name,
      bio: photographersTable.bio,
      avatarUrl: photographersTable.avatarUrl,
      clubId: photographersTable.clubId,
      clubName: clubsTable.name,
      createdAt: photographersTable.createdAt,
      photoCount: count(photosTable.id),
    })
    .from(photographersTable)
    .leftJoin(clubsTable, eq(photographersTable.clubId, clubsTable.id))
    .leftJoin(photosTable, eq(photosTable.photographerId, photographersTable.id))
    .where(
      search
        ? ilike(photographersTable.name, `%${search}%`)
        : clubId
          ? eq(photographersTable.clubId, clubId)
          : undefined,
    )
    .groupBy(photographersTable.id, clubsTable.name)
    .orderBy(photographersTable.name);

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/photographers", async (req, res) => {
  const body = CreatePhotographerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [photographer] = await db.insert(photographersTable).values(body.data).returning();
  res.status(201).json({ ...photographer, photoCount: 0, clubName: null, createdAt: photographer.createdAt.toISOString() });
});

router.get("/photographers/:id", async (req, res) => {
  const params = GetPhotographerParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db
    .select({
      id: photographersTable.id,
      name: photographersTable.name,
      bio: photographersTable.bio,
      avatarUrl: photographersTable.avatarUrl,
      clubId: photographersTable.clubId,
      clubName: clubsTable.name,
      createdAt: photographersTable.createdAt,
      photoCount: count(photosTable.id),
    })
    .from(photographersTable)
    .leftJoin(clubsTable, eq(photographersTable.clubId, clubsTable.id))
    .leftJoin(photosTable, eq(photosTable.photographerId, photographersTable.id))
    .where(eq(photographersTable.id, params.data.id))
    .groupBy(photographersTable.id, clubsTable.name);

  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const p = rows[0];
  res.json({ ...p, createdAt: p.createdAt.toISOString() });
});

export default router;
