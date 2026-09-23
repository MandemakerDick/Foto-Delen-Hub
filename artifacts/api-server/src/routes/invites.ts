import { Router } from "express";
import { randomBytes } from "crypto";
import { db, inviteTokensTable, photographersTable } from "@workspace/db";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { requireAdmin } from "./admins";
import { sendEmail } from "../lib/email";
import { getAuth } from "@clerk/express";

const router = Router();

class InviteRedeemError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

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

  const { userId } = getAuth(req);
  try {
    // The token row lock makes validation, use-count increment, and profile
    // claim one atomic unit. Any conflict rolls back both the count and claim.
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(inviteTokensTable)
        .where(eq(inviteTokensTable.token, token.trim()))
        .limit(1)
        .for("update");

      if (!row) throw new InviteRedeemError(404, "Token not found");
      if (row.revoked) throw new InviteRedeemError(400, "Token has been revoked");
      if (row.expiresAt && row.expiresAt < new Date()) throw new InviteRedeemError(400, "Token has expired");
      if (row.maxUses !== null && row.useCount >= row.maxUses) {
        throw new InviteRedeemError(400, "Token has reached its usage limit");
      }

      // Native clients send Clerk's bearer token rather than the browser's
      // express-session cookie. When authenticated, link a pre-created profile
      // during redemption; the token itself is the authorization to claim it.
      if (userId && row.photographerId) {
        const [existing] = await tx
          .select({ id: photographersTable.id })
          .from(photographersTable)
          .where(eq(photographersTable.clerkUserId, userId));
        if (existing && existing.id !== row.photographerId) {
          throw new InviteRedeemError(409, "Your account already has a different photographer profile");
        }
        const [profile] = await tx
          .select({ clerkUserId: photographersTable.clerkUserId })
          .from(photographersTable)
          .where(eq(photographersTable.id, row.photographerId));
        if (!profile) throw new InviteRedeemError(404, "Photographer profile not found");
        if (profile.clerkUserId && profile.clerkUserId !== userId) {
          throw new InviteRedeemError(409, "This profile is already claimed by another account");
        }
        if (!existing) {
          const claimed = await tx.update(photographersTable)
            .set({ clerkUserId: userId })
            .where(and(eq(photographersTable.id, row.photographerId), isNull(photographersTable.clerkUserId)))
            .returning({ id: photographersTable.id });
          if (claimed.length === 0) {
            throw new InviteRedeemError(409, "This profile is already claimed by another account");
          }
        }
      }

      await tx.update(inviteTokensTable)
        .set({ useCount: row.useCount + 1 })
        .where(and(
          eq(inviteTokensTable.id, row.id),
          eq(inviteTokensTable.useCount, row.useCount),
          or(isNull(inviteTokensTable.maxUses), sql`${inviteTokensTable.useCount} < ${inviteTokensTable.maxUses}`),
        ));
      return { photographerId: row.photographerId ?? null, linked: Boolean(userId && row.photographerId), id: row.id };
    });

    // Only establish the browser grant after the transaction commits.
    req.session.inviteGranted = true;
    req.session.inviteTokenId = result.id;
    if (result.photographerId) req.session.invitePhotographerId = result.photographerId;
    res.json({ ok: true, photographerId: result.photographerId, linked: result.linked });
  } catch (error) {
    if (error instanceof InviteRedeemError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
  }
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
