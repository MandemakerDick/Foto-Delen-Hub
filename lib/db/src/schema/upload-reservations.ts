import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const uploadReservationsTable = pgTable("upload_reservation", {
  objectPath: text("object_path").primaryKey(),
  // Pending covers both never-attached uploads and last-reference retirement.
  // Deleting/deleted tombstones prohibit attachment after collection begins.
  status: text("status", { enum: ["pending", "attached", "deleting", "deleted"] }).notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  retryAt: timestamp("retry_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("upload_reservation_status_expiry_idx").on(table.status, table.expiresAt),
]);

export const insertUploadReservationSchema = createInsertSchema(uploadReservationsTable).omit({ createdAt: true });
export type UploadReservation = typeof uploadReservationsTable.$inferSelect;
export type InsertUploadReservation = typeof uploadReservationsTable.$inferInsert;