import {
  db, photographersTable, photosTable, photographerClubsTable,
  photographerThemesTable, photoReviewsTable, sessionPhotosTable,
  sessionReviewersTable, reviewSessionsTable, type InsertPhotographer,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { withUploadLifecycle, type UploadTransaction } from "./upload-staging";

export class ImageLifecycleError extends Error {
  constructor(message: string, public readonly status: 404 | 409) {
    super(message);
  }
}

async function assertPhotosNotReviewed(tx: UploadTransaction, photoIds: number[]) {
  if (!photoIds.length) return;
  const [submission] = await tx.select({ id: sessionPhotosTable.id }).from(sessionPhotosTable)
    .where(inArray(sessionPhotosTable.photoId, photoIds)).limit(1);
  if (submission) {
    throw new ImageLifecycleError("A photo is still used in a review session. Remove its session submission before deleting it.", 409);
  }
}

export async function deletePhotosWithReclamation(photoIds: number[], now?: Date) {
  if (!photoIds.length) return [];
  return db.transaction(async (tx) => {
    const photos = await tx.select().from(photosTable)
      .where(inArray(photosTable.id, photoIds)).orderBy(photosTable.id).for("update");
    const ids = photos.map((photo) => photo.id);
    await assertPhotosNotReviewed(tx, ids);
    if (!ids.length) return [];
    return withUploadLifecycle({ release: photos.map((photo) => photo.imageUrl) },
      (transaction) => transaction.delete(photosTable).where(inArray(photosTable.id, ids)).returning(),
      { transaction: tx, now });
  });
}

export async function updatePhotographerWithReclamation(
  id: number, fields: Partial<InsertPhotographer>, now?: Date,
) {
  return db.transaction(async (tx) => {
    // Capture the actual previous avatar, not the route's pre-authorization
    // snapshot: concurrent replacements can have committed in the meantime.
    const [previous] = await tx.select().from(photographersTable)
      .where(eq(photographersTable.id, id)).for("update");
    if (!previous) throw new ImageLifecycleError("Photographer not found", 404);
    const replacesAvatar = Object.hasOwn(fields, "avatarUrl");
    const [updated] = await withUploadLifecycle({
      attach: replacesAvatar ? [fields.avatarUrl] : [],
      release: replacesAvatar ? [previous.avatarUrl] : [],
    }, (transaction) => transaction.update(photographersTable).set(fields)
      .where(eq(photographersTable.id, id)).returning(), { transaction: tx, now });
    return updated;
  });
}

export async function deletePhotographerWithReclamation(id: number, now?: Date) {
  return db.transaction(async (tx) => {
    const [photographer] = await tx.select().from(photographersTable)
      .where(eq(photographersTable.id, id)).for("update");
    if (!photographer) throw new ImageLifecycleError("Photographer not found", 404);
    const photos = await tx.select().from(photosTable)
      .where(eq(photosTable.photographerId, id)).orderBy(photosTable.id).for("update");
    await assertPhotosNotReviewed(tx, photos.map((photo) => photo.id));
    const [submission] = await tx.select({ id: sessionPhotosTable.id }).from(sessionPhotosTable)
      .where(eq(sessionPhotosTable.photographerId, id)).limit(1);
    const [reviewer] = await tx.select({ id: sessionReviewersTable.id }).from(sessionReviewersTable)
      .where(eq(sessionReviewersTable.photographerId, id)).limit(1);
    const [review] = await tx.select({ id: photoReviewsTable.id }).from(photoReviewsTable)
      .where(eq(photoReviewsTable.reviewerPhotographerId, id)).limit(1);
    if (submission || reviewer || review) {
      throw new ImageLifecycleError("This photographer is still used in review sessions. Remove those session references before deleting the profile.", 409);
    }
    await withUploadLifecycle({
      release: [photographer.avatarUrl, ...photos.map((photo) => photo.imageUrl)],
    }, async (transaction) => {
      await transaction.delete(photosTable).where(eq(photosTable.photographerId, id));
      await transaction.delete(photographerClubsTable).where(eq(photographerClubsTable.photographerId, id));
      await transaction.delete(photographerThemesTable).where(eq(photographerThemesTable.photographerId, id));
      await transaction.delete(photographersTable).where(eq(photographersTable.id, id));
    }, { transaction: tx, now });
    return photographer;
  });
}

async function lockPhotographer(tx: UploadTransaction, id: number) {
  const [owner] = await tx.select({ id: photographersTable.id }).from(photographersTable)
    .where(eq(photographersTable.id, id)).for("key share");
  if (!owner) throw new ImageLifecycleError("Photographer not found", 404);
}

async function lockReviewSession(tx: UploadTransaction, id: number) {
  const [session] = await tx.select().from(reviewSessionsTable)
    .where(eq(reviewSessionsTable.id, id)).for("key share");
  if (!session) throw new ImageLifecycleError("Review session not found", 404);
  return session;
}

export async function withReviewPhotographerReferences<T>(
  photographerIds: number[], create: (tx: UploadTransaction) => Promise<T>, sessionId?: number,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (sessionId !== undefined) await lockReviewSession(tx, sessionId);
    for (const id of [...new Set(photographerIds)].sort((a, b) => a - b)) {
      await lockPhotographer(tx, id);
    }
    return create(tx);
  });
}

