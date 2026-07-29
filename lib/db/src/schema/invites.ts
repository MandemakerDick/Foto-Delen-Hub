import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { adminsTable } from "./admins";

export const inviteTokensTable = pgTable("invite_token", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  label: text("label").notNull().default(""),
  createdByAdminId: integer("created_by_admin_id").references(() => adminsTable.id, { onDelete: "set null" }),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InviteToken = typeof inviteTokensTable.$inferSelect;
