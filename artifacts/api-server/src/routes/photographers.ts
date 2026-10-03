import { Router } from "express";
import { UploadUnavailableError, withUploadLifecycle } from "../lib/upload-staging";
import { db, photographersTable, photosTable, themesTable, clubsTable, photographerClubsTable, photographerThemesTable, photographerFollowsTable, adminsTable } from "@workspace/db";
import { eq, ilike, count, or, sql, exists, and } from "drizzle-orm";
import {
  ListPhotographersQueryParams,
  CreatePhotographerBody,
  GetPhotographerParams,
  UpdatePhotographerBody,
  UpdatePhotographerParams,
} from "@workspace/api-zod";
import { getAuth, clerkClient } from "@clerk/express";
import { requireAdmin } from "./admins";
import { sendEmail } from "../lib/email";
import { deletePhotographerWithReclamation, ImageLifecycleError, updatePhotographerWithReclamation } from "../lib/image-lifecycle";

const router = Router();

/** Correlated subquery: returns clubs as a JSON array for a given photographer row. */
const clubsSubquery = sql<{ id: number; name: string; memberSince: number | null }[]>`(
  SELECT COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name, 'memberSince', pc.member_since) ORDER BY c.name), '[]'::json)
  FROM photographer_club pc
  JOIN club c ON c.id = pc.club_id
  WHERE pc.photographer_id = ${photographersTable.id}
)`;

