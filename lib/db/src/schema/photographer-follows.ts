import { integer, pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

/** Private member → photographer relationships. */
export const photographerFollowsTable = pgTable(
  "photographer_follow",
  {
    photographerId: integer("photographer_id").notNull(),
    clerkUserId: text("clerk_user_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.photographerId, table.clerkUserId] })],
);

export type PhotographerFollow = typeof photographerFollowsTable.$inferSelect;