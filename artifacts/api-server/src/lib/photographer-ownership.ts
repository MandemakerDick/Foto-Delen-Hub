import { photographersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import type { UploadTransaction } from "./upload-staging";

export const PHOTOGRAPHER_OWNER_CONSTRAINT = "photographer_clerk_user_id_unique";

export class PhotographerOwnershipError extends Error {
  constructor() {
    super("Your account already has a different photographer profile");
  }
}

/** All account ownership writers must take this lock before checking ownership.
 * It also protects deployments awaiting the separately approved unique constraint.
 * Hash collisions only serialize unrelated accounts; they never bypass the check.
 */
export async function requireAvailablePhotographerOwner(
  tx: UploadTransaction, userId: string, photographerId?: number,
): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`photographer-owner:${userId}`}, 0))`);
  const owned = await tx.select({ id: photographersTable.id }).from(photographersTable)
    .where(eq(photographersTable.clerkUserId, userId));
  if (owned.some((profile) => profile.id !== photographerId)) {
    throw new PhotographerOwnershipError();
  }
}

/** Drizzle wraps pg errors in cause. Do not mislabel unrelated unique failures. */
export function isPhotographerOwnershipConflict(error: unknown): boolean {
  if (error instanceof PhotographerOwnershipError) return true;
  if (!error || typeof error !== "object") return false;
  const pgError = error as { code?: string; constraint?: string; cause?: unknown };
  return (pgError.code === "23505" && pgError.constraint === PHOTOGRAPHER_OWNER_CONSTRAINT)
    || (pgError.cause !== undefined && isPhotographerOwnershipConflict(pgError.cause));
}