import { clubsTable, db, photographersTable, photosTable, uploadReservationsTable } from "@workspace/db";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

export type UploadTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Signed PUT URLs last 15 minutes. Never delete while a PUT can still recreate
// the file; leave ample time for interrupted clients to finish their post.
export const UPLOAD_STAGING_TTL_MS = 24 * 60 * 60 * 1000;
export const UPLOAD_CLEANUP_RETRY_MS = 60 * 60 * 1000;
export const UPLOAD_RECLAIM_DELAY_MS = UPLOAD_STAGING_TTL_MS;
const service = new ObjectStorageService();
const uploadPathPattern = /^\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UploadUnavailableError extends Error {
  constructor() {
    super("This upload has expired. Please upload the image again.");
  }
}

function uploadObjectPath(imageUrl: string): string | null {
  try {
    // Decode once before normalizing GCS prefixes too, not just the UUID.
    // Do not decode twice: %25XX is not the same served object as %XX.
    const parsed = new URL(imageUrl, "https://local.invalid");
    parsed.pathname = decodeURIComponent(parsed.pathname);
    const normalized = service.normalizeObjectEntityPath(parsed.toString());
    const pathname = new URL(normalized, "https://local.invalid").pathname;
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

async function hasUploadReferences(tx: UploadTransaction, objectPath: string): Promise<boolean> {
  // Do not filter to Gallery photos: gallery-less review uploads own files too.
  // Reference detection must recognize the same decoded UUID as attachment.
  // Existing rows can contain mixed literal/%XX characters and alternate URLs.
  // UUID-only matching is deliberately conservative (false retention is safe).
  const objectId = objectPath.split("/").at(-1)!;
  const referencePattern = [...objectId].map((char) => {
    const encodings = new Set([char.toLowerCase(), char.toUpperCase()].map(
      (value) => `%${value.charCodeAt(0).toString(16)}`,
    ));
    return `(${char}|${[...encodings].join("|")})`;
  }).join("");
  const [photo] = await tx.select({ id: photosTable.id }).from(photosTable)
    .where(sql`${photosTable.imageUrl} ~* ${referencePattern}`).limit(1);
  if (photo) return true;
  const [avatar] = await tx.select({ id: photographersTable.id }).from(photographersTable)
    .where(sql`${photographersTable.avatarUrl} ~* ${referencePattern}`).limit(1);
  if (avatar) return true;
  const [logo] = await tx.select({ id: clubsTable.id }).from(clubsTable)
    .where(sql`${clubsTable.logoUrl} ~* ${referencePattern}`).limit(1);
  return !!logo;
}

/** Serialize attachments and releases together, locking paths in stable order. */
export async function withUploadLifecycle<T>(
  changes: { attach?: (string | null | undefined)[]; release?: (string | null | undefined)[] },
  mutate: (transaction: UploadTransaction) => Promise<T>,
  options: { transaction?: UploadTransaction; now?: Date } = {},
): Promise<T> {
  const pathsFor = (urls: (string | null | undefined)[] = []) => new Set(
    urls.flatMap((url) => {
      const path = typeof url === "string" ? uploadObjectPath(url) : null;
      return path ? [path] : [];
    }),
  );
  const attachments = pathsFor(changes.attach);
  const releases = pathsFor(changes.release);
  const paths = [...new Set([...attachments, ...releases])].sort();
  const run = async (tx: UploadTransaction) => {
    const reservations = new Map<string, typeof uploadReservationsTable.$inferSelect>();
    for (const path of paths) {
      const [row] = await tx.select().from(uploadReservationsTable)
        .where(eq(uploadReservationsTable.objectPath, path)).for("update");
      if (!row) continue; // No legacy bucket sweep or untracked-file deletion.
      reservations.set(path, row);
      if (attachments.has(path) && (
        row.status === "deleting" || row.status === "deleted" ||
        (row.status === "pending" && row.expiresAt.getTime() <= Date.now())
      )) throw new UploadUnavailableError();
    }
    const result = await mutate(tx);
    for (const [path, row] of reservations) {
      if (attachments.has(path)) {
        await tx.update(uploadReservationsTable).set({ status: "attached", retryAt: null })
          .where(eq(uploadReservationsTable.objectPath, path));
      }
      if (!releases.has(path) || row.status === "deleting" || row.status === "deleted") continue;
      const referenced = await hasUploadReferences(tx, path);
      await tx.update(uploadReservationsTable).set(referenced
        ? { status: "attached", retryAt: null }
        : {
          status: "pending", retryAt: null,
          expiresAt: new Date((options.now ?? new Date()).getTime() + UPLOAD_RECLAIM_DELAY_MS),
        }).where(eq(uploadReservationsTable.objectPath, path));
    }
    return result;
  };
  return options.transaction ? run(options.transaction) : db.transaction(run);
}

// Every photo/avatar attachment shares the ledger row lock with cleanup. A
// deleted tombstone stays in the ledger, preventing a late request from
// attaching an image after cleanup has already removed it.
export async function withUploadAttachment<T>(
  imageUrl: string,
  create: (transaction: UploadTransaction) => Promise<T>,
): Promise<T> {
  return withUploadLifecycle({ attach: [imageUrl] }, create);
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

        if (await hasUploadReferences(tx, row.objectPath)) {
          await tx.update(uploadReservationsTable).set({ status: "attached", retryAt: null })
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