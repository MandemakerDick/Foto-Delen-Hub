import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clubsTable = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),
  yearEstablished: integer("year_established"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClubSchema = createInsertSchema(clubsTable).omit({ id: true, createdAt: true });
export type InsertClub = z.infer<typeof insertClubSchema>;
export type Club = typeof clubsTable.$inferSelect;
