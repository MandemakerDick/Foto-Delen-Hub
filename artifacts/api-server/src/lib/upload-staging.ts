import { db, photographersTable, photosTable, uploadReservationsTable } from "@workspace/db";
import { and, eq, isNull, like, lte, or } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Signed PUT URLs last 15 minutes. Never delete while a PUT can still recreate
// the file; leave ample time for interrupted clients to finish their post.
export const UPLOAD_STAGING_TTL_MS = 24 * 60 * 60 * 1000;
export const UPLOAD_CLEANUP_RETRY_MS = 60 * 60 * 1000;
const service = new ObjectStorageService();
const uploadPathPattern = /^\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UploadUnavailableError extends Error {
  constructor() {
    super("This upload has expired. Please upload the image again.");
  }
}

function uploadObjectPath(imageUrl: string): string | null {
  try {
    const normalized = service.normalizeObjectEntityPath(imageUrl);
    const pathname = decodeURIComponent(new URL(normalized, "https://local.invalid").pathname);
    const path = pathname.replace(/^\/api\/storage(?=\/objects\/)/, "");
    return uploadPathPattern.test(path) ? path : null;
  } catch {
    return null; // External/legacy image URLs do not enter the staging lifecycle.
  }
}

export async function registerPendingUpload(objectPath: string, now = new Date()): Promise<void> {
  if (!uploadPathPattern.test(objectPath)) throw new Error("Invalid upload object path");
  await db.insert(uploadReservationsTable).values({
    objectPath, expiresAt: new Date(now.getTime() + UPLOAD_STAGING_TTL_MS),
  });
}

// Every photo/avatar attachment shares the ledger row lock with cleanup. A
// deleted tombstone stays in the ledger, preventing a late request from
// attaching an image after cleanup has already removed it.
export async function withUploadAttachment<T>(
  imageUrl: string,
  create: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const path = uploadObjectPath(imageUrl);
    const [reservation] = path ? await tx.select().from(uploadReservationsTable)
      .where(eq(uploadReservationsTable.objectPath, path)).for("update") : [];
    if (reservation && (
      reservation.status === "deleting" || reservation.status === "deleted" ||
      (reservation.status === "pending" && reservation.expiresAt.getTime() <= Date.now())
    )) throw new UploadUnavailableError();

    const result = await create(tx);
    if (reservation?.status === "pending") {
      await tx.update(uploadReservationsTable).set({ status: "attached" })
        .where(eq(uploadReservationsTable.objectPath, reservation.objectPath));
    }
    return result;
  });
}

export async function cleanupExpiredUploads(options: {
  now?: Date; deleteObject?: (path: string) => Promise<void>; limit?: number;
} = {}): Promise<{ deleted: number; retained: number; failed: number }> {
  const now = options.now ?? new Date();
  const deleteObject = options.deleteObject ?? ((path: string) => service.deleteUploadObject(path));
  const rows = await db.select().from(uploadReservationsTable).where(and(
    or(
      and(eq(uploadReservationsTable.status, "pending"), lte(uploadReservationsTable.expiresAt, now)),
      eq(uploadReservationsTable.status, "deleting"),
    ),
    or(isNull(uploadReservationsTable.retryAt), lte(uploadReservationsTable.retryAt, now)),
  )).orderBy(uploadReservationsTable.expiresAt).limit(options.limit ?? 50);
  const totals = { deleted: 0, retained: 0, failed: 0 };
  for (const candidate of rows) {
    try {
      const claimed = await db.transaction(async (tx) => {
        const [row] = await tx.select().from(uploadReservationsTable)
          .where(eq(uploadReservationsTable.objectPath, candidate.objectPath))
          .for("update", { skipLocked: true });
        if (!row || row.status === "attached" || row.status === "deleted" ||
          (row.retryAt && row.retryAt > now) ||
          (row.status === "pending" && row.expiresAt > now)) return false;

        // Conservative additional protection for any pre-existing reference,
        // including absolute URLs and alternate serving prefixes.
        const objectId = row.objectPath.split("/").at(-1)!;
        const [photo] = await tx.select({ id: photosTable.id }).from(photosTable)
          .where(like(photosTable.imageUrl, `%${objectId}%`)).limit(1);
        const [avatar] = await tx.select({ id: photographersTable.id }).from(photographersTable)
          .where(like(photographersTable.avatarUrl, `%${objectId}%`)).limit(1);
        if (photo || avatar) {
          await tx.update(uploadReservationsTable).set({ status: "attached" })
            .where(eq(uploadReservationsTable.objectPath, row.objectPath));
          totals.retained++;
          return false;
        }
        await tx.update(uploadReservationsTable).set({ status: "deleting" })
          .where(eq(uploadReservationsTable.objectPath, row.objectPath));
        return true;
      });
      if (!claimed) continue;
      await deleteObject(candidate.objectPath);
      await db.update(uploadReservationsTable).set({ status: "deleted", retryAt: null })
        .where(eq(uploadReservationsTable.objectPath, candidate.objectPath));
      totals.deleted++;
    } catch (error) {
      totals.failed++;
      // Keep failed objects out of the next batches so later expired uploads
      // can still be collected even when storage rejects a subset of deletes.
      await db.update(uploadReservationsTable).set({
        retryAt: new Date(now.getTime() + UPLOAD_CLEANUP_RETRY_MS),
      }).where(eq(uploadReservationsTable.objectPath, candidate.objectPath));
      logger.warn({ err: error, objectPath: candidate.objectPath }, "Staged upload cleanup failed; will retry");
    }
  }
  return totals;
}

export function startUploadCleanup() {
  if (process.env.UPLOAD_CLEANUP_ENABLED === "false") {
    logger.info("Staged upload cleanup is disabled");
    return () => {};
  }
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      const result = await cleanupExpiredUploads();
      if (result.deleted || result.retained || result.failed) {
        logger.info(result, "Staged upload cleanup finished");
      }
    } catch (error) {
      logger.warn({ err: error }, "Could not scan staged uploads; will retry");
    } finally {
      running = false;
    }
  };
  void sweep();
  const timer = setInterval(() => { void sweep(); }, 5 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}