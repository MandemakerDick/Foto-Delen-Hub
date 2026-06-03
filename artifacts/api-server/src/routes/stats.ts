import { Router } from "express";
import { db, photosTable, clubsTable, photographersTable, themesTable } from "@workspace/db";
import { count, gte } from "drizzle-orm";

const router = Router();

// GET /api/stats — aggregate counts used by the home-page dashboard.
// Each count is a separate query; Postgres handles them quickly on small tables.
// recentUploads counts photos uploaded in the past 7 days.
router.get("/stats", async (_req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalPhotosRow] = await db.select({ value: count() }).from(photosTable);
  const [totalClubsRow] = await db.select({ value: count() }).from(clubsTable);
  const [totalPhotographersRow] = await db.select({ value: count() }).from(photographersTable);
  const [totalThemesRow] = await db.select({ value: count() }).from(themesTable);
  const [recentRow] = await db
    .select({ value: count() })
    .from(photosTable)
    .where(gte(photosTable.createdAt, sevenDaysAgo));

  res.json({
    totalPhotos: totalPhotosRow.value,
    totalClubs: totalClubsRow.value,
    totalPhotographers: totalPhotographersRow.value,
    totalThemes: totalThemesRow.value,
    recentUploads: recentRow.value,
  });
});

export default router;
