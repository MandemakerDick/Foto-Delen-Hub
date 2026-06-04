import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  reviewSessionsTable,
  sessionPhotosTable,
  sessionReviewersTable,
  photoReviewsTable,
  photosTable,
  photographersTable,
} from "@workspace/db";
import {
  ListReviewSessionsQueryParams,
  CreateReviewSessionBody,
  GetReviewSessionParams,
  UpdateReviewSessionParams,
  UpdateReviewSessionBody,
  DeleteReviewSessionParams,
  ListSessionPhotosParams,
  SubmitSessionPhotoParams,
  SubmitSessionPhotoBody,
  RemoveSessionPhotoParams,
  ListSessionReviewersParams,
  AddSessionReviewerParams,
  AddSessionReviewerBody,
  RemoveSessionReviewerParams,
  ListPhotoReviewsParams,
  CreatePhotoReviewParams,
  CreatePhotoReviewBody,
  UpdatePhotoReviewParams,
  UpdatePhotoReviewBody,
} from "@workspace/api-zod";
import { requireAuth } from "./auth";
import { requireAdmin } from "./admins";
import { getPhotographerIdForClerkUser } from "../lib/db-helpers";

const router = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function serializeSession(s: typeof reviewSessionsTable.$inferSelect) {
  return {
    id: s.id,
    clubId: s.clubId,
    title: s.title,
    description: s.description ?? null,
    status: s.status,
    createdByAdminId: s.createdByAdminId ?? null,
    scheduledFor: s.scheduledFor ? s.scheduledFor.toISOString() : null,
    submissionDeadline: s.submissionDeadline ? s.submissionDeadline.toISOString() : null,
    maxPhotosPerMember: s.maxPhotosPerMember ?? null,
    createdAt: s.createdAt.toISOString(),
    closedAt: s.closedAt ? s.closedAt.toISOString() : null,
  };
}

// GET /review-sessions
router.get("/review-sessions", async (req, res): Promise<void> => {
  const query = ListReviewSessionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let q = db.select().from(reviewSessionsTable).$dynamic();
  const conditions = [];
  if (query.data.clubId) conditions.push(eq(reviewSessionsTable.clubId, query.data.clubId));
  if (query.data.status) conditions.push(eq(reviewSessionsTable.status, query.data.status));
  if (conditions.length > 0) q = q.where(and(...conditions));

  const rows = await q.orderBy(reviewSessionsTable.createdAt);
  res.json(rows.map(serializeSession));
});

// POST /review-sessions (admin only)
router.post("/review-sessions", requireAdmin, async (req: any, res): Promise<void> => {
  const parsed = CreateReviewSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, description, clubId, scheduledFor, submissionDeadline, maxPhotosPerMember, reviewerIds } = parsed.data;
  const [session] = await db
    .insert(reviewSessionsTable)
    .values({
      title,
      description: description ?? null,
      clubId,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : null,
      maxPhotosPerMember: maxPhotosPerMember ?? null,
      createdByAdminId: req.adminId ?? null,
    })
    .returning();

  if (reviewerIds && reviewerIds.length > 0) {
    await db.insert(sessionReviewersTable).values(
      reviewerIds.map((photographerId) => ({ sessionId: session.id, photographerId }))
    );
  }

  res.status(201).json(serializeSession(session));
});

