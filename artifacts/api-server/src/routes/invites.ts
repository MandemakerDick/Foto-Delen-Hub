import { Router } from "express";
import { randomBytes } from "crypto";
import { db, inviteTokensTable, photographersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./admins";
import { sendEmail } from "../lib/email";

const router = Router();

/** Serialise an invite token row — convert dates to ISO strings for JSON. */
function serializeToken(t: typeof inviteTokensTable.$inferSelect) {
  return {
    id: t.id,
    token: t.token,
    label: t.label,
    photographerId: t.photographerId ?? null,
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
// Optional: photographerId (pre-links to a profile), maxUses, expiresInDays.
router.post("/invites", requireAdmin, async (req: any, res) => {
  const { label, photographerId, maxUses, expiresInDays } = req.body as {
    label?: string;
    photographerId?: number | null;
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
      photographerId: photographerId ?? null,
      maxUses: maxUses ?? null,
      useCount: 0,
      expiresAt,
      revoked: false,
      createdByAdminId: req.adminId ?? null,
    })
    .returning();

  res.status(201).json(serializeToken(row));
});

// POST /api/invites/send-email — create a token linked to a specific photographer
// and send them a join-link email via Resend (admin only).
router.post("/invites/send-email", requireAdmin, async (req: any, res) => {
  const { photographerId, email, label } = req.body as {
    photographerId?: number;
    email?: string;
    label?: string;
  };

  if (!photographerId || typeof photographerId !== "number") {
    res.status(400).json({ error: "photographerId required" });
    return;
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "valid email required" });
    return;
  }

  // Verify the photographer exists.
  const [photographer] = await db
    .select({ id: photographersTable.id, name: photographersTable.name, email: photographersTable.email })
    .from(photographersTable)
    .where(eq(photographersTable.id, photographerId));

  if (!photographer) {
    res.status(404).json({ error: "Photographer not found" });
    return;
  }

  const token = randomBytes(16).toString("hex");
  const [row] = await db
    .insert(inviteTokensTable)
    .values({
      token,
      label: label?.trim() || `Invite for ${photographer.name}`,
      photographerId,
      maxUses: 1,
      useCount: 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      revoked: false,
      createdByAdminId: req.adminId ?? null,
    })
    .returning();

  // Persist email on photographer so future invites can be pre-filled.
  if (!photographer.email || photographer.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    await db.update(photographersTable).set({ email: email.trim() }).where(eq(photographersTable.id, photographerId));
  }

  // Send the invite email.
  const joinUrl = `${process.env.APP_ORIGIN ?? "https://photomatrix.repl.co"}/join/${token}`;
  try {
    await sendEmail({
      to: email.trim(),
      subject: `You've been invited to join PhotoMatrix`,
      html: `<p>Hi ${photographer.name},</p><p>An administrator has set up a photographer profile for you on PhotoMatrix. Click the link below to create your account and claim your profile:</p><p><a href="${joinUrl}">${joinUrl}</a></p><p>This link expires in 30 days and can only be used once.</p><p>— The PhotoMatrix Team</p>`,
      text: `Hi ${photographer.name},\n\nAn administrator has set up a photographer profile for you on PhotoMatrix. Click the link below to create your account and claim your profile:\n\n${joinUrl}\n\nThis link expires in 30 days and can only be used once.\n\n— The PhotoMatrix Team`,
    });
  } catch (err) {
    // Log but still return the token — admin can copy it manually.
    req.log.warn({ err, photographerId }, "Failed to send invite email");
  }

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
// On success: increments useCount, sets req.session.inviteGranted = true,
// and stores photographerId (if set) for auto-linking after Clerk sign-in.
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
  if (row.photographerId) {
    req.session.invitePhotographerId = row.photographerId;
  }

  res.json({ ok: true });
});

// GET /api/invites/session — check whether the current session holds an invite grant.
// Also returns photographerId when the token was linked to a pre-created profile.
router.get("/invites/session", (req: any, res) => {
  res.json({
    hasAccess: req.session?.inviteGranted === true,
    photographerId: req.session?.invitePhotographerId ?? null,
  });
});

export default router;
