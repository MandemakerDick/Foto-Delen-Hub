import { Router } from "express";
import { db, photographersTable, photosTable, themesTable, photographerClubsTable, photographerThemesTable } from "@workspace/db";
import { eq, ilike, count, or, sql, exists } from "drizzle-orm";
import {
  ListPhotographersQueryParams,
  CreatePhotographerBody,
  GetPhotographerParams,
  UpdatePhotographerBody,
  UpdatePhotographerParams,
} from "@workspace/api-zod";
import { getAuth, clerkClient } from "@clerk/express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { requireAdmin } from "./admins";

const router = Router();

/** Correlated subquery: returns clubs as a JSON array for a given photographer row. */
const clubsSubquery = sql<{ id: number; name: string }[]>`(
  SELECT COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name), '[]'::json)
  FROM photographer_clubs pc
  JOIN clubs c ON c.id = pc.club_id
  WHERE pc.photographer_id = ${photographersTable.id}
)`;

/** Correlated subquery: returns preferred themes as a JSON array for a given photographer row. */
const themesSubquery = sql<{ id: number; name: string }[]>`(
  SELECT COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name), '[]'::json)
  FROM photographer_themes pt
  JOIN themes t ON t.id = pt.theme_id
  WHERE pt.photographer_id = ${photographersTable.id}
)`;

/**
 * Shared SELECT field list for photographer queries.
 * clubs and themes are resolved via correlated subqueries — no extra GROUP BY columns needed.
 * photoCount is aggregated via a LEFT JOIN on photos.
 */
function selectFields() {
  return {
    id: photographersTable.id,
    name: photographersTable.name,
    bio: photographersTable.bio,
    avatarUrl: photographersTable.avatarUrl,
    clubs: clubsSubquery,
    themes: themesSubquery,
    createdAt: photographersTable.createdAt,
    photoCount: count(photosTable.id),
  };
}

/** Apply the LEFT JOINs common to every photographer SELECT. */
function photographerBaseQuery() {
  return db
    .select(selectFields())
    .from(photographersTable)
    .leftJoin(photosTable, eq(photosTable.photographerId, photographersTable.id));
}

/** GROUP BY list required whenever aggregate columns are used (photoCount). */
function groupByFields() {
  return [photographersTable.id] as const;
}

/** Serialise a photographer row — convert the Date to ISO string for JSON. */
function buildRow(r: {
  id: number;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  clubs: { id: number; name: string }[];
  themes: { id: number; name: string }[];
  createdAt: Date;
  photoCount: number;
}) {
  return { ...r, createdAt: r.createdAt.toISOString() };
}

/** Replace club memberships for a photographer in the junction table. */
async function setClubMemberships(photographerId: number, clubIds: number[]) {
  await db.delete(photographerClubsTable).where(eq(photographerClubsTable.photographerId, photographerId));
  if (clubIds.length > 0) {
    await db.insert(photographerClubsTable).values(
      clubIds.map((clubId) => ({ photographerId, clubId })),
    );
  }
}

/** Replace theme preferences for a photographer in the junction table. */
async function setThemeMemberships(photographerId: number, themeIds: number[]) {
  await db.delete(photographerThemesTable).where(eq(photographerThemesTable.photographerId, photographerId));
  if (themeIds.length > 0) {
    await db.insert(photographerThemesTable).values(
      themeIds.map((themeId) => ({ photographerId, themeId })),
    );
  }
}

// GET /api/photographers — list all photographers, optionally filtered by
// name/bio/preferred-theme search, club membership, or submitted photos under a theme.
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
        exists(
          db
            .select({ one: sql<number>`1` })
            .from(photographerThemesTable)
            .innerJoin(themesTable, eq(photographerThemesTable.themeId, themesTable.id))
            .where(
              sql`${photographerThemesTable.photographerId} = ${photographersTable.id} AND ${themesTable.name} ILIKE ${`%${search}%`}`,
            ),
        ),
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
  const { clubIds, themeIds, ...photographerData } = body.data;
  const [photographer] = await db.insert(photographersTable).values(photographerData).returning();

  if (clubIds && clubIds.length > 0) {
    await db.insert(photographerClubsTable).values(
      clubIds.map((clubId) => ({ photographerId: photographer.id, clubId })),
    );
  }
  if (themeIds && themeIds.length > 0) {
    await db.insert(photographerThemesTable).values(
      themeIds.map((themeId) => ({ photographerId: photographer.id, themeId })),
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

  const { clubIds, themeIds, ...photographerFields } = body.data;

  // Update scalar photographer fields (skip if nothing to update)
  if (Object.keys(photographerFields).length > 0) {
    await db.update(photographersTable).set(photographerFields).where(eq(photographersTable.id, id));
  }

  // Replace club memberships if clubIds was provided
  if (clubIds !== undefined) {
    await setClubMemberships(id, clubIds);
  }
  // Replace theme preferences if themeIds was provided
  if (themeIds !== undefined) {
    await setThemeMemberships(id, themeIds);
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
// Accepts optional JSON body { reason: string } — if provided and the photographer
// has a Clerk account, a notification email is sent before deletion.
router.delete("/photographers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const reason: string | undefined = typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;

  const existing = await db
    .select({ id: photographersTable.id, name: photographersTable.name, clerkUserId: photographersTable.clerkUserId })
    .from(photographersTable)
    .where(eq(photographersTable.id, id))
    .limit(1);

  if (!existing[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Send notification email if photographer has a Clerk account and a reason was given.
  const { name, clerkUserId } = existing[0];
  if (clerkUserId && reason) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (email) {
        const connectors = new ReplitConnectors();
        const fromAddress = process.env.EMAIL_FROM ?? "PhotoMatrix <onboarding@resend.dev>";
        await connectors.proxy("resend", "/emails", {
          method: "POST",
          body: JSON.stringify({
            from: fromAddress,
            to: [email],
            subject: "Your PhotoMatrix account has been removed",
            html: `<p>Dear ${name},</p><p>Your PhotoMatrix account has been removed by an administrator.</p><p><strong>Reason:</strong> ${reason}</p><p>If you have questions, please contact your club administrator.</p><p>— The PhotoMatrix Team</p>`,
            text: `Dear ${name},\n\nYour PhotoMatrix account has been removed by an administrator.\n\nReason: ${reason}\n\nIf you have any questions, please contact your club administrator.\n\n— The PhotoMatrix Team`,
          }),
        });
      }
    } catch (err) {
      // Log but don't block the deletion if the email fails.
      console.error("Failed to send removal notification email:", err);
    }
  }

  await db.delete(photosTable).where(eq(photosTable.photographerId, id));
  await db.delete(photographerClubsTable).where(eq(photographerClubsTable.photographerId, id));
  await db.delete(photographerThemesTable).where(eq(photographerThemesTable.photographerId, id));
  await db.delete(photographersTable).where(eq(photographersTable.id, id));

  res.status(204).end();
});

export default router;
