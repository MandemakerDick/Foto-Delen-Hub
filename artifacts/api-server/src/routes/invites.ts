import { Router } from "express";
import { randomBytes } from "crypto";
import { db, inviteTokensTable, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./auth";
import { getAuth } from "@clerk/express";

const router = Router();

async function isAdmin(clerkUserId: string): Promise<boolean> {
  const row = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.clerkUserId, clerkUserId))
    .limit(1);
  return row.length > 0;
}

async function requireAdmin(req: any, res: any, next: any) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const admin = await isAdmin(userId);
  if (!admin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  req.clerkUserId = userId;
  req.adminRow = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.clerkUserId, userId))
    .limit(1)
    .then((r) => r[0]);
  next();
}

function serializeToken(t: typeof inviteTokensTable.$inferSelect) {
  return {
    id: t.id,
    token: t.token,
    label: t.label,
    maxUses: t.maxUses ?? null,
    useCount: t.useCount,
    expiresAt: t.expiresAt ? t.expiresAt.toISOString() : null,
    revoked: t.revoked,
    createdAt: t.createdAt.toISOString(),
  };
}

// GET /api/invites — list all invite tokens (admin only)
router.get("/invites", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(inviteTokensTable)
    .orderBy(inviteTokensTable.createdAt);
  res.json(rows.map(serializeToken));
});

// POST /api/invites — create a new invite token (admin only)
router.post("/invites", requireAdmin, async (req: any, res) => {
  const { label, maxUses, expiresInDays } = req.body as {
    label?: string;
    maxUses?: number | null;
    expiresInDays?: number | null;
  };

  const token = randomBytes(16).toString("hex");
  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const [row] = await db
    .insert(inviteTokensTable)
    .values({
      token,
      label: label?.trim() || "Invite",
      maxUses: maxUses ?? null,
      useCount: 0,
      expiresAt,
      revoked: false,
      createdByAdminId: req.adminRow?.id ?? null,
    })
    .returning();

  res.status(201).json(serializeToken(row));
});

// DELETE /api/invites/:id — revoke an invite token (admin only)
router.delete("/invites/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select()
    .from(inviteTokensTable)
    .where(eq(inviteTokensTable.id, id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db
    .update(inviteTokensTable)
    .set({ revoked: true })
    .where(eq(inviteTokensTable.id, id));

  res.status(204).end();
});

// POST /api/invites/redeem — exchange a token for a session grant
router.post("/invites/redeem", async (req: any, res) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "Token required" });
    return;
  }

  const [row] = await db
    .select()
    .from(inviteTokensTable)
    .where(eq(inviteTokensTable.token, token.trim()))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Token not found" });
    return;
  }

  if (row.revoked) {
    res.status(400).json({ error: "Token has been revoked" });
    return;
  }

  if (row.expiresAt && row.expiresAt < new Date()) {
    res.status(400).json({ error: "Token has expired" });
    return;
  }

  if (row.maxUses !== null && row.useCount >= row.maxUses) {
    res.status(400).json({ error: "Token has reached its usage limit" });
    return;
  }

  // Increment use count
  await db
    .update(inviteTokensTable)
    .set({ useCount: row.useCount + 1 })
    .where(eq(inviteTokensTable.id, row.id));

  // Grant access in session
  req.session.inviteGranted = true;
  req.session.inviteTokenId = row.id;

  res.json({ ok: true });
});

// GET /api/invites/session — check if current session has invite access
router.get("/invites/session", (req: any, res) => {
  res.json({ hasAccess: req.session?.inviteGranted === true });
});

export default router;
