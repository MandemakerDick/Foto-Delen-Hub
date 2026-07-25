import { Router } from "express";
import { db, clubsTable, photosTable, photographerClubsTable } from "@workspace/db";
import { eq, ilike, countDistinct, sql } from "drizzle-orm";
import {
  ListClubsQueryParams,
  CreateClubBody,
  GetClubParams,
  UpdateClubParams,
  UpdateClubBody,
} from "@workspace/api-zod";

const router = Router();

/**
 * Shared SELECT field list for club queries.
 * Counts are aggregated via LEFT JOINs:
 *   - photoCount   — number of photos tagged to this club
 *   - memberCount  — number of distinct photographers who belong to this club
 *
 * Both joins are LEFT so clubs with no photos / no members still appear.
 * memberCount uses COUNT(DISTINCT ...) because one photographer joining produces
 * one row per photo, which would inflate a plain count().
 */
const clubSelectFields = {
  id: clubsTable.id,
  name: clubsTable.name,
  description: clubsTable.description,
  location: clubsTable.location,
  websiteUrl: clubsTable.websiteUrl,
  logoUrl: clubsTable.logoUrl,
  yearEstablished: clubsTable.yearEstablished,
  createdAt: clubsTable.createdAt,
  photoCount: countDistinct(photosTable.id),
  memberCount: sql<number>`count(distinct ${photographerClubsTable.photographerId})`,
};

/** Apply the standard LEFT JOINs needed to compute photo / member counts. */
function clubBaseQuery() {
  return db
    .select(clubSelectFields)
    .from(clubsTable)
    .leftJoin(photosTable, eq(photosTable.clubId, clubsTable.id))
    .leftJoin(photographerClubsTable, eq(photographerClubsTable.clubId, clubsTable.id));
}

/** Serialise a club row — convert the Date to an ISO string for JSON output. */
function mapClub(c: { createdAt: Date; [key: string]: unknown }) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

// GET /api/clubs — list all clubs, optionally filtered by name search
router.get("/clubs", async (req, res) => {
  const query = ListClubsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { search } = query.data;

  const clubs = await clubBaseQuery()
    .where(search ? ilike(clubsTable.name, `%${search}%`) : undefined)
    .groupBy(clubsTable.id)
    .orderBy(clubsTable.name);

  res.json(clubs.map(mapClub));
});

// POST /api/clubs — create a new club
router.post("/clubs", async (req, res) => {
  const body = CreateClubBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [club] = await db.insert(clubsTable).values(body.data).returning();
  // New club always starts with zero photos and members
  res.status(201).json({ ...club, photoCount: 0, memberCount: 0, createdAt: club.createdAt.toISOString() });
});

// GET /api/clubs/:id — fetch a single club by id
router.get("/clubs/:id", async (req, res) => {
  const params = GetClubParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await clubBaseQuery()
    .where(eq(clubsTable.id, params.data.id))
    .groupBy(clubsTable.id);

  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(mapClub(rows[0]));
});

// PUT /api/clubs/:id — update a club's details
router.put("/clubs/:id", async (req, res) => {
  const params = UpdateClubParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = UpdateClubBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const existing = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(eq(clubsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(clubsTable)
    .set(body.data)
    .where(eq(clubsTable.id, params.data.id))
    .returning();

  // Re-fetch with aggregated counts so the response matches the list/get shape
  const rows = await clubBaseQuery()
    .where(eq(clubsTable.id, updated.id))
    .groupBy(clubsTable.id);

  res.json(mapClub(rows[0]));
});

export default router;
