import { Router } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  photographersTable,
  photographerClubsTable,
  photographerThemesTable,
  photographerFollowsTable,
  photoLikesTable,
  clubsTable,
  themesTable,
  photosTable,
} from "@workspace/db";
import { eq, asc, desc, inArray } from "drizzle-orm";
import { buildPhotoSelect, mapPhoto } from "./photos";
import { buildRow, groupByFields, photographerBaseQuery } from "./photographers";

const router = Router();

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
 * clubs and preferred themes.
 *
 * Uses three separate queries instead of a single correlated-subquery SELECT
 * to guarantee correct results regardless of Drizzle ORM version or PostgreSQL
 * query-planner behaviour.
 */
async function getPhotographerByClerkId(clerkUserId: string) {
  const rows = await db
    .select({
      id: photographersTable.id,
      name: photographersTable.name,
      bio: photographersTable.bio,
      avatarUrl: photographersTable.avatarUrl,
      clerkUserId: photographersTable.clerkUserId,
      createdAt: photographersTable.createdAt,
    })
    .from(photographersTable)
    .where(eq(photographersTable.clerkUserId, clerkUserId));

  if (!rows[0]) return null;
  const photographer = rows[0];

  const [clubs, themes] = await Promise.all([
    db
      .select({ id: clubsTable.id, name: clubsTable.name, memberSince: photographerClubsTable.memberSince })
      .from(photographerClubsTable)
      .innerJoin(clubsTable, eq(clubsTable.id, photographerClubsTable.clubId))
      .where(eq(photographerClubsTable.photographerId, photographer.id))
      .orderBy(asc(clubsTable.name)),
    db
      .select({ id: themesTable.id, name: themesTable.name })
      .from(photographerThemesTable)
      .innerJoin(themesTable, eq(themesTable.id, photographerThemesTable.themeId))
      .where(eq(photographerThemesTable.photographerId, photographer.id))
      .orderBy(asc(themesTable.name)),
  ]);

  return { ...photographer, clubs, themes };
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

// GET /api/me/liked-photos — private collection, ordered by most recent like.
router.get("/me/liked-photos", requireAuth, async (req: any, res) => {
  const likes = await db
    .select({ photoId: photoLikesTable.photoId })
    .from(photoLikesTable)
    .where(eq(photoLikesTable.clerkUserId, req.clerkUserId))
    .orderBy(desc(photoLikesTable.createdAt));

  if (likes.length === 0) {
    res.setHeader("Cache-Control", "no-store");
    res.json([]);
    return;
  }

  const rows = await buildPhotoSelect()
    .where(inArray(photosTable.id, likes.map((like) => like.photoId)));
  const byId = new Map(rows.map((row) => [row.id, mapPhoto(row)]));
  res.setHeader("Cache-Control", "no-store");
  res.json(likes.map((like) => byId.get(like.photoId)).filter(Boolean));
});

// GET /api/me/following — private list, ordered by most recently followed.
router.get("/me/following", requireAuth, async (req: any, res) => {
  const follows = await db
    .select({ photographerId: photographerFollowsTable.photographerId })
    .from(photographerFollowsTable)
    .where(eq(photographerFollowsTable.clerkUserId, req.clerkUserId))
    .orderBy(desc(photographerFollowsTable.createdAt));

  if (follows.length === 0) {
    res.setHeader("Cache-Control", "no-store");
    res.json([]);
    return;
  }

  const rows = await photographerBaseQuery()
    .where(inArray(photographersTable.id, follows.map((follow) => follow.photographerId)))
    .groupBy(...groupByFields());
  const byId = new Map(rows.map((row) => [row.id, buildRow(row)]));
  res.setHeader("Cache-Control", "no-store");
  res.json(follows.map((follow) => byId.get(follow.photographerId)).filter(Boolean));
});

// GET /api/me/following/photos — recent public photos from followed photographers.
router.get("/me/following/photos", requireAuth, async (req: any, res) => {
  const follows = await db
    .select({ photographerId: photographerFollowsTable.photographerId })
    .from(photographerFollowsTable)
    .where(eq(photographerFollowsTable.clerkUserId, req.clerkUserId));

  if (follows.length === 0) {
    res.setHeader("Cache-Control", "no-store");
    res.json([]);
    return;
  }

  const rows = await buildPhotoSelect()
    .where(inArray(photosTable.photographerId, follows.map((follow) => follow.photographerId)))
    .orderBy(desc(photosTable.createdAt));
  res.setHeader("Cache-Control", "no-store");
  res.json(rows.map(mapPhoto));
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
  // A profile claim must be backed by the invite grant. This preserves the
  // browser cookie flow while preventing an authenticated user from claiming
  // an arbitrary unlinked photographer profile.
  if (
    req.session?.inviteGranted !== true ||
    req.session.invitePhotographerId !== photographerId
  ) {
    res.status(403).json({ error: "A matching photographer invite is required" });
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

  delete req.session.inviteGranted;
  delete req.session.inviteTokenId;
  delete req.session.invitePhotographerId;
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
