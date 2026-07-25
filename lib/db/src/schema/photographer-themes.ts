import { pgTable, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * Junction table for many-to-many photographer ↔ preferred theme.
 * A photographer can prefer multiple themes; a theme can be preferred by many photographers.
 */
export const photographerThemesTable = pgTable(
  "photographer_themes",
  {
    photographerId: integer("photographer_id").notNull(),
    themeId: integer("theme_id").notNull(),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.photographerId, table.themeId] })],
);

export type PhotographerTheme = typeof photographerThemesTable.$inferSelect;
