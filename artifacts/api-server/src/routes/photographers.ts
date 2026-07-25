import { Router } from "express";
import { alias } from "drizzle-orm/pg-core";
import { db, photographersTable, photosTable, themesTable, photographerClubsTable } from "@workspace/db";
import { eq, ilike, count, or, sql, exists } from "drizzle-orm";
import {
  ListPhotographersQueryParams,
  CreatePhotographerBody,
  GetPhotographerParams,
  UpdatePhotographerBody,
  UpdatePhotographerParams,
} from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

const router = Router();

// Aliases let us join the themes table twice without column-name conflicts.
const t1 = alias(themesTable, "t1");
const t2 = alias(themesTable, "t2");

/** Correlated subquery: returns clubs as a JSON array for a given photographer row. */
const clubsSubquery = sql<{ id: number; name: string }[]>`(
  SELECT COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name), '[]'::json)
  FROM photographer_clubs pc
  JOIN clubs c ON c.id = pc.club_id
  WHERE pc.photographer_id = ${photographersTable.id}
)`;

/**
 * Shared SELECT field list for photographer queries.
 * clubs is resolved via a correlated subquery — no extra GROUP BY column needed.
 * photoCount is aggregated via a LEFT JOIN on photos.
 */
function selectFields() {
  return {
    id: photographersTable.id,
    name: photographersTable.name,
    bio: photographersTable.bio,
    avatarUrl: photographersTable.avatarUrl,
    clubs: clubsSubquery,
    themeId1: photographersTable.themeId1,
    themeName1: t1.name,
    themeId2: photographersTable.themeId2,
    themeName2: t2.name,
    createdAt: photographersTable.createdAt,
    photoCount: count(photosTable.id),
  };
}

/** Apply the LEFT JOINs common to every photographer SELECT. */
function photographerBaseQuery() {
  return db
    .select(selectFields())
    .from(photographersTable)
    .leftJoin(t1, eq(photographersTable.themeId1, t1.id))
    .leftJoin(t2, eq(photographersTable.themeId2, t2.id))
    .leftJoin(photosTable, eq(photosTable.photographerId, photographersTable.id));
}

/** GROUP BY list required whenever aggregate columns are used (photoCount). */
function groupByFields() {
  return [
    photographersTable.id,
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
  clubs: { id: number; name: string }[];
  themeId1: number | null;
  themeId2: number | null;
  themeName1: string | null;
  themeName2: string | null;
  createdAt: Date;
  photoCount: number;
}) {
  return { ...r, createdAt: r.createdAt.toISOString() };
}

/** Insert club memberships for a photographer into the junction table. */
async function setClubMemberships(photographerId: number, clubIds: number[]) {
  await db.delete(photographerClubsTable).where(eq(photographerClubsTable.photographerId, photographerId));
  if (clubIds.length > 0) {
    await db.insert(photographerClubsTable).values(
      clubIds.map((clubId) => ({ photographerId, clubId })),
    );
  }
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
    ? or(
        ilike(photographersTable.name, `%${search}%`),
        ilike(photographersTable.bio, `%${search}%`),
        ilike(t1.name, `%${search}%`),
        ilike(t2.name, `%${search}%`),
      )
    : clubId
      ? exists(
          db
            .select({ one: sql<number>`1` })
            .from(photographerClubsTable)
            .where(
              sql`${photographerClubsTable.photographerId} = ${photographersTable.id} AND ${photographerClubsTable.clubId} = ${clubId}`,
            ),
        )
      : themeId
        ? exists(
            db
              .select({ one: sql<number>`1` })
              .from(photosTable)
              .where(
                sql`${photosTable.photographerId} = ${photographersTable.id} AND ${photosTable.themeId} = ${themeId}`,
              ),
          )
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
  const { clubIds, ...photographerData } = body.data;
  const [photographer] = await db.insert(photographersTable).values(photographerData).returning();

  if (clubIds && clubIds.length > 0) {
    await db.insert(photographerClubsTable).values(
      clubIds.map((clubId) => ({ photographerId: photographer.id, clubId })),
    );
  }

  const rows = await photographerBaseQuery()
    .where(eq(photographersTable.id, photographer.id))
    .groupBy(...groupByFields());
  res.status(201).json(buildRow(rows[0]!));
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

  const { clubIds, ...photographerFields } = body.data;

  // Update scalar photographer fields (skip if nothing to update)
  if (Object.keys(photographerFields).length > 0) {
    await db.update(photographersTable).set(photographerFields).where(eq(photographersTable.id, id));
  }

  // Replace club memberships if clubIds was provided
  if (clubIds !== undefined) {
    await setClubMemberships(id, clubIds);
  }

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
  await db.delete(photographerClubsTable).where(eq(photographerClubsTable.photographerId, id));
  await db.delete(photographersTable).where(eq(photographersTable.id, id));

  res.status(204).end();
});

export default router;
