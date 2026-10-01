import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@workspace/db/schema";

// This suite must never import or write through the shared @workspace/db pool.
// Its Drizzle instance is backed by a disposable, Unix-socket-only PostgreSQL
// cluster, and object storage is replaced with an inert service.
const fixture = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@workspace/db", async () => ({
  ...await import("@workspace/db/schema"),
  db: fixture.db,
}));
vi.mock("./lib/objectStorage", () => ({
  ObjectStorageService: class {
    async getObjectEntityFile() {
      return { delete: async () => undefined };
    }
    normalizeObjectEntityPath(path: string) { return path; }
  },
  ObjectNotFoundError: class extends Error {},
}));

let tempDir: string;
let pgCtl: string;
let pool: pg.Pool;
let staging: typeof import("./lib/upload-staging");

const run = (bin: string, args: string[]) => execFileSync(bin, args, { encoding: "utf8", stdio: "pipe" });
// pg_ctl daemonizes and inherits stdio, so do not pipe its output.
const runPgCtl = (args: string[]) => execFileSync(pgCtl, args, { stdio: "ignore" });

const objectPath = (id: string) => `/objects/uploads/${id}`;
const imageUrl = (id: string) => `/api/storage/objects/uploads/${id}`;

async function waitForLockWait(queryFragment: string, count = 1) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
         AND wait_event_type = 'Lock'
         AND query ILIKE $1`,
      [`%${queryFragment}%`],
    );
    if (Number(rows[0].count) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const { rows } = await pool.query<{ wait_event_type: string | null; query: string }>(
    `SELECT wait_event_type, query FROM pg_stat_activity
     WHERE datname = current_database() AND pid <> pg_backend_pid()`,
  );
  throw new Error(`Expected ${count} PostgreSQL lock wait(s) for ${queryFragment}: ${JSON.stringify(rows)}`);
}

async function insertPhoto(url: string) {
  return pool.query(
    `INSERT INTO photo (title, image_url) VALUES ('Upload staging fixture', $1)`,
    [url],
  );
}

async function insertPhotographer() {
  const { rows: [photographer] } = await pool.query<{ id: number }>(
    "INSERT INTO photographer (name) VALUES ('Upload staging fixture') RETURNING id",
  );
  return photographer.id;
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "pm-upload-staging-pg-"));
  const binDir = dirname(run("which", ["postgres"]).trim());
  pgCtl = join(binDir, "pg_ctl");
  run(join(binDir, "initdb"), [
    "-D", join(tempDir, "data"), "-A", "trust", "-U", "postgres",
    "--no-instructions", "--no-sync",
  ]);
  runPgCtl([
    "-D", join(tempDir, "data"), "-o",
    `-k ${tempDir} -c listen_addresses='' -c fsync=off`,
    "-w", "start",
  ]);

  pool = new pg.Pool({ host: tempDir, database: "postgres", user: "postgres", max: 8 });
  await pool.query(`
    CREATE TABLE upload_reservation (
      object_path text PRIMARY KEY,
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'attached', 'deleting', 'deleted')),
      expires_at timestamptz NOT NULL,
      retry_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE photo (
      id serial PRIMARY KEY, title text NOT NULL, description text, image_url text NOT NULL,
      photographer_id integer, club_id integer, theme_id integer, like_count integer NOT NULL DEFAULT 0,
      sort_order integer, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE photographer (
      id serial PRIMARY KEY, name text NOT NULL, bio text, email text, avatar_url text,
      clerk_user_id text, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE club (
      id serial PRIMARY KEY, name text NOT NULL, description text, location text,
      website_url text, logo_url text, year_established integer,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  fixture.db = drizzle(pool, { schema });
  staging = await import("./lib/upload-staging");
}, 30000);

beforeEach(async () => {
  await pool.query("TRUNCATE upload_reservation, photo RESTART IDENTITY");
  await pool.query("TRUNCATE photographer RESTART IDENTITY");
});

afterAll(async () => {
  if (pool) await pool.end();
  if (pgCtl && tempDir) runPgCtl(["-D", join(tempDir, "data"), "-m", "immediate", "-w", "stop"]);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}, 30000);

describe("upload staging cleanup against isolated PostgreSQL", () => {
  it("registers a canonical pending upload with the full staging TTL", async () => {
    const now = new Date("2026-04-05T06:07:08.000Z");
    const path = objectPath("11111111-1111-4111-8111-111111111111");
    await staging.registerPendingUpload(path, now);

    const { rows: [reservation] } = await pool.query<{
      object_path: string; status: string; expires_at: Date; created_at: Date;
    }>("SELECT object_path, status, expires_at, created_at FROM upload_reservation WHERE object_path = $1", [path]);
    expect(staging.UPLOAD_STAGING_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(reservation).toMatchObject({ object_path: path, status: "pending" });
    expect(reservation.expires_at.getTime()).toBe(now.getTime() + staging.UPLOAD_STAGING_TTL_MS);
  });

  it("expires an unused upload and treats a missing uploaded object as an idempotent deletion", async () => {
    const now = new Date("2026-04-05T06:07:08.000Z");
    const path = objectPath("22222222-2222-4222-8222-222222222222");
    await staging.registerPendingUpload(path, now);
    const deleteObject = vi.fn(async (_path: string) => undefined); // The canceled upload never reached storage.

    const result = await staging.cleanupExpiredUploads({
      now: new Date(now.getTime() + staging.UPLOAD_STAGING_TTL_MS + 1),
      deleteObject,
    });

    expect(deleteObject).toHaveBeenCalledExactlyOnceWith(path);
    expect(result).toMatchObject({ deleted: 1, failed: 0 });
    const { rows: [reservation] } = await pool.query<{ status: string }>(
      "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
    );
    expect(reservation.status).toBe("deleted");
  });

  it("rolls back a failed photo insert and leaves the reservation pending", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const path = objectPath(id);
    const url = imageUrl(id);
    await staging.registerPendingUpload(path);

    await expect(staging.withUploadAttachment(url, async (tx) => {
      await tx.insert(schema.photosTable).values({ title: "Should roll back", imageUrl: url });
      throw new Error("simulated photo insert failure");
    })).rejects.toThrow("simulated photo insert failure");

    const { rows: [reservation] } = await pool.query<{ status: string }>(
      "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
    );
    const { rows: photos } = await pool.query("SELECT id FROM photo");
    expect(reservation.status).toBe("pending");
    expect(photos).toHaveLength(0);
  });

  it("marks a successfully attached upload as protected from cleanup", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    const path = objectPath(id);
    const url = imageUrl(id);
    const registeredAt = new Date();
    await staging.registerPendingUpload(path, registeredAt);

    const photo = await staging.withUploadAttachment(url, async (tx) => {
      const [created] = await tx.insert(schema.photosTable).values({
        title: "Saved upload", imageUrl: url,
      }).returning();
      return created;
    });
    const deleteObject = vi.fn(async (_path: string) => undefined);
    const result = await staging.cleanupExpiredUploads({
      now: new Date(registeredAt.getTime() + staging.UPLOAD_STAGING_TTL_MS + 1),
      deleteObject,
    });

    expect(photo).toBeDefined();
    expect(deleteObject).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
    const { rows: [reservation] } = await pool.query<{ status: string }>(
      "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
    );
    expect(reservation.status).toBe("attached");
  });

  it("marks an avatar upload as attached and protects it from cleanup", async () => {
    const id = "45454545-4545-4454-8454-454545454545";
    const path = objectPath(id);
    const url = imageUrl(id);
    const registeredAt = new Date();
    const photographerId = await insertPhotographer();
    await staging.registerPendingUpload(path, registeredAt);

    await staging.withUploadAttachment(url, async (tx) => {
      await tx.update(schema.photographersTable)
        .set({ avatarUrl: url })
        .where(eq(schema.photographersTable.id, photographerId));
    });
    const deleteObject = vi.fn(async (_path: string) => undefined);
    const result = await staging.cleanupExpiredUploads({
      now: new Date(registeredAt.getTime() + staging.UPLOAD_STAGING_TTL_MS + 1),
      deleteObject,
    });

    expect(deleteObject).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
    const { rows: [photographer] } = await pool.query<{ avatar_url: string }>(
      "SELECT avatar_url FROM photographer WHERE id = $1", [photographerId],
    );
    const { rows: [reservation] } = await pool.query<{ status: string }>(
      "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
    );
    expect(photographer.avatar_url).toBe(url);
    expect(reservation.status).toBe("attached");
  });

  it("serializes attach ahead of cleanup under a held PostgreSQL row lock", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    const path = objectPath(id);
    const url = imageUrl(id);
    const registeredAt = new Date();
    await staging.registerPendingUpload(path, registeredAt);

    const blocker = await pool.connect();
    let attachment: Promise<unknown> | undefined;
    let cleanup: Promise<unknown> | undefined;
    const deleteObject = vi.fn(async (_path: string) => undefined);
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT object_path FROM upload_reservation WHERE object_path = $1 FOR UPDATE", [path]);
      attachment = staging.withUploadAttachment(url, async (tx) => {
        return tx.insert(schema.photosTable).values({ title: "Won the lock", imageUrl: url }).returning();
      });
      await waitForLockWait("upload_reservation");

      cleanup = staging.cleanupExpiredUploads({
        now: new Date(registeredAt.getTime() + staging.UPLOAD_STAGING_TTL_MS + 1),
        deleteObject,
      });
      // A cleanup implementation using SKIP LOCKED may finish immediately;
      // one that queues on the row lock will be released behind the attachment.
      await Promise.race([
        cleanup,
        waitForLockWait("upload_reservation", 2).catch(() => undefined),
      ]);
    } finally {
      await blocker.query("COMMIT");
      blocker.release();
    }

    await Promise.all([attachment, cleanup]);
    expect(deleteObject).not.toHaveBeenCalled();
    const { rows: [reservation] } = await pool.query<{ status: string }>(
      "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
    );
    const { rows: photos } = await pool.query("SELECT id FROM photo");
    expect(reservation.status).toBe("attached");
    expect(photos).toHaveLength(1);
  }, 15000);

  it("serializes avatar attachment ahead of cleanup so the saved avatar is never deleted", async () => {
    const id = "57575757-5757-4575-8575-575757575757";
    const path = objectPath(id);
    const url = imageUrl(id);
    const registeredAt = new Date();
    const photographerId = await insertPhotographer();
    await staging.registerPendingUpload(path, registeredAt);

    const blocker = await pool.connect();
    let attachment: Promise<unknown> | undefined;
    let cleanup: Promise<unknown> | undefined;
    const deleteObject = vi.fn(async (_path: string) => undefined);
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT object_path FROM upload_reservation WHERE object_path = $1 FOR UPDATE", [path]);
      attachment = staging.withUploadAttachment(url, async (tx) => {
        await tx.update(schema.photographersTable)
          .set({ avatarUrl: url })
          .where(eq(schema.photographersTable.id, photographerId));
      });
      await waitForLockWait("upload_reservation");

      cleanup = staging.cleanupExpiredUploads({
        now: new Date(registeredAt.getTime() + staging.UPLOAD_STAGING_TTL_MS + 1),
        deleteObject,
      });
      await Promise.race([
        cleanup,
        waitForLockWait("upload_reservation", 2).catch(() => undefined),
      ]);
    } finally {
      await blocker.query("COMMIT");
      blocker.release();
    }

    await Promise.all([attachment, cleanup]);
    expect(deleteObject).not.toHaveBeenCalled();
    const { rows: [photographer] } = await pool.query<{ avatar_url: string }>(
      "SELECT avatar_url FROM photographer WHERE id = $1", [photographerId],
    );
    const { rows: [reservation] } = await pool.query<{ status: string }>(
      "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
    );
    expect(photographer.avatar_url).toBe(url);
    expect(reservation.status).toBe("attached");
  }, 15000);

  it("rejects attachment while cleanup has claimed the reservation and is deleting the object", async () => {
    const id = "56565656-5656-4565-8565-565656565656";
    const path = objectPath(id);
    const url = imageUrl(id);
    const registeredAt = new Date();
    await staging.registerPendingUpload(path, registeredAt);

    let signalDeleteStarted!: () => void;
    let finishDelete!: () => void;
    const deleteStarted = new Promise<void>((resolve) => { signalDeleteStarted = resolve; });
    const deletionGate = new Promise<void>((resolve) => { finishDelete = resolve; });
    const deleteObject = vi.fn(async (_path: string) => {
      signalDeleteStarted();
      await deletionGate;
    });
    const cleanup = staging.cleanupExpiredUploads({
      now: new Date(registeredAt.getTime() + staging.UPLOAD_STAGING_TTL_MS + 1),
      deleteObject,
    });

    try {
      await deleteStarted;
      const { rows: [reservation] } = await pool.query<{ status: string }>(
        "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
      );
      expect(reservation.status).toBe("deleting");

      const create = vi.fn(async (tx: any) => {
        await tx.insert(schema.photosTable).values({ title: "Must not save", imageUrl: url });
        return "created";
      });
      await expect(staging.withUploadAttachment(url, create)).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
      const { rows: photos } = await pool.query("SELECT id FROM photo");
      expect(photos).toHaveLength(0);
    } finally {
      finishDelete();
    }

    const result = await cleanup;
    expect(result.deleted).toBe(1);
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith(path);
    const { rows: [reservation] } = await pool.query<{ status: string }>(
      "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
    );
    expect(reservation.status).toBe("deleted");
  });

  it("rejects a late attachment after an expired reservation has been tombstoned", async () => {
    const id = "66666666-6666-4666-8666-666666666666";
    const path = objectPath(id);
    const url = imageUrl(id);
    await staging.registerPendingUpload(path, new Date("2026-04-05T06:07:08.000Z"));
    const deleteObject = vi.fn(async (_path: string) => undefined);
    await staging.cleanupExpiredUploads({
      now: new Date("2026-04-07T06:07:09.000Z"),
      deleteObject,
    });

    const create = vi.fn(async () => "should not create");
    await expect(staging.withUploadAttachment(url, create)).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith(path);
    const { rows: [reservation] } = await pool.query<{ status: string }>(
      "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
    );
    expect(reservation.status).toBe("deleted");
  });

  it("defers a failed storage deletion until its retry time, then retries it", async () => {
    const id = "77777777-7777-4777-8777-777777777777";
    const path = objectPath(id);
    await staging.registerPendingUpload(path, new Date("2026-04-05T06:07:08.000Z"));
    const now = new Date("2026-04-07T06:07:09.000Z");
    const failDelete = vi.fn(async (_path: string) => { throw new Error("storage temporarily unavailable"); });

    const first = await staging.cleanupExpiredUploads({ now, deleteObject: failDelete });
    expect(first).toMatchObject({ failed: 1, deleted: 0 });
    let { rows: [reservation] } = await pool.query<{ status: string; retry_at: Date }>(
      "SELECT status, retry_at FROM upload_reservation WHERE object_path = $1", [path],
    );
    expect(reservation.status).toBe("deleting");
    expect(reservation.retry_at.getTime()).toBe(now.getTime() + staging.UPLOAD_CLEANUP_RETRY_MS);

    const retryDelete = vi.fn(async (_path: string) => undefined);
    const deferred = await staging.cleanupExpiredUploads({ now, deleteObject: retryDelete });
    expect(deferred).toMatchObject({ deleted: 0, failed: 0 });
    expect(retryDelete).not.toHaveBeenCalled();

    const retry = await staging.cleanupExpiredUploads({
      now: new Date(now.getTime() + staging.UPLOAD_CLEANUP_RETRY_MS),
      deleteObject: retryDelete,
    });
    expect(retryDelete).toHaveBeenCalledExactlyOnceWith(path);
    expect(retry.deleted).toBe(1);
    ({ rows: [reservation] } = await pool.query(
      "SELECT status FROM upload_reservation WHERE object_path = $1", [path],
    ));
    expect(reservation.status).toBe("deleted");
  });

  it("skips a poisoned retry slot so the next expired upload is collected in a limited sweep", async () => {
    const poisonedId = "78787878-7878-4787-8787-787878787878";
    const newerId = "79797979-7979-4797-8797-797979797979";
    const poisonedPath = objectPath(poisonedId);
    const newerPath = objectPath(newerId);
    const registeredAt = new Date("2026-04-05T06:07:08.000Z");
    await staging.registerPendingUpload(poisonedPath, registeredAt);
    await staging.registerPendingUpload(newerPath, new Date(registeredAt.getTime() + 60_000));
    const now = new Date(registeredAt.getTime() + 60_000 + staging.UPLOAD_STAGING_TTL_MS + 1);
    const failDelete = vi.fn(async (_path: string) => { throw new Error("storage unavailable for this object"); });

    const first = await staging.cleanupExpiredUploads({ now, limit: 1, deleteObject: failDelete });
    expect(first).toMatchObject({ failed: 1, deleted: 0 });
    expect(failDelete).toHaveBeenCalledExactlyOnceWith(poisonedPath);

    const deleteNewer = vi.fn(async (_path: string) => undefined);
    const next = await staging.cleanupExpiredUploads({ now, limit: 1, deleteObject: deleteNewer });
    expect(next.deleted).toBe(1);
    expect(deleteNewer).toHaveBeenCalledExactlyOnceWith(newerPath);
    const { rows: reservations } = await pool.query<{ object_path: string; status: string; retry_at: Date | null }>(
      "SELECT object_path, status, retry_at FROM upload_reservation ORDER BY object_path",
    );
    expect(reservations).toContainEqual(expect.objectContaining({
      object_path: poisonedPath, status: "deleting",
      retry_at: new Date(now.getTime() + staging.UPLOAD_CLEANUP_RETRY_MS),
    }));
    expect(reservations.find((row) => row.object_path === newerPath)?.status).toBe("deleted");
  });

  it("ignores untracked legacy and imported image URLs", async () => {
    const legacyUrls = [
      "/objects/imports/88888888-8888-4888-8888-888888888888",
      "https://legacy.example.test/photos/existing.jpg",
    ];
    for (const url of legacyUrls) await insertPhoto(url);
    const deleteObject = vi.fn(async (_path: string) => undefined);

    const result = await staging.cleanupExpiredUploads({
      now: new Date("2030-01-01T00:00:00.000Z"),
      deleteObject,
    });

    expect(deleteObject).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
    const { rows: photos } = await pool.query("SELECT image_url FROM photo ORDER BY image_url");
    expect(photos.map((photo) => photo.image_url).sort()).toEqual(legacyUrls.sort());
  });
});