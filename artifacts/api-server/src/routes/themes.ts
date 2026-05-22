import { Router } from "express";
import { db, themesTable, photosTable } from "@workspace/db";
import { eq, ilike, count } from "drizzle-orm";
import { ListThemesQueryParams, CreateThemeBody, UpdateThemeBody, UpdateThemeParams, DeleteThemeParams } from "@workspace/api-zod";

const router = Router();

router.get("/themes", async (req, res) => {
  const query = ListThemesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { search } = query.data;

  const themes = await db
    .select({
      id: themesTable.id,
      name: themesTable.name,
      description: themesTable.description,
      createdAt: themesTable.createdAt,
      photoCount: count(photosTable.id),
    })
    .from(themesTable)
    .leftJoin(photosTable, eq(photosTable.themeId, themesTable.id))
    .where(search ? ilike(themesTable.name, `%${search}%`) : undefined)
    .groupBy(themesTable.id)
    .orderBy(themesTable.name);

  res.json(themes.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

router.get("/themes/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [theme] = await db
    .select({
      id: themesTable.id,
      name: themesTable.name,
      description: themesTable.description,
      createdAt: themesTable.createdAt,
      photoCount: count(photosTable.id),
    })
    .from(themesTable)
    .leftJoin(photosTable, eq(photosTable.themeId, themesTable.id))
    .where(eq(themesTable.id, id))
    .groupBy(themesTable.id);

  if (!theme) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...theme, createdAt: theme.createdAt.toISOString() });
});

router.post("/themes", async (req, res) => {
  const body = CreateThemeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [theme] = await db.insert(themesTable).values(body.data).returning();
  res.status(201).json({ ...theme, photoCount: 0, createdAt: theme.createdAt.toISOString() });
});

router.put("/themes/:id", async (req, res) => {
  const params = UpdateThemeParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateThemeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const existing = await db.select({ id: themesTable.id }).from(themesTable).where(eq(themesTable.id, params.data.id));
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(themesTable).set(body.data).where(eq(themesTable.id, params.data.id)).returning();

  const [row] = await db
    .select({ id: themesTable.id, name: themesTable.name, description: themesTable.description, createdAt: themesTable.createdAt, photoCount: count(photosTable.id) })
    .from(themesTable)
    .leftJoin(photosTable, eq(photosTable.themeId, themesTable.id))
    .where(eq(themesTable.id, updated.id))
    .groupBy(themesTable.id);

  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/themes/:id", async (req, res) => {
  const params = DeleteThemeParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const existing = await db.select({ id: themesTable.id }).from(themesTable).where(eq(themesTable.id, params.data.id));
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(themesTable).where(eq(themesTable.id, params.data.id));
  res.status(204).send();
});

export default router;
