import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const photographersTable = pgTable("photographer", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  // NULL remains valid for unclaimed/admin-created profiles.
  clerkUserId: text("clerk_user_id").unique("photographer_clerk_user_id_unique"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPhotographerSchema = createInsertSchema(photographersTable).omit({ id: true, createdAt: true });
export type InsertPhotographer = z.infer<typeof insertPhotographerSchema>;
export type Photographer = typeof photographersTable.$inferSelect;
