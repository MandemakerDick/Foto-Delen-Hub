import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, photographersTable, photographerClubsTable, photographerThemesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

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
 * Middleware: require a Clerk-authenticated session.
 * Attaches req.clerkUserId on success; returns 401 otherwise.
 */
export function requireAuth(req: any, res: any, next: any) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = userId;
  next();
}

/**
 * Fetch the photographer profile linked to a Clerk user, including their
 * clubs and preferred themes resolved via correlated subqueries.
 */
async function getPhotographerByClerkId(clerkUserId: string) {
  const rows = await db
    .select({
      id: photographersTable.id,
      name: photographersTable.name,
      bio: photographersTable.bio,
      avatarUrl: photographersTable.avatarUrl,
      clubs: clubsSubquery,
      themes: themesSubquery,
      clerkUserId: photographersTable.clerkUserId,
      createdAt: photographersTable.createdAt,
    })
    .from(photographersTable)
    .where(eq(photographersTable.clerkUserId, clerkUserId));
  return rows[0] ?? null;
}

// GET /api/me — return the photographer profile for the signed-in Clerk user.
// Must never be cached: the response is user-specific and changes on every
// profile update, so the browser must always fetch fresh data.
router.get("/me", requireAuth, async (req: any, res) => {
  res.setHeader("Cache-Control", "no-store");
  const profile = await getPhotographerByClerkId(req.clerkUserId);
  if (!profile) {
    res.status(404).json({ error: "No photographer profile linked" });
    return;
  }
  res.json({ ...profile, createdAt: profile.createdAt.toISOString() });
});

// POST /api/me/link — link an existing photographer profile to the Clerk account.
// Prevents double-claiming: if the profile is already linked to a *different*
// Clerk user the request is rejected with 409.
router.post("/me/link", requireAuth, async (req: any, res) => {
  const { photographerId } = req.body;
  if (!photographerId || typeof photographerId !== "number") {
    res.status(400).json({ error: "photographerId required" });
    return;
  }

  const existing = await db
    .select({ id: photographersTable.id, clerkUserId: photographersTable.clerkUserId })
    .from(photographersTable)
    .where(eq(photographersTable.id, photographerId));

  if (!existing[0]) {
    res.status(404).json({ error: "Photographer not found" });
    return;
  }
  if (existing[0].clerkUserId && existing[0].clerkUserId !== req.clerkUserId) {
    res.status(409).json({ error: "This profile is already claimed by another account" });
    return;
  }

  await db
    .update(photographersTable)
    .set({ clerkUserId: req.clerkUserId })
    .where(eq(photographersTable.id, photographerId));

  const profile = await getPhotographerByClerkId(req.clerkUserId);
  res.json({ ...profile!, createdAt: profile!.createdAt.toISOString() });
});

// POST /api/me/profile — create a new photographer profile linked to the Clerk account.
// Only one profile per Clerk account is allowed.
router.post("/me/profile", requireAuth, async (req: any, res) => {
  const { name, bio, avatarUrl, clubIds, themeIds } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name required" });
    return;
  }

  const existing = await getPhotographerByClerkId(req.clerkUserId);
  if (existing) {
    res.status(409).json({ error: "You already have a profile linked" });
    return;
  }

  const [newPhotographer] = await db
    .insert(photographersTable)
    .values({ name, bio, avatarUrl, clerkUserId: req.clerkUserId })
    .returning();

  // Link club memberships via junction table
  if (Array.isArray(clubIds) && clubIds.length > 0) {
    await db.insert(photographerClubsTable).values(
      clubIds.map((clubId: number) => ({ photographerId: newPhotographer.id, clubId })),
    );
  }

  // Link theme preferences via junction table
  if (Array.isArray(themeIds) && themeIds.length > 0) {
    await db.insert(photographerThemesTable).values(
      themeIds.map((themeId: number) => ({ photographerId: newPhotographer.id, themeId })),
    );
  }

  const profile = await getPhotographerByClerkId(req.clerkUserId);
  res.status(201).json({ ...profile!, createdAt: profile!.createdAt.toISOString() });
});

export default router;
