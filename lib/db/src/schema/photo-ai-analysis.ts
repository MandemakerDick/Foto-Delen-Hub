import { boolean, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
    themeAutoApply: boolean("theme_auto_apply").notNull().default(true),
    themeSuggestionId: integer("theme_suggestion_id"),
    themeSuggestionConfidence: real("theme_suggestion_confidence"),
    themeSuggestionReason: text("theme_suggestion_reason"),
    themeSuggestionStatus: text("theme_suggestion_status", {
      enum: ["pending", "auto_applied", "accepted", "rejected"],
    }),
    themeReviewOutcome: text("theme_review_outcome", {
      enum: ["correct", "incorrect"],
    }),
    themeReviewedAt: timestamp("theme_reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    photoIdUnique: uniqueIndex("photo_ai_analysis_photo_id_unique").on(table.photoId),
  }),
);

export type PhotoAiAnalysis = typeof photoAiAnalysesTable.$inferSelect;