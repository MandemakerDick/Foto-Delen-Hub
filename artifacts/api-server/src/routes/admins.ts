import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./auth";

const router = Router();

async function isAdmin(clerkUserId: string): Promise<boolean> {
  const row = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.clerkUserId, clerkUserId))
    .limit(1);
  return row.length > 0;
}

async function getTotalAdmins(): Promise<number> {
  const rows = await db.select({ id: adminsTable.id }).from(adminsTable);
  return rows.length;
}

async function requireAdmin(req: any, res: any, next: any) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = userId;
  const admin = await isAdmin(userId);
  if (!admin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// GET /api/admins/me — check if signed-in user is admin (also works for bootstrap)
router.get("/admins/me", requireAuth, async (req: any, res) => {
  const admin = await isAdmin(req.clerkUserId);
  const total = await getTotalAdmins();
  res.json({ isAdmin: admin, totalAdmins: total });
});

// GET /api/admins — list admins (admin only)
router.get("/admins", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(adminsTable)
    .orderBy(adminsTable.addedAt);
  res.json(rows.map((r) => ({ ...r, addedAt: r.addedAt.toISOString() })));
});

// POST /api/admins — add admin (admin only)
router.post("/admins", requireAdmin, async (req: any, res) => {
  const { clerkUserId, displayName, email } = req.body as {
    clerkUserId?: string;
    displayName?: string;
    email?: string;
  };

  if (!clerkUserId || typeof clerkUserId !== "string") {
    res.status(400).json({ error: "clerkUserId required" });
    return;
  }
  if (!displayName || typeof displayName !== "string") {
    res.status(400).json({ error: "displayName required" });
    return;
  }

  const existing = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.clerkUserId, clerkUserId))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "This user is already an admin" });
    return;
  }

  const [row] = await db
    .insert(adminsTable)
    .values({ clerkUserId, displayName, email: email ?? null })
    .returning();

  res.status(201).json({ ...row, addedAt: row.addedAt.toISOString() });
});

// POST /api/admins/bootstrap — become the first admin (only when zero admins exist)
router.post("/admins/bootstrap", requireAuth, async (req: any, res) => {
  const total = await getTotalAdmins();
  if (total > 0) {
    res.status(403).json({ error: "Admins already exist" });
    return;
  }

  const existing = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.clerkUserId, req.clerkUserId))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Already an admin" });
    return;
  }

  const [row] = await db
    .insert(adminsTable)
    .values({ clerkUserId: req.clerkUserId, displayName: "Admin", email: null })
    .returning();

  res.status(201).json({ ...row, addedAt: row.addedAt.toISOString() });
});

// DELETE /api/admins/:id — remove admin (admin only, cannot remove self)
router.delete("/admins/:id", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [target] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, id))
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  if (target.clerkUserId === req.clerkUserId) {
    res.status(400).json({ error: "Cannot remove yourself" });
    return;
  }

  await db.delete(adminsTable).where(eq(adminsTable.id, id));
  res.status(204).send();
});

export { isAdmin, requireAdmin };
export default router;
