import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { photosTable } from "./photos";

export const photoAiAnalysesTable = pgTable(
  "photo_ai_analysis",
  {
    id: serial("id").primaryKey(),
    photoId: integer("photo_id")
      .notNull()
      .references(() => photosTable.id, { onDelete: "cascade" }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    description: text("description"),
    status: text("status", { enum: ["pending", "processing", "complete", "failed"] })
      .notNull()
      .default("pending"),
    error: text("error"),
    model: text("model"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    photoIdUnique: uniqueIndex("photo_ai_analysis_photo_id_unique").on(table.photoId),
  }),
);

export type PhotoAiAnalysis = typeof photoAiAnalysesTable.$inferSelect;