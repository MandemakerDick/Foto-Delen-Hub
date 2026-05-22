import { Router } from "express";
import { db, commentsTable, photographersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { ListCommentsParams, CreateCommentParams, CreateCommentBody, DeleteCommentParams } from "@workspace/api-zod";

const router = Router();

router.get("/photos/:id/comments", async (req, res) => {
  const params = ListCommentsParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const rows = await db
    .select({
      id: commentsTable.id,
      photoId: commentsTable.photoId,
      photographerId: commentsTable.photographerId,
      photographerName: photographersTable.name,
      photographerAvatarUrl: photographersTable.avatarUrl,
      body: commentsTable.body,
      createdAt: commentsTable.createdAt,
    })
    .from(commentsTable)
    .leftJoin(photographersTable, eq(commentsTable.photographerId, photographersTable.id))
    .where(eq(commentsTable.photoId, params.data.id))
    .orderBy(asc(commentsTable.createdAt));

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

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

  const rows = await db
    .select({
      id: commentsTable.id,
      photoId: commentsTable.photoId,
      photographerId: commentsTable.photographerId,
      photographerName: photographersTable.name,
      photographerAvatarUrl: photographersTable.avatarUrl,
      body: commentsTable.body,
      createdAt: commentsTable.createdAt,
    })
    .from(commentsTable)
    .leftJoin(photographersTable, eq(commentsTable.photographerId, photographersTable.id))
    .where(eq(commentsTable.id, comment.id));

  res.status(201).json({ ...rows[0], createdAt: rows[0].createdAt.toISOString() });
});

router.delete("/photos/:id/comments/:commentId", async (req, res) => {
  const params = DeleteCommentParams.safeParse({
    id: Number(req.params.id),
    commentId: Number(req.params.commentId),
  });
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  await db.delete(commentsTable).where(eq(commentsTable.id, params.data.commentId));
  res.status(204).send();
});

export default router;
