import { pgTable, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * Junction table for many-to-many photographer ↔ club membership.
 * A photographer can belong to multiple clubs; a club has many members.
 * memberSince stores the year (e.g. 2019) the photographer joined the club —
 * distinct from joinedAt (when the DB record was created) and from the club's
 * own yearEstablished.
 */
export const photographerClubsTable = pgTable(
  "photographer_club",
  {
    photographerId: integer("photographer_id").notNull(),
    clubId: integer("club_id").notNull(),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    memberSince: integer("member_since"),  // optional year the photographer joined
  },
  (table) => [primaryKey({ columns: [table.photographerId, table.clubId] })],
);

export type PhotographerClub = typeof photographerClubsTable.$inferSelect;