// GET /review-sessions/:id
router.get("/review-sessions/:id", async (req, res): Promise<void> => {
  const params = GetReviewSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(reviewSessionsTable)
    .where(eq(reviewSessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Review session not found" });
    return;
  }

  res.json(serializeSession(session));
});

// PATCH /review-sessions/:id (admin only)
router.patch("/review-sessions/:id", requireAdmin, async (req: any, res): Promise<void> => {
  const params = UpdateReviewSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateReviewSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.scheduledFor !== undefined) {
    updateData.scheduledFor = parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null;
  }
  if (parsed.data.submissionDeadline !== undefined) {
    updateData.submissionDeadline = parsed.data.submissionDeadline ? new Date(parsed.data.submissionDeadline) : null;
  }
  if (parsed.data.status === "closed") {
    updateData.closedAt = new Date();
  }

  const [updated] = await db
    .update(reviewSessionsTable)
    .set(updateData)
    .where(eq(reviewSessionsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Review session not found" });
    return;
  }

  res.json(serializeSession(updated));
});

// DELETE /review-sessions/:id (admin only)
// Cascades: photo_reviews → session_photos → session_reviewers → review_sessions
router.delete("/review-sessions/:id", requireAdmin, async (req: any, res): Promise<void> => {
  const params = DeleteReviewSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;

  const [session] = await db
    .select()
    .from(reviewSessionsTable)
    .where(eq(reviewSessionsTable.id, id));

  if (!session) {
    res.status(404).json({ error: "Review session not found" });
    return;
  }

  // 1. Delete photo reviews (child of session_photos)
  const sessionPhotoIds = await db
    .select({ id: sessionPhotosTable.id })
    .from(sessionPhotosTable)
    .where(eq(sessionPhotosTable.sessionId, id));

  if (sessionPhotoIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    await db
      .delete(photoReviewsTable)
      .where(inArray(photoReviewsTable.sessionPhotoId, sessionPhotoIds.map((r) => r.id)));
  }

  // 2. Delete session photos
  await db.delete(sessionPhotosTable).where(eq(sessionPhotosTable.sessionId, id));

  // 3. Delete session reviewers
  await db.delete(sessionReviewersTable).where(eq(sessionReviewersTable.sessionId, id));

  // 4. Delete the session itself
  await db.delete(reviewSessionsTable).where(eq(reviewSessionsTable.id, id));

  res.sendStatus(204);
});

// GET /review-sessions/:id/photos
router.get("/review-sessions/:id/photos", async (req, res): Promise<void> => {
  const params = ListSessionPhotosParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({
      id: sessionPhotosTable.id,
      sessionId: sessionPhotosTable.sessionId,
      photoId: sessionPhotosTable.photoId,
      photographerId: sessionPhotosTable.photographerId,
      sortOrder: sessionPhotosTable.sortOrder,
      submittedAt: sessionPhotosTable.submittedAt,
      photoTitle: photosTable.title,
      photoUrl: photosTable.imageUrl,
      photographerName: photographersTable.name,
    })
    .from(sessionPhotosTable)
    .leftJoin(photosTable, eq(sessionPhotosTable.photoId, photosTable.id))
    .leftJoin(photographersTable, eq(sessionPhotosTable.photographerId, photographersTable.id))
    .where(eq(sessionPhotosTable.sessionId, params.data.id))
    .orderBy(sessionPhotosTable.sortOrder);

  const result = await Promise.all(
    rows.map(async (row) => {
      const reviews = await db
        .select()
        .from(photoReviewsTable)
        .where(eq(photoReviewsTable.sessionPhotoId, row.id));

      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : null;

      return {
        id: row.id,
        sessionId: row.sessionId,
        photoId: row.photoId,
        photographerId: row.photographerId,
        sortOrder: row.sortOrder,
        submittedAt: row.submittedAt.toISOString(),
        photoTitle: row.photoTitle ?? null,
        photoUrl: row.photoUrl ?? null,
        photographerName: row.photographerName ?? null,
        reviewCount: reviews.length,
        averageRating: avgRating,
      };
    })
  );

  res.json(result);
});

// POST /review-sessions/:id/photos (authenticated)
router.post("/review-sessions/:id/photos", requireAuth, async (req: any, res): Promise<void> => {
  const params = SubmitSessionPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SubmitSessionPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const session = await db
    .select()
    .from(reviewSessionsTable)
    .where(eq(reviewSessionsTable.id, params.data.id));

  if (!session[0]) {
    res.status(404).json({ error: "Review session not found" });
    return;
  }

  if (session[0].status !== "open") {
    res.status(400).json({ error: "Session is not open for submissions" });
    return;
  }

  // Enforce submission deadline
  if (session[0].submissionDeadline && new Date() > session[0].submissionDeadline) {
    res.status(400).json({ error: "The submission deadline for this session has passed" });
    return;
  }

  const photographerId = await getPhotographerIdForClerkUser(req.clerkUserId);
  if (!photographerId) {
    res.status(403).json({ error: "No photographer profile found" });
    return;
  }

  // Enforce max photos per member
  if (session[0].maxPhotosPerMember) {
    const existing = await db
      .select()
      .from(sessionPhotosTable)
      .where(
        and(
          eq(sessionPhotosTable.sessionId, params.data.id),
          eq(sessionPhotosTable.photographerId, photographerId)
        )
      );
    if (existing.length >= session[0].maxPhotosPerMember) {
      res.status(400).json({
        error: `You have reached the maximum of ${session[0].maxPhotosPerMember} photo${session[0].maxPhotosPerMember !== 1 ? "s" : ""} for this session`,
      });
      return;
    }
  }

  const [sp] = await db
    .insert(sessionPhotosTable)
    .values({
      sessionId: params.data.id,
      photoId: parsed.data.photoId,
      photographerId,
    })
    .returning();

  res.status(201).json({
    id: sp.id,
    sessionId: sp.sessionId,
    photoId: sp.photoId,
    photographerId: sp.photographerId,
    sortOrder: sp.sortOrder,
    submittedAt: sp.submittedAt.toISOString(),
    photoTitle: null,
    photoUrl: null,
    photographerName: null,
    reviewCount: 0,
    averageRating: null,
  });
});

// DELETE /review-sessions/:id/photos/:sessionPhotoId (admin or owner)
router.delete(
  "/review-sessions/:id/photos/:sessionPhotoId",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const params = RemoveSessionPhotoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [sp] = await db
      .select()
      .from(sessionPhotosTable)
      .where(
        and(
          eq(sessionPhotosTable.id, params.data.sessionPhotoId),
          eq(sessionPhotosTable.sessionId, params.data.id)
        )
      );

    if (!sp) {
      res.status(404).json({ error: "Session photo not found" });
      return;
    }

    await db.delete(sessionPhotosTable).where(eq(sessionPhotosTable.id, params.data.sessionPhotoId));
    res.sendStatus(204);
  }
);

