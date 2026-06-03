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

// Photographers can have up to two favourite themes; alias the themes table so
// both joins can appear in the same query without column-name conflicts.
const t1 = alias(themesTable, "t1");
const t2 = alias(themesTable, "t2");

/**
 * Shared SELECT field list for photographer queries.
 * photoCount is aggregated via a LEFT JOIN on photos so it is always present;
 * both theme aliases are joined so themeName1 / themeName2 are resolved in SQL.
 * Callers must GROUP BY the fields listed in every route's .groupBy() call.
 */
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

/** Apply the four LEFT JOINs common to every photographer SELECT. */
function photographerBaseQuery() {
  return db
    .select(selectFields())
    .from(photographersTable)
    .leftJoin(clubsTable, eq(photographersTable.clubId, clubsTable.id))
    .leftJoin(t1, eq(photographersTable.themeId1, t1.id))
    .leftJoin(t2, eq(photographersTable.themeId2, t2.id))
    .leftJoin(photosTable, eq(photosTable.photographerId, photographersTable.id));
}

/** GROUP BY list required whenever aggregate columns are used (photoCount). */
function groupByFields() {
  return [
    photographersTable.id,
    clubsTable.name,
    t1.id,
    t1.name,
    t2.id,
    t2.name,
  ] as const;
}

/** Serialise a photographer row — convert the Date to ISO string for JSON. */
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

// GET /api/photographers — list all photographers, optionally filtered by
// name search, club membership, or preferred theme (themeId1 OR themeId2).
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
        ? or(eq(photographersTable.themeId1, themeId), eq(photographersTable.themeId2, themeId))
        : undefined;

  const rows = await photographerBaseQuery()
    .where(whereClause)
    .groupBy(...groupByFields())
    .orderBy(photographersTable.name);

  res.json(rows.map(buildRow));
});

// POST /api/photographers — create a new photographer profile (admin action)
router.post("/photographers", async (req, res) => {
  const body = CreatePhotographerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [photographer] = await db.insert(photographersTable).values(body.data).returning();
  // New profile has zero photos and no resolved names yet
  res.status(201).json({
    ...photographer,
    photoCount: 0,
    clubName: null,
    themeName1: null,
    themeName2: null,
    createdAt: photographer.createdAt.toISOString(),
  });
});

// GET /api/photographers/:id — fetch a single photographer by id
router.get("/photographers/:id", async (req, res) => {
  const params = GetPhotographerParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await photographerBaseQuery()
    .where(eq(photographersTable.id, params.data.id))
    .groupBy(...groupByFields());

  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(buildRow(rows[0]));
});

// PATCH /api/photographers/:id — update a photographer's profile.
// If the request is Clerk-authenticated, only the profile owner may edit;
// unauthenticated requests (e.g. admin panel) are allowed through unchecked.
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
    // Enforce ownership: a Clerk user can only edit their own profile
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

  const rows = await photographerBaseQuery()
    .where(eq(photographersTable.id, id))
    .groupBy(...groupByFields());

  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(buildRow(rows[0]));
});

// DELETE /api/photographers/:id — remove a photographer and all their photos.
// Photos are deleted first because there is no DB-level CASCADE on that FK.
router.delete("/photographers/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const existing = await db
    .select({ id: photographersTable.id })
    .from(photographersTable)
    .where(eq(photographersTable.id, id))
    .limit(1);

  if (!existing[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(photosTable).where(eq(photosTable.photographerId, id));
  await db.delete(photographersTable).where(eq(photographersTable.id, id));

  res.status(204).end();
});

export default router;
