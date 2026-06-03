import { Router } from "express";
import { db, themesTable, photosTable } from "@workspace/db";
import { eq, ilike, count } from "drizzle-orm";
import {
  ListThemesQueryParams,
  CreateThemeBody,
  UpdateThemeBody,
  UpdateThemeParams,
  DeleteThemeParams,
} from "@workspace/api-zod";

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

  // Re-fetch with photoCount so the response matches the list/get shape
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
