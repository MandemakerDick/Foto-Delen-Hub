import { integer, pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * One row per member/photo pair. The aggregate photo.like_count remains the
 * public total; this table only records new member-owned reactions.
 */
export const photoLikesTable = pgTable(
  "photo_like",
  {
    photoId: integer("photo_id").notNull(),
    clerkUserId: text("clerk_user_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.photoId, table.clerkUserId] })],
);

export type PhotoLike = typeof photoLikesTable.$inferSelect;