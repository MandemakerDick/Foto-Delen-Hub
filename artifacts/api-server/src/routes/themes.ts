import { Router } from "express";
import { db, themesTable, photosTable, themeProposalsTable, photographersTable } from "@workspace/db";
import { eq, ilike, count } from "drizzle-orm";
import {
  ListThemesQueryParams,
  CreateThemeBody,
  UpdateThemeBody,
  UpdateThemeParams,
  DeleteThemeParams,
} from "@workspace/api-zod";
import { requireAdmin } from "./admins";
import { requireAuth } from "./auth";
import { getPhotographerIdForClerkUser } from "../lib/db-helpers";
import { clerkClient } from "@clerk/express";
import { ReplitConnectors } from "@replit/connectors-sdk";

/** Send an email to a photographer notifying them of their proposal outcome. */
async function sendProposalStatusEmail(
  clerkUserId: string | null | undefined,
  proposalName: string,
  status: "approved" | "rejected",
) {
  if (!clerkUserId) return;
  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return;
    const connectors = new ReplitConnectors();
    const from = process.env.EMAIL_FROM ?? "PhotoMatrix <onboarding@resend.dev>";
    const isApproved = status === "approved";
    await connectors.proxy("resend", "/emails", {
      method: "POST",
      body: JSON.stringify({
        from,
        to: [email],
        subject: isApproved
          ? `Your theme proposal "${proposalName}" has been approved`
          : `Your theme proposal "${proposalName}" was not accepted`,
        html: isApproved
          ? `<p>Good news! Your theme proposal <strong>"${proposalName}"</strong> has been approved and added to the theme library. You can now tag your photos with this theme.</p><p>— The PhotoMatrix Team</p>`
          : `<p>Thank you for your suggestion. Unfortunately, your theme proposal <strong>"${proposalName}"</strong> has not been accepted at this time.</p><p>Feel free to submit another — we welcome your ideas!</p><p>— The PhotoMatrix Team</p>`,
        text: isApproved
          ? `Good news! Your theme proposal "${proposalName}" has been approved and added to the theme library.\n\n— The PhotoMatrix Team`
          : `Thank you for your suggestion. Unfortunately, your theme proposal "${proposalName}" has not been accepted at this time. Feel free to submit another!\n\n— The PhotoMatrix Team`,
      }),
    });
  } catch (err) {
    console.error("Failed to send proposal status email:", err);
  }
}

const router = Router();

/** Shared SELECT fields: theme columns + a photo count via LEFT JOIN. */
const themeSelectFields = {
  id: themesTable.id,
  name: themesTable.name,
  description: themesTable.description,
  createdAt: themesTable.createdAt,
  photoCount: count(photosTable.id),
};

/** Apply the LEFT JOIN on photos and GROUP BY required to compute photoCount. */
function themeBaseQuery() {
  return db
    .select(themeSelectFields)
    .from(themesTable)
    .leftJoin(photosTable, eq(photosTable.themeId, themesTable.id));
}

/** Serialise a theme row — convert the Date to ISO string for JSON output. */
function mapTheme(t: { createdAt: Date; [key: string]: unknown }) {
  return { ...t, createdAt: t.createdAt.toISOString() };
}

// GET /api/themes — list all themes, optionally filtered by name search
router.get("/themes", async (req, res) => {
  const query = ListThemesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { search } = query.data;

  const themes = await themeBaseQuery()
    .where(search ? ilike(themesTable.name, `%${search}%`) : undefined)
    .groupBy(themesTable.id)
    .orderBy(themesTable.name);

  res.json(themes.map(mapTheme));
});

