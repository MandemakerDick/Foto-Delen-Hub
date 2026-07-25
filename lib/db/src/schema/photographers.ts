import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const photographersTable = pgTable("photographers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  themeId1: integer("theme_id_1"),
  themeId2: integer("theme_id_2"),
  clerkUserId: text("clerk_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPhotographerSchema = createInsertSchema(photographersTable).omit({ id: true, createdAt: true });
export type InsertPhotographer = z.infer<typeof insertPhotographerSchema>;
export type Photographer = typeof photographersTable.$inferSelect;
