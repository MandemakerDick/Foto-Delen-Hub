import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  passwordHash: text("password_hash"),
  isOwner: boolean("is_owner").notNull().default(false),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertAdminSchema = createInsertSchema(adminsTable).omit({ id: true, addedAt: true });
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof adminsTable.$inferSelect;