// GET /review-sessions/:id/reviewers
router.get("/review-sessions/:id/reviewers", async (req, res): Promise<void> => {
  const params = ListSessionReviewersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({
      id: sessionReviewersTable.id,
      sessionId: sessionReviewersTable.sessionId,
      photographerId: sessionReviewersTable.photographerId,
      addedAt: sessionReviewersTable.addedAt,
      photographerName: photographersTable.name,
      photographerAvatarUrl: photographersTable.avatarUrl,
    })
    .from(sessionReviewersTable)
    .leftJoin(
      photographersTable,
      eq(sessionReviewersTable.photographerId, photographersTable.id)
    )
    .where(eq(sessionReviewersTable.sessionId, params.data.id));

  res.json(
    rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      photographerId: r.photographerId,
      addedAt: r.addedAt.toISOString(),
      photographerName: r.photographerName ?? null,
      photographerAvatarUrl: r.photographerAvatarUrl ?? null,
    }))
  );
});

// POST /review-sessions/:id/reviewers (admin only)
router.post(
  "/review-sessions/:id/reviewers",
  requireAdmin,
  async (req: any, res): Promise<void> => {
    const params = AddSessionReviewerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = AddSessionReviewerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const existing = await db
      .select()
      .from(sessionReviewersTable)
      .where(
        and(
          eq(sessionReviewersTable.sessionId, params.data.id),
          eq(sessionReviewersTable.photographerId, parsed.data.photographerId)
        )
      );

    if (existing.length > 0) {
      res.status(409).json({ error: "Reviewer already added to this session" });
      return;
    }

    const [reviewer] = await db
      .insert(sessionReviewersTable)
      .values({
        sessionId: params.data.id,
        photographerId: parsed.data.photographerId,
      })
      .returning();

    const [photographer] = await db
      .select({ name: photographersTable.name, avatarUrl: photographersTable.avatarUrl })
      .from(photographersTable)
      .where(eq(photographersTable.id, parsed.data.photographerId));

    res.status(201).json({
      id: reviewer.id,
      sessionId: reviewer.sessionId,
      photographerId: reviewer.photographerId,
      addedAt: reviewer.addedAt.toISOString(),
      photographerName: photographer?.name ?? null,
      photographerAvatarUrl: photographer?.avatarUrl ?? null,
    });
  }
);

// DELETE /review-sessions/:id/reviewers/:reviewerId (admin only)
router.delete(
  "/review-sessions/:id/reviewers/:reviewerId",
  requireAdmin,
  async (req: any, res): Promise<void> => {
    const params = RemoveSessionReviewerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(sessionReviewersTable)
      .where(
        and(
          eq(sessionReviewersTable.id, params.data.reviewerId),
          eq(sessionReviewersTable.sessionId, params.data.id)
        )
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Reviewer not found" });
      return;
    }

    res.sendStatus(204);
  }
);

