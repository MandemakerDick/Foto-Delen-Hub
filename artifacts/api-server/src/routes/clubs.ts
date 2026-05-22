import { Router } from "express";
import { db, clubsTable, photographersTable, photosTable } from "@workspace/db";
import { eq, ilike, count, sql } from "drizzle-orm";
import { ListClubsQueryParams, CreateClubBody, GetClubParams, UpdateClubParams, UpdateClubBody } from "@workspace/api-zod";

const router = Router();

router.get("/clubs", async (req, res) => {
  const query = ListClubsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { search } = query.data;

  const clubs = await db
    .select({
      id: clubsTable.id,
      name: clubsTable.name,
      description: clubsTable.description,
      location: clubsTable.location,
      websiteUrl: clubsTable.websiteUrl,
      logoUrl: clubsTable.logoUrl,
      createdAt: clubsTable.createdAt,
      photoCount: count(photosTable.id),
      memberCount: sql<number>`count(distinct ${photographersTable.id})`,
    })
    .from(clubsTable)
    .leftJoin(photosTable, eq(photosTable.clubId, clubsTable.id))
    .leftJoin(photographersTable, eq(photographersTable.clubId, clubsTable.id))
    .where(search ? ilike(clubsTable.name, `%${search}%`) : undefined)
    .groupBy(clubsTable.id)
    .orderBy(clubsTable.name);

  res.json(clubs.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/clubs", async (req, res) => {
  const body = CreateClubBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [club] = await db.insert(clubsTable).values(body.data).returning();
  res.status(201).json({ ...club, photoCount: 0, memberCount: 0, createdAt: club.createdAt.toISOString() });
});

router.get("/clubs/:id", async (req, res) => {
  const params = GetClubParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db
    .select({
      id: clubsTable.id,
      name: clubsTable.name,
      description: clubsTable.description,
      location: clubsTable.location,
      websiteUrl: clubsTable.websiteUrl,
      logoUrl: clubsTable.logoUrl,
      createdAt: clubsTable.createdAt,
      photoCount: count(photosTable.id),
      memberCount: sql<number>`count(distinct ${photographersTable.id})`,
    })
    .from(clubsTable)
    .leftJoin(photosTable, eq(photosTable.clubId, clubsTable.id))
    .leftJoin(photographersTable, eq(photographersTable.clubId, clubsTable.id))
    .where(eq(clubsTable.id, params.data.id))
    .groupBy(clubsTable.id);

  if (!rows[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const club = rows[0];
  res.json({ ...club, createdAt: club.createdAt.toISOString() });
});

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

  const existing = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(clubsTable)
    .set(body.data)
    .where(eq(clubsTable.id, params.data.id))
    .returning();

  const rows = await db
    .select({
      id: clubsTable.id,
      name: clubsTable.name,
      description: clubsTable.description,
      location: clubsTable.location,
      websiteUrl: clubsTable.websiteUrl,
      logoUrl: clubsTable.logoUrl,
      createdAt: clubsTable.createdAt,
      photoCount: count(photosTable.id),
      memberCount: sql<number>`count(distinct ${photographersTable.id})`,
    })
    .from(clubsTable)
    .leftJoin(photosTable, eq(photosTable.clubId, clubsTable.id))
    .leftJoin(photographersTable, eq(photographersTable.clubId, clubsTable.id))
    .where(eq(clubsTable.id, updated.id))
    .groupBy(clubsTable.id);

  res.json({ ...rows[0], createdAt: rows[0].createdAt.toISOString() });
});

export default router;
