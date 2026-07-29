import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A review session belongs to one club and is created by an admin.
 * Status lifecycle: "open" → "reviewing" → "closed" (archived).
 *   open      — photographers may still submit photos
 *   reviewing — submissions locked; reviewers are leaving feedback
 *   closed    — session is finished and archived
 */
export const reviewSessionsTable = pgTable("review_session", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"), // "open" | "reviewing" | "closed"
  createdByAdminId: integer("created_by_admin_id"),
  scheduledFor: timestamp("scheduled_for"),
  submissionDeadline: timestamp("submission_deadline"),
  maxPhotosPerMember: integer("max_photos_per_member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

/**
 * Photos submitted to a review session.
 * A photographer may submit multiple photos to one session.
 * sortOrder can be set by the admin to control presentation order.
 */
export const sessionPhotosTable = pgTable("session_photo", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  photoId: integer("photo_id").notNull(),          // FK → photos.id
  photographerId: integer("photographer_id").notNull(), // FK → photographers.id
  sortOrder: integer("sort_order").notNull().default(0),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

/**
 * Photographers who are designated reviewers for a given session.
 * Only reviewers (and admins) may leave reviews on session photos.
 */
export const sessionReviewersTable = pgTable("session_reviewer", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  photographerId: integer("photographer_id").notNull(), // FK → photographers.id
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

/**
 * A review left by a reviewer on a single session-photo.
 * Rating is 1–5 stars; comment is optional.
 * One reviewer may only review each photo once (enforced in the route).
 */
export const photoReviewsTable = pgTable("photo_review", {
  id: serial("id").primaryKey(),
  sessionPhotoId: integer("session_photo_id").notNull(), // FK → session_photos.id
  reviewerPhotographerId: integer("reviewer_photographer_id").notNull(),
  rating: integer("rating").notNull(),   // 1–5
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReviewSessionSchema = createInsertSchema(reviewSessionsTable).omit({ id: true, createdAt: true, closedAt: true });
export const insertSessionPhotoSchema = createInsertSchema(sessionPhotosTable).omit({ id: true, submittedAt: true });
export const insertSessionReviewerSchema = createInsertSchema(sessionReviewersTable).omit({ id: true, addedAt: true });
export const insertPhotoReviewSchema = createInsertSchema(photoReviewsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type ReviewSession = typeof reviewSessionsTable.$inferSelect;
export type SessionPhoto = typeof sessionPhotosTable.$inferSelect;
export type SessionReviewer = typeof sessionReviewersTable.$inferSelect;
export type PhotoReview = typeof photoReviewsTable.$inferSelect;
