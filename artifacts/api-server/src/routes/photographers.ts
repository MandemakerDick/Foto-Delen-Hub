import { Router } from "express";
import { alias } from "drizzle-orm/pg-core";
import { db, photographersTable, clubsTable, photosTable, themesTable } from "@workspace/db";
import { eq, ilike, count, or } from "drizzle-orm";
import {
  ListPhotographersQueryParams,
  CreatePhotographerBody,
  GetPhotographerParams,
  UpdatePhotographerBody,
  UpdatePhotographerParams,
} from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

const router = Router();

const t1 = alias(themesTable, "t1");
const t2 = alias(themesTable, "t2");

function buildRow(r: {
  id: number;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  clubId: number | null;
  clubName: string | null;
  themeId1: number | null;
  themeId2: number | null;
  themeName1: string | null;
  themeName2: string | null;
  createdAt: Date;
  photoCount: number;
}) {
  return { ...r, createdAt: r.createdAt.toISOString() };
}

function selectFields() {
  return {
    id: photographersTable.id,
    name: photographersTable.name,
    bio: photographersTable.bio,
    avatarUrl: photographersTable.avatarUrl,
    clubId: photographersTable.clubId,
    clubName: clubsTable.name,
    themeId1: photographersTable.themeId1,
    themeName1: t1.name,
    themeId2: photographersTable.themeId2,
    themeName2: t2.name,
    createdAt: photographersTable.createdAt,
    photoCount: count(photosTable.id),
  };
}

router.get("/photographers", async (req, res) => {
  const query = ListPhotographersQueryParams.safeParse({
    search: req.query.search,
    clubId: req.query.clubId ? Number(req.query.clubId) : undefined,
    themeId: req.query.themeId ? Number(req.query.themeId) : undefined,
  });
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { search, clubId, themeId } = query.data;

  const whereClause = search
    ? ilike(photographersTable.name, `%${search}%`)
    : clubId
      ? eq(photographersTable.clubId, clubId)
      : themeId
        ? or(
            eq(photographersTable.themeId1, themeId),
            eq(photographersTable.themeId2, themeId),
          )
        : undefined;

  const rows = await db
    .select(selectFields())
    .from(photographersTable)
    .leftJoin(clubsTable, eq(photographersTable.clubId, clubsTable.id))
    .leftJoin(t1, eq(photographersTable.themeId1, t1.id))
    .leftJoin(t2, eq(photographersTable.themeId2, t2.id))
    .leftJoin(photosTable, eq(photosTable.photographerId, photographersTable.id))
    .where(whereClause)
    .groupBy(
      photographersTable.id,
      clubsTable.name,
      t1.id,
      t1.name,
      t2.id,
      t2.name,
    )
    .orderBy(photographersTable.name);

  res.json(rows.map(buildRow));
});

router.post("/photographers", async (req, res) => {
  const body = CreatePhotographerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [photographer] = await db.insert(photographersTable).values(body.data).returning();
  res.status(201).json({
    ...photographer,
    photoCount: 0,
    clubName: null,
    themeName1: null,
    themeName2: null,
    createdAt: photographer.createdAt.toISOString(),
  });
});

router.get("/photographers/:id", async (req, res) => {
  const params = GetPhotographerParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db
    .select(selectFields())
    .from(photographersTable)
    .leftJoin(clubsTable, eq(photographersTable.clubId, clubsTable.id))
    .leftJoin(t1, eq(photographersTable.themeId1, t1.id))
    .leftJoin(t2, eq(photographersTable.themeId2, t2.id))
    .leftJoin(photosTable, eq(photosTable.photographerId, photographersTable.id))
    .where(eq(photographersTable.id, params.data.id))
    .groupBy(
      photographersTable.id,
      clubsTable.name,
      t1.id,
      t1.name,
      t2.id,
      t2.name,
    );

  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(buildRow(rows[0]));
});

router.patch("/photographers/:id", async (req, res) => {
  const params = UpdatePhotographerParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const body = UpdatePhotographerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const { id } = params.data;

  const { userId } = getAuth(req);
  if (userId) {
    const existing = await db
      .select({ clerkUserId: photographersTable.clerkUserId })
      .from(photographersTable)
      .where(eq(photographersTable.id, id));
    if (!existing[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing[0].clerkUserId && existing[0].clerkUserId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  await db.update(photographersTable).set(body.data).where(eq(photographersTable.id, id));

  const rows = await db
    .select(selectFields())
    .from(photographersTable)
    .leftJoin(clubsTable, eq(photographersTable.clubId, clubsTable.id))
    .leftJoin(t1, eq(photographersTable.themeId1, t1.id))
    .leftJoin(t2, eq(photographersTable.themeId2, t2.id))
    .leftJoin(photosTable, eq(photosTable.photographerId, photographersTable.id))
    .where(eq(photographersTable.id, id))
    .groupBy(
      photographersTable.id,
      clubsTable.name,
      t1.id,
      t1.name,
      t2.id,
      t2.name,
    );

  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(buildRow(rows[0]));
});

export default router;
