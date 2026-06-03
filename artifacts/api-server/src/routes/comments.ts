import { Router } from "express";
import { db, commentsTable, photographersTable, photosTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  ListCommentsParams,
  CreateCommentParams,
  CreateCommentBody,
  DeleteCommentParams,
} from "@workspace/api-zod";
import { getPhotographerIdForClerkUser } from "../lib/db-helpers";

const router = Router();

/** Shared select shape for a comment row joined with the author's name and avatar. */
const commentSelect = {
  id: commentsTable.id,
  photoId: commentsTable.photoId,
  photographerId: commentsTable.photographerId,
  photographerName: photographersTable.name,
  photographerAvatarUrl: photographersTable.avatarUrl,
  body: commentsTable.body,
  createdAt: commentsTable.createdAt,
};

// GET /api/photos/:id/comments — list all comments on a photo, oldest first
router.get("/photos/:id/comments", async (req, res) => {
  const params = ListCommentsParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db
    .select(commentSelect)
    .from(commentsTable)
    .leftJoin(photographersTable, eq(commentsTable.photographerId, photographersTable.id))
    .where(eq(commentsTable.photoId, params.data.id))
    .orderBy(asc(commentsTable.createdAt));

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// POST /api/photos/:id/comments — add a comment to a photo
router.post("/photos/:id/comments", async (req, res) => {
  const params = CreateCommentParams.safeParse({ id: Number(req.params.id) });
  const body = CreateCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({ photoId: params.data.id, ...body.data })
    .returning();

  // Re-fetch the inserted row with the joined photographer name/avatar
  const rows = await db
    .select(commentSelect)
    .from(commentsTable)
    .leftJoin(photographersTable, eq(commentsTable.photographerId, photographersTable.id))
    .where(eq(commentsTable.id, comment.id));

  res.status(201).json({ ...rows[0], createdAt: rows[0].createdAt.toISOString() });
});

// DELETE /api/photos/:id/comments/:commentId — remove a comment.
// Allowed if the caller is either the comment author OR the owner of the photo.
router.delete("/photos/:id/comments/:commentId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to delete comments" }); return; }

  const params = DeleteCommentParams.safeParse({
    id: Number(req.params.id),
    commentId: Number(req.params.commentId),
  });
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }

  const [comment] = await db
    .select({ photographerId: commentsTable.photographerId, photoId: commentsTable.photoId })
    .from(commentsTable)
    .where(eq(commentsTable.id, params.data.commentId));
  if (!comment) { res.status(404).json({ error: "Not found" }); return; }

  const myPhotographerId = await getPhotographerIdForClerkUser(userId);

  const [photo] = await db
    .select({ photographerId: photosTable.photographerId })
    .from(photosTable)
    .where(eq(photosTable.id, params.data.id));

  const isCommenter = comment.photographerId === myPhotographerId;
  const isPhotoOwner = photo?.photographerId === myPhotographerId;

  if (!isCommenter && !isPhotoOwner) {
    res.status(403).json({ error: "You can only delete your own comments" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.id, params.data.commentId));
  res.status(204).send();
});

export default router;
