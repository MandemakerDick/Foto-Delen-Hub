import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const themeProposalsTable = pgTable("theme_proposals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  proposedByPhotographerId: integer("proposed_by_photographer_id").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ThemeProposal = typeof themeProposalsTable.$inferSelect;
