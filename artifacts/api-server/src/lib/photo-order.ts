import { photosTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import type { UploadTransaction } from "./upload-staging";

// Callers hold the photographer's FOR UPDATE lock throughout the transaction.
// Lock existing photos by ID, matching the deletion lifecycle's lock order.
export async function reserveFirstPhotoPosition(tx: UploadTransaction, photographerId: number) {
  await tx.select({ id: photosTable.id }).from(photosTable)
    .where(eq(photosTable.photographerId, photographerId))
    .orderBy(photosTable.id).for("update");
  // Preserve custom order and the newest-first order of legacy null positions.
  // Dense positions avoid ties, gaps, and integer overflow from repeated shifts.
  await tx.execute(sql`
    WITH ranked AS (
      SELECT ${photosTable.id} AS id,
        row_number() OVER (
          ORDER BY ${photosTable.sortOrder} ASC NULLS LAST,
            ${photosTable.createdAt} DESC, ${photosTable.id} DESC
        )::integer AS position
      FROM ${photosTable}
      WHERE ${photosTable.photographerId} = ${photographerId}
    )
    UPDATE ${photosTable} SET sort_order = ranked.position
    FROM ranked WHERE ${photosTable.id} = ranked.id
  `);
}

export async function setPhotographerPhotoOrder(
  tx: UploadTransaction, photographerId: number, photoIds: number[],
) {
  const owned = await tx.select({
    id: photosTable.id, sortOrder: photosTable.sortOrder, createdAt: photosTable.createdAt,
  }).from(photosTable).where(eq(photosTable.photographerId, photographerId))
    .orderBy(photosTable.id).for("update");
  const ownedIds = new Set(owned.map(photo => photo.id));
  const requested = [...new Set(photoIds)].filter(id => ownedIds.has(id));
  const requestedIds = new Set(requested);
  // An upload may have committed since the reorder screen fetched its list.
  // Keep omitted photos first rather than colliding with the saved positions.
  const omitted = owned.filter(photo => !requestedIds.has(photo.id)).sort((a, b) =>
    (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) ||
    b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
  ).map(photo => photo.id);
  const order = [...omitted, ...requested];
  if (!order.length) return;
  const positions = sql.join(order.map((id, index) => sql`(${id}::integer, ${index}::integer)`), sql`, `);
  await tx.execute(sql`
    UPDATE ${photosTable} SET sort_order = desired.position
    FROM (VALUES ${positions}) AS desired(id, position)
    WHERE ${photosTable.id} = desired.id
  `);
}