// GET /review-sessions/:id/photos/:sessionPhotoId/reviews
router.get(
  "/review-sessions/:id/photos/:sessionPhotoId/reviews",
  async (req, res): Promise<void> => {
    const params = ListPhotoReviewsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select({
        id: photoReviewsTable.id,
        sessionPhotoId: photoReviewsTable.sessionPhotoId,
        reviewerPhotographerId: photoReviewsTable.reviewerPhotographerId,
        rating: photoReviewsTable.rating,
        comment: photoReviewsTable.comment,
        createdAt: photoReviewsTable.createdAt,
        updatedAt: photoReviewsTable.updatedAt,
        reviewerName: photographersTable.name,
        reviewerAvatarUrl: photographersTable.avatarUrl,
      })
      .from(photoReviewsTable)
      .leftJoin(
        photographersTable,
        eq(photoReviewsTable.reviewerPhotographerId, photographersTable.id)
      )
      .where(eq(photoReviewsTable.sessionPhotoId, params.data.sessionPhotoId));

    res.json(
      rows.map((r) => ({
        id: r.id,
        sessionPhotoId: r.sessionPhotoId,
        reviewerPhotographerId: r.reviewerPhotographerId,
        rating: r.rating,
        comment: r.comment ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        reviewerName: r.reviewerName ?? null,
        reviewerAvatarUrl: r.reviewerAvatarUrl ?? null,
      }))
    );
  }
);

// POST /review-sessions/:id/photos/:sessionPhotoId/reviews (reviewers only)
router.post(
  "/review-sessions/:id/photos/:sessionPhotoId/reviews",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const params = CreatePhotoReviewParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = CreatePhotoReviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const photographerId = await getPhotographerIdForClerkUser(req.clerkUserId);
    if (!photographerId) {
      res.status(403).json({ error: "No photographer profile found" });
      return;
    }

    // Check reviewer is assigned to this session
    const isReviewer = await db
      .select()
      .from(sessionReviewersTable)
      .where(
        and(
          eq(sessionReviewersTable.sessionId, params.data.id),
          eq(sessionReviewersTable.photographerId, photographerId)
        )
      );

    if (isReviewer.length === 0) {
      res.status(403).json({ error: "You are not a reviewer for this session" });
      return;
    }

    // Check session is in reviewing status
    const [session] = await db
      .select()
      .from(reviewSessionsTable)
      .where(eq(reviewSessionsTable.id, params.data.id));

    if (!session || session.status !== "reviewing") {
      res.status(400).json({ error: "Session is not in reviewing status" });
      return;
    }

    // Enforce one review per reviewer per photo
    const existing = await db
      .select()
      .from(photoReviewsTable)
      .where(
        and(
          eq(photoReviewsTable.sessionPhotoId, params.data.sessionPhotoId),
          eq(photoReviewsTable.reviewerPhotographerId, photographerId)
        )
      );

    if (existing.length > 0) {
      res.status(409).json({ error: "You have already reviewed this photo" });
      return;
    }

    const [review] = await db
      .insert(photoReviewsTable)
      .values({
        sessionPhotoId: params.data.sessionPhotoId,
        reviewerPhotographerId: photographerId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? null,
      })
      .returning();

    const [photographer] = await db
      .select({ name: photographersTable.name, avatarUrl: photographersTable.avatarUrl })
      .from(photographersTable)
      .where(eq(photographersTable.id, photographerId));

    res.status(201).json({
      id: review.id,
      sessionPhotoId: review.sessionPhotoId,
      reviewerPhotographerId: review.reviewerPhotographerId,
      rating: review.rating,
      comment: review.comment ?? null,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      reviewerName: photographer?.name ?? null,
      reviewerAvatarUrl: photographer?.avatarUrl ?? null,
    });
  }
);

// PATCH /review-sessions/:id/photos/:sessionPhotoId/reviews/:reviewId
router.patch(
  "/review-sessions/:id/photos/:sessionPhotoId/reviews/:reviewId",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const params = UpdatePhotoReviewParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdatePhotoReviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const photographerId = await getPhotographerIdForClerkUser(req.clerkUserId);
    if (!photographerId) {
      res.status(403).json({ error: "No photographer profile found" });
      return;
    }

    const [review] = await db
      .select()
      .from(photoReviewsTable)
      .where(eq(photoReviewsTable.id, params.data.reviewId));

    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    if (review.reviewerPhotographerId !== photographerId) {
      res.status(403).json({ error: "You can only edit your own reviews" });
      return;
    }

    const [updated] = await db
      .update(photoReviewsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(photoReviewsTable.id, params.data.reviewId))
      .returning();

    const [photographer] = await db
      .select({ name: photographersTable.name, avatarUrl: photographersTable.avatarUrl })
      .from(photographersTable)
      .where(eq(photographersTable.id, photographerId));

    res.json({
      id: updated.id,
      sessionPhotoId: updated.sessionPhotoId,
      reviewerPhotographerId: updated.reviewerPhotographerId,
      rating: updated.rating,
      comment: updated.comment ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      reviewerName: photographer?.name ?? null,
      reviewerAvatarUrl: photographer?.avatarUrl ?? null,
    });
  }
);

export default router;
