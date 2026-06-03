import { Router } from "express";
import { randomBytes } from "crypto";
import { db, inviteTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./admins";

const router = Router();

/** Serialise an invite token row — convert dates to ISO strings for JSON. */
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

// POST /api/invites — create a new invite token (admin only).
// Tokens are 16 random bytes encoded as hex (32 chars).
// Optional: maxUses (null = unlimited), expiresInDays (null = no expiry).
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
      createdByAdminId: req.adminId ?? null,
    })
    .returning();

  res.status(201).json(serializeToken(row));
});

// DELETE /api/invites/:id — revoke an invite token (admin only).
// Sets revoked = true rather than deleting, to preserve audit history.
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

// POST /api/invites/redeem — exchange a token for a session-level access grant.
// Validates: token exists, not revoked, not expired, within usage limit.
// On success: increments useCount, sets req.session.inviteGranted = true.
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

  if (!row) { res.status(404).json({ error: "Token not found" }); return; }
  if (row.revoked) { res.status(400).json({ error: "Token has been revoked" }); return; }
  if (row.expiresAt && row.expiresAt < new Date()) { res.status(400).json({ error: "Token has expired" }); return; }
  if (row.maxUses !== null && row.useCount >= row.maxUses) {
    res.status(400).json({ error: "Token has reached its usage limit" });
    return;
  }

  await db
    .update(inviteTokensTable)
    .set({ useCount: row.useCount + 1 })
    .where(eq(inviteTokensTable.id, row.id));

  req.session.inviteGranted = true;
  req.session.inviteTokenId = row.id;

  res.json({ ok: true });
});

// GET /api/invites/session — check whether the current session holds an invite grant
router.get("/invites/session", (req: any, res) => {
  res.json({ hasAccess: req.session?.inviteGranted === true });
});

export default router;