// GET /api/themes/my-proposals — list the logged-in photographer's own proposals
router.get("/themes/my-proposals", requireAuth, async (req: any, res) => {
  const photographerId = await getPhotographerIdForClerkUser(req.clerkUserId);
  if (!photographerId) {
    res.json([]);
    return;
  }
  const rows = await db
    .select({
      id: themeProposalsTable.id,
      name: themeProposalsTable.name,
      description: themeProposalsTable.description,
      status: themeProposalsTable.status,
      createdAt: themeProposalsTable.createdAt,
    })
    .from(themeProposalsTable)
    .where(eq(themeProposalsTable.proposedByPhotographerId, photographerId))
    .orderBy(themeProposalsTable.createdAt);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// GET /api/themes/proposals — list all pending proposals (admin only)
router.get("/themes/proposals", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: themeProposalsTable.id,
      name: themeProposalsTable.name,
      description: themeProposalsTable.description,
      proposedByPhotographerId: themeProposalsTable.proposedByPhotographerId,
      proposedByPhotographerName: photographersTable.name,
      status: themeProposalsTable.status,
      createdAt: themeProposalsTable.createdAt,
    })
    .from(themeProposalsTable)
    .leftJoin(photographersTable, eq(themeProposalsTable.proposedByPhotographerId, photographersTable.id))
    .orderBy(themeProposalsTable.createdAt);

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// POST /api/themes/propose — photographer or admin proposes a new theme
// Accepts either a Clerk session (photographer) or an admin session.
async function requireAuthOrAdmin(req: any, res: any, next: any) {
  // Try admin first (handles both Clerk-admin and session-admin)
  const { userId } = (await import("@clerk/express")).getAuth(req);
  if (userId) {
    req.clerkUserId = userId;
    return next();
  }
  if (req.session?.adminId) {
    req.adminId = req.session.adminId;
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

router.post("/themes/propose", requireAuthOrAdmin, async (req: any, res) => {
  const { name, description } = req.body as { name?: string; description?: string | null };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  // Resolve photographer ID only for Clerk users (photographers).
  // Admins propose without a photographer profile — proposedByPhotographerId stays null.
  let photographerId: number | null = null;
  if (req.clerkUserId && !req.adminId) {
    photographerId = await getPhotographerIdForClerkUser(req.clerkUserId);
    if (!photographerId) {
      res.status(403).json({ error: "No photographer profile found" });
      return;
    }
  }

  const [proposal] = await db
    .insert(themeProposalsTable)
    .values({
      name: name.trim(),
      description: description?.trim() || null,
      proposedByPhotographerId: photographerId,
    })
    .returning();

  res.status(201).json({
    ...proposal,
    proposedByPhotographerName: null,
    createdAt: proposal.createdAt.toISOString(),
  });
});

// POST /api/themes/proposals/:id/approve — admin approves → creates theme
router.post("/themes/proposals/:id/approve", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [proposal] = await db
    .select()
    .from(themeProposalsTable)
    .where(eq(themeProposalsTable.id, id));

  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }

  const [theme] = await db
    .insert(themesTable)
    .values({ name: proposal.name, description: proposal.description ?? null })
    .returning();

  await db
    .update(themeProposalsTable)
    .set({ status: "approved" })
    .where(eq(themeProposalsTable.id, id));

  // Notify the proposer by email (non-blocking)
  if (proposal.proposedByPhotographerId) {
    const [photographer] = await db
      .select({ clerkUserId: photographersTable.clerkUserId })
      .from(photographersTable)
      .where(eq(photographersTable.id, proposal.proposedByPhotographerId));
    sendProposalStatusEmail(photographer?.clerkUserId, proposal.name, "approved");
  }

  res.status(201).json({ ...theme, photoCount: 0, createdAt: theme.createdAt.toISOString() });
});

// DELETE /api/themes/proposals/:id — admin rejects a proposal (marks as rejected, keeps the row)
router.delete("/themes/proposals/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [proposal] = await db
    .select({
      id: themeProposalsTable.id,
      name: themeProposalsTable.name,
      proposedByPhotographerId: themeProposalsTable.proposedByPhotographerId,
    })
    .from(themeProposalsTable)
    .where(eq(themeProposalsTable.id, id));

  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }

  await db
    .update(themeProposalsTable)
    .set({ status: "rejected" })
    .where(eq(themeProposalsTable.id, id));

  // Notify the proposer by email (non-blocking)
  if (proposal.proposedByPhotographerId) {
    const [photographer] = await db
      .select({ clerkUserId: photographersTable.clerkUserId })
      .from(photographersTable)
      .where(eq(photographersTable.id, proposal.proposedByPhotographerId));
    sendProposalStatusEmail(photographer?.clerkUserId, proposal.name, "rejected");
  }

  res.status(204).send();
});

// DELETE /api/themes/my-proposals/:id — photographer withdraws their own pending proposal
router.delete("/themes/my-proposals/:id", requireAuth, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const photographerId = await getPhotographerIdForClerkUser(req.clerkUserId);
  if (!photographerId) { res.status(403).json({ error: "No photographer profile" }); return; }

  const [proposal] = await db
    .select()
    .from(themeProposalsTable)
    .where(eq(themeProposalsTable.id, id));

  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }
  if (proposal.proposedByPhotographerId !== photographerId) {
    res.status(403).json({ error: "Not your proposal" }); return;
  }
  if (proposal.status !== "pending") {
    res.status(400).json({ error: "Only pending proposals can be withdrawn" }); return;
  }

  await db.delete(themeProposalsTable).where(eq(themeProposalsTable.id, id));
  res.status(204).send();
});

// GET /api/themes/:id — fetch a single theme by id
router.get("/themes/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [theme] = await themeBaseQuery()
    .where(eq(themesTable.id, id))
    .groupBy(themesTable.id);

  if (!theme) { res.status(404).json({ error: "Not found" }); return; }
  res.json(mapTheme(theme));
});

// POST /api/themes — create a new theme
router.post("/themes", async (req, res) => {
  const body = CreateThemeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [theme] = await db.insert(themesTable).values(body.data).returning();
  res.status(201).json({ ...theme, photoCount: 0, createdAt: theme.createdAt.toISOString() });
});

// PUT /api/themes/:id — update a theme's name / description
router.put("/themes/:id", async (req, res) => {
  const params = UpdateThemeParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateThemeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const existing = await db
    .select({ id: themesTable.id })
    .from(themesTable)
    .where(eq(themesTable.id, params.data.id));
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db
    .update(themesTable)
    .set(body.data)
    .where(eq(themesTable.id, params.data.id))
    .returning();

  const [row] = await themeBaseQuery()
    .where(eq(themesTable.id, updated.id))
    .groupBy(themesTable.id);

  res.json(mapTheme(row));
});

// DELETE /api/themes/:id — delete a theme
router.delete("/themes/:id", async (req, res) => {
  const params = DeleteThemeParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const existing = await db
    .select({ id: themesTable.id })
    .from(themesTable)
    .where(eq(themesTable.id, params.data.id));
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(themesTable).where(eq(themesTable.id, params.data.id));
  res.status(204).send();
});

export default router;
