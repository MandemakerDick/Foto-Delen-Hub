import { pgTable, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * Junction table for many-to-many photographer ↔ club membership.
 * A photographer can belong to multiple clubs; a club has many members.
 */
export const photographerClubsTable = pgTable(
  "photographer_clubs",
  {
    photographerId: integer("photographer_id").notNull(),
    clubId: integer("club_id").notNull(),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.photographerId, table.clubId] })],
);

export type PhotographerClub = typeof photographerClubsTable.$inferSelect;
