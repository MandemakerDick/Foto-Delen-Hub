import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, photographersTable, clubsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = userId;
  next();
}

async function getPhotographerByClerkId(clerkUserId: string) {
  const rows = await db
    .select({
      id: photographersTable.id,
      name: photographersTable.name,
      bio: photographersTable.bio,
      avatarUrl: photographersTable.avatarUrl,
      clubId: photographersTable.clubId,
      clubName: clubsTable.name,
      clerkUserId: photographersTable.clerkUserId,
      createdAt: photographersTable.createdAt,
    })
    .from(photographersTable)
    .leftJoin(clubsTable, eq(photographersTable.clubId, clubsTable.id))
    .where(eq(photographersTable.clerkUserId, clerkUserId));
  return rows[0] ?? null;
}

router.get("/me", requireAuth, async (req: any, res) => {
  const profile = await getPhotographerByClerkId(req.clerkUserId);
  if (!profile) {
    res.status(404).json({ error: "No photographer profile linked" });
    return;
  }
  res.json({ ...profile, createdAt: profile.createdAt.toISOString() });
});

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

router.post("/me/profile", requireAuth, async (req: any, res) => {
  const { name, bio, avatarUrl, clubId } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name required" });
    return;
  }

  const existing = await getPhotographerByClerkId(req.clerkUserId);
  if (existing) {
    res.status(409).json({ error: "You already have a profile linked" });
    return;
  }

  const [photographer] = await db
    .insert(photographersTable)
    .values({ name, bio, avatarUrl, clubId, clerkUserId: req.clerkUserId })
    .returning();

  const profile = await getPhotographerByClerkId(req.clerkUserId);
  res.status(201).json({ ...profile!, createdAt: profile!.createdAt.toISOString() });
});

export { requireAuth };
export default router;
