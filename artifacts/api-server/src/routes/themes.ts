import { Router } from "express";
import { db, themesTable, photosTable } from "@workspace/db";
import { eq, ilike, count } from "drizzle-orm";
import { ListThemesQueryParams, CreateThemeBody } from "@workspace/api-zod";

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

router.post("/themes", async (req, res) => {
  const body = CreateThemeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [theme] = await db.insert(themesTable).values(body.data).returning();
  res.status(201).json({ ...theme, photoCount: 0, createdAt: theme.createdAt.toISOString() });
});

export default router;