export async function withReviewSessionUploadAttachment<T>(
  sessionId: number,
  photographerId: number,
  imageUrl: string,
  create: (tx: UploadTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await lockReviewSession(tx, sessionId);
    await lockPhotographer(tx, photographerId);
    return withUploadLifecycle({ attach: [imageUrl] }, create, { transaction: tx });
  });
}

// Owner -> existing photo -> ledger is the common lock ordering. Inserts use
// new photo IDs, so they cannot deadlock a remover holding existing photo rows.
export async function withPhotographerUploadAttachment<T>(
  photographerId: number | null, imageUrl: string, create: (tx: UploadTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (photographerId !== null) await lockPhotographer(tx, photographerId);
    return withUploadLifecycle({ attach: [imageUrl] }, create, { transaction: tx });
  });
}

export async function createReviewPhotoReference(input: {
  photographerId: number; sessionId: number; photoId: number;
}) {
  return db.transaction(async (tx) => {
    await lockReviewSession(tx, input.sessionId);
    const [photoOwner] = await tx.select({ photographerId: photosTable.photographerId }).from(photosTable)
      .where(eq(photosTable.id, input.photoId));
    if (!photoOwner) throw new ImageLifecycleError("Photo not found", 404);
    const ownerIds = [input.photographerId, photoOwner.photographerId]
      .filter((id): id is number => id !== null);
    for (const id of [...new Set(ownerIds)].sort((a, b) => a - b)) {
      await lockPhotographer(tx, id);
    }
    const [photo] = await tx.select({ id: photosTable.id, photographerId: photosTable.photographerId }).from(photosTable)
      .where(eq(photosTable.id, input.photoId)).for("key share");
    if (!photo) throw new ImageLifecycleError("Photo not found", 404);
    if (photo.photographerId !== photoOwner.photographerId) {
      throw new ImageLifecycleError("Photo ownership changed; retry the request.", 409);
    }
    const [submission] = await tx.insert(sessionPhotosTable).values(input).returning();
    return submission;
  });
}

export async function createPhotoReviewWithReferences(input: {
  sessionPhotoId: number;
  reviewerPhotographerId: number;
  rating: number;
  comment?: string | null;
}) {
  const [target] = await db.select({
    sessionId: sessionPhotosTable.sessionId,
    photoId: sessionPhotosTable.photoId,
    photographerId: sessionPhotosTable.photographerId,
  }).from(sessionPhotosTable).where(eq(sessionPhotosTable.id, input.sessionPhotoId));
  if (!target) throw new ImageLifecycleError("Session photo not found", 404);

  return db.transaction(async (tx) => {
    await lockReviewSession(tx, target.sessionId);

    const [photoOwner] = await tx.select({ photographerId: photosTable.photographerId }).from(photosTable)
      .where(eq(photosTable.id, target.photoId));
    if (!photoOwner) throw new ImageLifecycleError("Photo not found", 404);

    const ownerIds = [
      input.reviewerPhotographerId,
      target.photographerId,
      photoOwner.photographerId,
    ].filter((id): id is number => id !== null);
    for (const id of [...new Set(ownerIds)].sort((a, b) => a - b)) {
      await lockPhotographer(tx, id);
    }

    const [photo] = await tx.select({ id: photosTable.id, photographerId: photosTable.photographerId }).from(photosTable)
      .where(eq(photosTable.id, target.photoId)).for("key share");
    if (!photo) throw new ImageLifecycleError("Photo not found", 404);
    if (photo.photographerId !== photoOwner.photographerId) {
      throw new ImageLifecycleError("Photo ownership changed; retry the request.", 409);
    }

    const [submission] = await tx.select({
      id: sessionPhotosTable.id,
      sessionId: sessionPhotosTable.sessionId,
      photoId: sessionPhotosTable.photoId,
      photographerId: sessionPhotosTable.photographerId,
    }).from(sessionPhotosTable).where(eq(sessionPhotosTable.id, input.sessionPhotoId)).for("key share");
    if (
      !submission ||
      submission.sessionId !== target.sessionId ||
      submission.photoId !== target.photoId ||
      submission.photographerId !== target.photographerId
    ) {
      throw new ImageLifecycleError("Session photo not found", 404);
    }

    const [review] = await tx.insert(photoReviewsTable).values({
      sessionPhotoId: input.sessionPhotoId,
      reviewerPhotographerId: input.reviewerPhotographerId,
      rating: input.rating,
      comment: input.comment ?? null,
    }).returning();
    return review;
  });
}

export async function removeSessionPhotoWithReferences(id: number) {
  const [target] = await db.select({ sessionId: sessionPhotosTable.sessionId })
    .from(sessionPhotosTable).where(eq(sessionPhotosTable.id, id));
  if (!target) return undefined;

  return db.transaction(async (tx) => {
    await lockReviewSession(tx, target.sessionId);
    const [submission] = await tx.select().from(sessionPhotosTable)
      .where(eq(sessionPhotosTable.id, id)).for("update");
    if (!submission) return undefined;

    const [review] = await tx.select({ id: photoReviewsTable.id }).from(photoReviewsTable)
      .where(eq(photoReviewsTable.sessionPhotoId, id)).limit(1);
    if (review) {
      throw new ImageLifecycleError(
        "This session photo has reviews. Remove its reviews before removing the submission.",
        409,
      );
    }
    const [deleted] = await tx.delete(sessionPhotosTable)
      .where(eq(sessionPhotosTable.id, id)).returning();
    return deleted;
  });
}