/** Correlated subquery: returns preferred themes as a JSON array for a given photographer row. */
const themesSubquery = sql<{ id: number; name: string }[]>`(
  SELECT COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name), '[]'::json)
  FROM photographer_theme pt
  JOIN theme t ON t.id = pt.theme_id
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
    email: photographersTable.email,
    avatarUrl: photographersTable.avatarUrl,
    clubs: clubsSubquery,
    themes: themesSubquery,
    createdAt: photographersTable.createdAt,
    photoCount: count(photosTable.id),
    claimed: sql<boolean>`(${photographersTable.clerkUserId} IS NOT NULL)`,
  };
}

/** Apply the LEFT JOINs common to every photographer SELECT. */
export function photographerBaseQuery() {
  return db
    .select(selectFields())
    .from(photographersTable)
    .leftJoin(photosTable, eq(photosTable.photographerId, photographersTable.id));
}

/** GROUP BY list required whenever aggregate columns are used (photoCount). */
export function groupByFields() {
  return [photographersTable.id] as const;
}

/** Serialise a photographer row — convert the Date to ISO string for JSON. */
export function buildRow(r: {
  id: number;
  name: string;
  bio: string | null;
  email: string | null;
  avatarUrl: string | null;
  clubs: { id: number; name: string; memberSince: number | null }[];
  themes: { id: number; name: string }[];
  createdAt: Date;
  photoCount: number;
  claimed: boolean;
}) {
  return { ...r, createdAt: r.createdAt.toISOString() };
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
router.post("/photographers", requireAdmin, async (req, res) => {
  const body = CreatePhotographerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { clubs, themeIds, ...photographerData } = body.data;
  let photographer: typeof photographersTable.$inferSelect;
  try {
    photographer = await db.transaction(async (tx) => {
      const [created] = await withUploadLifecycle({ attach: [photographerData.avatarUrl ?? ""] },
        (transaction) => transaction.insert(photographersTable).values(photographerData).returning(),
        { transaction: tx });
      if (clubs && clubs.length > 0) {
        await tx.insert(photographerClubsTable).values(clubs.map(({ id: clubId, memberSince }) => ({
          photographerId: created.id, clubId, memberSince: memberSince ?? null,
        })));
      }
      if (themeIds && themeIds.length > 0) {
        await tx.insert(photographerThemesTable).values(
          themeIds.map((themeId) => ({ photographerId: created.id, themeId })),
        );
      }
      return created;
    });
  } catch (error) {
    if (error instanceof UploadUnavailableError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }

  const rows = await photographerBaseQuery()
    .where(eq(photographersTable.id, photographer.id))
    .groupBy(...groupByFields());
  res.status(201).json(buildRow(rows[0]!));
});

// GET /api/photographers/:id/follow — private state for the authenticated member.
router.get("/photographers/:id/follow", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to view your follow state" }); return; }

  const params = GetPhotographerParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db
    .select({ photographerId: photographerFollowsTable.photographerId })
    .from(photographerFollowsTable)
    .where(and(
      eq(photographerFollowsTable.photographerId, params.data.id),
      eq(photographerFollowsTable.clerkUserId, userId),
    ));
  res.setHeader("Cache-Control", "no-store");
  res.json({ following: !!existing });
});

// POST /api/photographers/:id/follow — toggle the current member's follow.
router.post("/photographers/:id/follow", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to follow photographers" }); return; }

  const params = GetPhotographerParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [photographer] = await db
    .select({ id: photographersTable.id, clerkUserId: photographersTable.clerkUserId })
    .from(photographersTable)
    .where(eq(photographersTable.id, params.data.id));
  if (!photographer) { res.status(404).json({ error: "Not found" }); return; }
  if (photographer.clerkUserId === userId) {
    res.status(400).json({ error: "You cannot follow your own photographer profile" });
    return;
  }

  // Keep a double-click or two browser tabs from racing the toggle result.
  const following = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`photographer-follow:${params.data.id}:${userId}`}))`);
    const [existing] = await tx
      .select({ photographerId: photographerFollowsTable.photographerId })
      .from(photographerFollowsTable)
      .where(and(
        eq(photographerFollowsTable.photographerId, params.data.id),
        eq(photographerFollowsTable.clerkUserId, userId),
      ));

    if (existing) {
      await tx
        .delete(photographerFollowsTable)
        .where(and(
          eq(photographerFollowsTable.photographerId, params.data.id),
          eq(photographerFollowsTable.clerkUserId, userId),
        ));
      return false;
    }

    const [inserted] = await tx
      .insert(photographerFollowsTable)
      .values({ photographerId: params.data.id, clerkUserId: userId })
      .onConflictDoNothing()
      .returning({ photographerId: photographerFollowsTable.photographerId });
    return !!inserted;
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ following });
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
// PATCH is available to the linked Clerk profile owner or a verified admin.
router.patch("/photographers/:id", async (req: any, res) => {
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

  const existing = await db
      .select({ clerkUserId: photographersTable.clerkUserId })
      .from(photographersTable)
      .where(eq(photographersTable.id, id));
  if (!existing[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [admin] = userId
    ? await db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.clerkUserId, userId)).limit(1)
    : req.session?.adminId
      ? await db.select({ id: adminsTable.id }).from(adminsTable).where(eq(adminsTable.id, req.session.adminId)).limit(1)
      : [];
  if (!admin && (!userId || existing[0].clerkUserId !== userId)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { clubs, themeIds, ...photographerFields } = body.data;
  if (clubs !== undefined) {
    const requestedIds = clubs.map(club => club.id);
    if (requestedIds.some(clubId => !Number.isInteger(clubId) || clubId <= 0) ||
        new Set(requestedIds).size !== requestedIds.length) {
      res.status(400).json({ error: "Choose each valid club only once" });
      return;
    }
    const availableClubs = await db.select({ id: clubsTable.id }).from(clubsTable);
    const availableIds = new Set(availableClubs.map(club => club.id));
    if (requestedIds.some(clubId => !availableIds.has(clubId))) {
      res.status(400).json({ error: "One or more clubs are no longer available" });
      return;
    }
  }

  try {
    await db.transaction(async tx => {
      if (Object.keys(photographerFields).length > 0) {
        await updatePhotographerWithReclamation(id, photographerFields, undefined, tx);
      }
      if (clubs !== undefined) {
        const previous = await tx.select({
          clubId: photographerClubsTable.clubId,
          memberSince: photographerClubsTable.memberSince,
          joinedAt: photographerClubsTable.joinedAt,
        }).from(photographerClubsTable).where(eq(photographerClubsTable.photographerId, id));
        await tx.delete(photographerClubsTable).where(eq(photographerClubsTable.photographerId, id));
        if (clubs.length > 0) {
          await tx.insert(photographerClubsTable).values(clubs.map(club => {
            const existingMembership = previous.find(row => row.clubId === club.id);
            return {
              photographerId: id,
              clubId: club.id,
              // Owners choose memberships, but only admins can set historical join years.
              memberSince: admin ? club.memberSince ?? null : existingMembership?.memberSince ?? null,
              ...(existingMembership?.joinedAt ? { joinedAt: existingMembership.joinedAt } : {}),
            };
          }));
        }
      }
      if (themeIds !== undefined) {
        await tx.delete(photographerThemesTable).where(eq(photographerThemesTable.photographerId, id));
        if (themeIds.length > 0) {
          await tx.insert(photographerThemesTable).values(themeIds.map(themeId => ({ photographerId: id, themeId })));
        }
      }
    });
  } catch (error) {
    if (error instanceof ImageLifecycleError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
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

  let removed: Awaited<ReturnType<typeof deletePhotographerWithReclamation>>;
  try {
    removed = await deletePhotographerWithReclamation(id);
  } catch (error) {
    if (error instanceof ImageLifecycleError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
  }

  // Send notification email after the committed deletion, using its actual profile.
  const { name, clerkUserId } = removed;
  if (clerkUserId && reason) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (email) {
        await sendEmail({
          to: email,
          subject: "Your PhotoMatrix account has been removed",
          html: `<p>Dear ${name},</p><p>Your PhotoMatrix account has been removed by an administrator.</p><p><strong>Reason:</strong> ${reason}</p><p>If you have questions, please contact your club administrator.</p><p>— The PhotoMatrix Team</p>`,
          text: `Dear ${name},\n\nYour PhotoMatrix account has been removed by an administrator.\n\nReason: ${reason}\n\nIf you have any questions, please contact your club administrator.\n\n— The PhotoMatrix Team`,
        });
      }
    } catch (err) {
      // Log but don't block the deletion if the email fails.
      req.log.warn({ err, photographerId: id }, "Failed to send removal notification email");
    }
  }

  res.status(204).end();
});

export default router;
