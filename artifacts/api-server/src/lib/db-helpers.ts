import { db, photographersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Given a Clerk userId, return the linked photographer's DB id, or null if
 * no photographer profile has been linked to that Clerk account yet.
 *
 * Used in photos and comments routes to map the authenticated Clerk user to
 * the correct photographer row.
 */
export async function getPhotographerIdForClerkUser(
  clerkUserId: string,
): Promise<number | null> {
  const rows = await db
    .select({ id: photographersTable.id })
    .from(photographersTable)
    .where(eq(photographersTable.clerkUserId, clerkUserId));
  return rows[0]?.id ?? null;
}
