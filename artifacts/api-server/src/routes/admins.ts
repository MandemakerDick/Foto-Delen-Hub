import { Router } from "express";
import bcrypt from "bcryptjs";
import { getAuth, clerkClient } from "@clerk/express";
import { db, adminsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "./auth";

const router = Router();

function serializeAdmin(r: typeof adminsTable.$inferSelect) {
  return {
    id: r.id,
    clerkUserId: r.clerkUserId ?? null,
    displayName: r.displayName,
    email: r.email ?? null,
    isOwner: r.isOwner,
    hasPassword: r.passwordHash !== null,
    addedAt: r.addedAt.toISOString(),
  };
}

async function getAdminByClerkId(clerkUserId: string) {
  const rows = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0] ?? null;
}

async function getAdminByEmail(email: string) {
  const rows = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email))
    .limit(1);
  return rows[0] ?? null;
}

// Look up a Clerk user's primary email address via the Clerk backend API
async function getClerkUserEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

// Find admin by Clerk ID, falling back to email match and auto-linking the Clerk ID
async function resolveClerkAdmin(userId: string) {
  const byId = await getAdminByClerkId(userId);
  if (byId) return byId;

  const email = await getClerkUserEmail(userId);
  if (!email) return null;

  const byEmail = await getAdminByEmail(email);
  if (!byEmail) return null;

  // Auto-link this Clerk ID to the existing admin record so future lookups are instant
  await db.update(adminsTable).set({ clerkUserId: userId }).where(eq(adminsTable.id, byEmail.id));
  return { ...byEmail, clerkUserId: userId };
}

async function getAdminById(id: number) {
  const rows = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function getTotalAdmins(): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(adminsTable);
  return value;
}

// Accepts either a Clerk-authenticated admin OR a session-based admin
async function requireAdmin(req: any, res: any, next: any) {
  // Option 1: Clerk session
  const { userId } = getAuth(req);
  if (userId) {
    const admin = await resolveClerkAdmin(userId);
    if (admin) {
      req.clerkUserId = userId;
      req.adminId = admin.id;
      return next();
    }
  }

  // Option 2: Password-based session
  const sessionAdminId = req.session?.adminId as number | undefined;
  if (sessionAdminId) {
    const admin = await getAdminById(sessionAdminId);
    if (admin) {
      req.adminId = admin.id;
      return next();
    }
  }

  res.status(401).json({ error: "Unauthorized" });
}

// POST /api/admins/login — email + password sign-in
router.post("/admins/login", async (req: any, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email and password required" });
    return;
  }

  const rows = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email.trim().toLowerCase()))
    .limit(1);

  const admin = rows[0];
  if (!admin || !admin.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.adminId = admin.id;
  res.json({ ok: true });
});

// POST /api/admins/logout — clear session
router.post("/admins/logout", (req: any, res) => {
  req.session.adminId = undefined;
  res.status(204).end();
});

// GET /api/admins/me — check admin status (Clerk or session)
router.get("/admins/me", async (req: any, res) => {
  const total = await getTotalAdmins();

  // Check Clerk
  const { userId } = getAuth(req);
  if (userId) {
    const admin = await resolveClerkAdmin(userId);
    res.json({ isAdmin: !!admin, totalAdmins: total, displayName: admin?.displayName ?? null });
    return;
  }

  // Check session
  const sessionAdminId = req.session?.adminId as number | undefined;
  if (sessionAdminId) {
    const admin = await getAdminById(sessionAdminId);
    res.json({ isAdmin: !!admin, totalAdmins: total, displayName: admin?.displayName ?? null });
    return;
  }

  // Not authenticated at all — still return total so bootstrap check works
  res.json({ isAdmin: false, totalAdmins: total, displayName: null });
});

// GET /api/admins — list all admins (admin only)
router.get("/admins", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(adminsTable).orderBy(adminsTable.addedAt);
  res.json(rows.map(serializeAdmin));
});

// POST /api/admins — add a new admin (admin only)
router.post("/admins", requireAdmin, async (req: any, res) => {
  const { displayName, email, password } = req.body as {
    displayName?: string;
    email?: string;
    password?: string;
  };

  if (!displayName?.trim()) {
    res.status(400).json({ error: "displayName required" });
    return;
  }
  if (!email?.trim()) {
    res.status(400).json({ error: "email required" });
    return;
  }
  if (!password?.trim()) {
    res.status(400).json({ error: "password required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An admin with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [row] = await db
    .insert(adminsTable)
    .values({
      displayName: displayName.trim(),
      email: normalizedEmail,
      passwordHash,
      isOwner: false,
    })
    .returning();

  res.status(201).json(serializeAdmin(row));
});

// POST /api/admins/bootstrap — owner becomes first admin (Clerk only)
router.post("/admins/bootstrap", requireAuth, async (req: any, res) => {
  const total = await getTotalAdmins();
  if (total > 0) {
    res.status(403).json({ error: "Admins already exist" });
    return;
  }

  const existing = await getAdminByClerkId(req.clerkUserId);
  if (existing) {
    res.status(409).json({ error: "Already an admin" });
    return;
  }

  const bodyName: string | undefined = req.body?.displayName;
  const bodyEmail: string | undefined = req.body?.email;

  const [row] = await db
    .insert(adminsTable)
    .values({
      clerkUserId: req.clerkUserId,
      displayName: bodyName || "Admin",
      email: bodyEmail ? bodyEmail.trim().toLowerCase() : null,
      isOwner: true,
    })
    .returning();

  res.status(201).json(serializeAdmin(row));
});

// POST /api/admins/:id/set-password — set or update password (admin only)
router.post("/admins/:id/set-password", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { password } = req.body as { password?: string };
  if (!password?.trim()) { res.status(400).json({ error: "password required" }); return; }

  const target = await getAdminById(id);
  if (!target) { res.status(404).json({ error: "Admin not found" }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(adminsTable).set({ passwordHash }).where(eq(adminsTable.id, id));
  res.status(204).end();
});

// PATCH /api/admins/:id — update display name / email (admin only)
router.patch("/admins/:id", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { displayName, email } = req.body as { displayName?: string; email?: string | null };

  const target = await getAdminById(id);
  if (!target) { res.status(404).json({ error: "Admin not found" }); return; }

  const updates: Partial<typeof adminsTable.$inferInsert> = {};
  if (displayName !== undefined && displayName.trim()) updates.displayName = displayName.trim();
  if (email !== undefined) updates.email = email ? email.trim().toLowerCase() : null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" }); return;
  }

  const [updated] = await db.update(adminsTable).set(updates).where(eq(adminsTable.id, id)).returning();
  res.json(serializeAdmin(updated));
});

// DELETE /api/admins/:id — remove admin (cannot remove self)
router.delete("/admins/:id", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const target = await getAdminById(id);
  if (!target) { res.status(404).json({ error: "Admin not found" }); return; }

  const isSelf =
    (req.clerkUserId && target.clerkUserId === req.clerkUserId) ||
    (req.adminId && target.id === req.adminId);

  if (isSelf) { res.status(400).json({ error: "Cannot remove yourself" }); return; }

  await db.delete(adminsTable).where(eq(adminsTable.id, id));
  res.status(204).end();
});

export { requireAdmin };
export default router;
