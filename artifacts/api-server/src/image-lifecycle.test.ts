import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@workspace/db/schema";

// Never use the shared application database or real object storage here.
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
    async deleteUploadObject() { return undefined; }
    normalizeObjectEntityPath(path: string) { return path; }
  },
  ObjectNotFoundError: class extends Error {},
}));

let tempDir: string;
let pgCtl: string;
let pool: pg.Pool;
let lifecycle: typeof import("./lib/image-lifecycle");
let staging: typeof import("./lib/upload-staging");

const run = (bin: string, args: string[]) => execFileSync(bin, args, { encoding: "utf8", stdio: "pipe" });
const runPgCtl = (args: string[]) => execFileSync(pgCtl, args, { stdio: "ignore" });
const objectPath = (id: string) => `/objects/uploads/${id}`;
const imageUrl = (id: string) => `/api/storage/objects/uploads/${id}`;
const encodedImageUrl = (id: string) => imageUrl(id.replace("a", "%61"));
const future = new Date("2099-01-01T00:00:00.000Z");
const now = new Date("2026-04-05T06:07:08.000Z");

type ReviewMutationHelpers = {
  createPhotoReviewWithReferences(input: {
    sessionPhotoId: number; reviewerPhotographerId: number; rating: number; comment?: string | null;
  }): Promise<unknown>;
  removeSessionPhotoWithReferences(id: number): Promise<unknown>;
};

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

async function addPhotographer(name = "Lifecycle fixture", avatarUrl: string | null = null) {
  const { rows: [row] } = await pool.query<{ id: number }>(
    "INSERT INTO photographer (name, avatar_url) VALUES ($1, $2) RETURNING id",
    [name, avatarUrl],
  );
  return row.id;
}

async function addPhoto(url: string, photographerId: number | null = null) {
  const { rows: [row] } = await pool.query<{ id: number }>(
    `INSERT INTO photo (title, image_url, photographer_id)
     VALUES ('Lifecycle fixture', $1, $2) RETURNING id`,
    [url, photographerId],
  );
  return row.id;
}

async function addReservation(path: string, status = "attached", expiresAt = future) {
  await pool.query(
    `INSERT INTO upload_reservation (object_path, status, expires_at)
     VALUES ($1, $2, $3)`,
    [path, status, expiresAt],
  );
}

async function addReviewSession(id: number) {
  await pool.query(
    "INSERT INTO review_session (id, club_id, title) VALUES ($1, 1, 'Lifecycle review session')",
    [id],
  );
}

async function assertEncodedReferenceBlocksCleanup(path: string, encodedUrl: string) {
  // Exercise cleanup's conservative reference scan independently of the
  // release-side status update by making this reservation look expired.
  await pool.query(
    "UPDATE upload_reservation SET status = 'pending', expires_at = $2 WHERE object_path = $1",
    [path, new Date(now.getTime() - 1)],
  );
  const deleteObject = vi.fn(async (_path: string) => undefined);
  const scan = await staging.cleanupExpiredUploads({ now, deleteObject });
  expect(scan).toMatchObject({ retained: 1, deleted: 0, failed: 0 });
  expect(deleteObject).not.toHaveBeenCalled();
  expect((await reservation(path)).status).toBe("attached");
  expect(encodedUrl).toContain("%61");
  return deleteObject;
}

async function expectReclamationSweep(path: string, deleteObject: ReturnType<typeof vi.fn>) {
  const row = await reservation(path);
  expect(row.status).toBe("pending");
  const result = await staging.cleanupExpiredUploads({
    now: new Date(row.expires_at.getTime() + 1), deleteObject,
  });
  expect(result.deleted).toBe(1);
  expect(deleteObject).toHaveBeenCalledExactlyOnceWith(path);
  expect((await reservation(path)).status).toBe("deleted");
}

async function reservation(path: string) {
  const { rows: [row] } = await pool.query<{
    object_path: string; status: string; expires_at: Date; retry_at: Date | null;
  }>(
    "SELECT object_path, status, expires_at, retry_at FROM upload_reservation WHERE object_path = $1",
    [path],
  );
  return row;
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "pm-image-lifecycle-pg-"));
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

  pool = new pg.Pool({ host: tempDir, database: "postgres", user: "postgres", max: 12 });
  await pool.query(`
    CREATE TABLE photographer (
      id serial PRIMARY KEY, name text NOT NULL, bio text, email text, avatar_url text,
      clerk_user_id text, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE photo (
      id serial PRIMARY KEY, title text NOT NULL, description text, image_url text NOT NULL,
      photographer_id integer, club_id integer, theme_id integer, like_count integer NOT NULL DEFAULT 0,
      sort_order integer, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE upload_reservation (
      object_path text PRIMARY KEY,
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'attached', 'deleting', 'deleted')),
      expires_at timestamptz NOT NULL,
      retry_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE club (
      id serial PRIMARY KEY, name text NOT NULL, description text, location text,
      website_url text, logo_url text, year_established integer,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE session_photo (
      id serial PRIMARY KEY, session_id integer NOT NULL, photo_id integer NOT NULL,
      photographer_id integer NOT NULL, sort_order integer NOT NULL DEFAULT 0,
      submitted_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE review_session (
      id serial PRIMARY KEY, club_id integer NOT NULL, title text NOT NULL, description text,
      status text NOT NULL DEFAULT 'open', created_by_admin_id integer, scheduled_for timestamp,
      submission_deadline timestamp, max_photos_per_member integer,
      created_at timestamp NOT NULL DEFAULT now(), closed_at timestamp
    );
    CREATE TABLE session_reviewer (
      id serial PRIMARY KEY, session_id integer NOT NULL, photographer_id integer NOT NULL,
      added_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE photo_review (
      id serial PRIMARY KEY, session_photo_id integer NOT NULL,
      reviewer_photographer_id integer NOT NULL, rating integer NOT NULL, comment text,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE photographer_club (
      photographer_id integer NOT NULL, club_id integer NOT NULL,
      joined_at timestamp NOT NULL DEFAULT now(), member_since integer,
      PRIMARY KEY (photographer_id, club_id)
    );
    CREATE TABLE photographer_theme (
      photographer_id integer NOT NULL, theme_id integer NOT NULL,
      added_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (photographer_id, theme_id)
    );
  `);
  fixture.db = drizzle(pool, { schema });
  lifecycle = await import("./lib/image-lifecycle");
  staging = await import("./lib/upload-staging");
}, 30000);

beforeEach(async () => {
  await pool.query(`
    TRUNCATE photo_review, session_reviewer, session_photo, review_session, photographer_club,
      photographer_theme, photo, photographer, club, upload_reservation
      RESTART IDENTITY
  `);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (pgCtl && tempDir) runPgCtl(["-D", join(tempDir, "data"), "-m", "immediate", "-w", "stop"]);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}, 30000);

describe("image reclamation on isolated Unix-socket PostgreSQL", () => {
  it("retires the last photo reference for 24 hours before sweeping the object", async () => {
    const id = "10101010-1010-4010-8010-101010101010";
    const path = objectPath(id);
    const url = imageUrl(id);
    const photoId = await addPhoto(url);
    await addReservation(path);

    const deleted = await lifecycle.deletePhotosWithReclamation([photoId], now);
    expect(deleted).toHaveLength(1);
    expect(deleted[0].id).toBe(photoId);
    expect((await reservation(path)).status).toBe("pending");
    expect((await reservation(path)).expires_at.getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000);

    const deleteObject = vi.fn(async (_path: string) => undefined);
    const beforeExpiry = await staging.cleanupExpiredUploads({
      now: new Date(now.getTime() + 24 * 60 * 60 * 1000 - 1), deleteObject,
    });
    expect(beforeExpiry.deleted).toBe(0);
    expect(deleteObject).not.toHaveBeenCalled();

    const swept = await staging.cleanupExpiredUploads({
      now: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1), deleteObject,
    });
    expect(swept.deleted).toBe(1);
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith(path);
    expect((await reservation(path)).status).toBe("deleted");
  });

  it("keeps shared photo, avatar, and club-logo URLs attached when a photo reference is removed", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const path = objectPath(id);
    const url = imageUrl(id);
    const photographerId = await addPhotographer("Shared avatar", url);
    const photoId = await addPhoto(url, photographerId);
    await addPhoto(url);
    await pool.query("INSERT INTO club (name, logo_url) VALUES ('Shared logo', $1)", [url]);
    await addReservation(path);

    await lifecycle.deletePhotosWithReclamation([photoId], now);
    expect((await reservation(path)).status).toBe("attached");

    await lifecycle.updatePhotographerWithReclamation(photographerId, { avatarUrl: null }, now);
    expect((await reservation(path)).status).toBe("attached");
    const { rows: [club] } = await pool.query<{ logo_url: string }>(
      "SELECT logo_url FROM club WHERE name = 'Shared logo'",
    );
    expect(club.logo_url).toBe(url);
    const deleteObject = vi.fn(async (_path: string) => undefined);
    await staging.cleanupExpiredUploads({
      now: new Date("2030-01-01T00:00:00.000Z"), deleteObject,
    });
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("recognizes a percent-encoded UUID in a surviving photo reference", async () => {
    const id = "a1111111-1111-4111-8111-111111111111";
    const path = objectPath(id);
    const literalPhotoId = await addPhoto(imageUrl(id));
    const encodedPhotoId = await addPhoto(encodedImageUrl(id));
    await addReservation(path);

    await lifecycle.deletePhotosWithReclamation([literalPhotoId], now);
    expect((await reservation(path)).status).toBe("attached");
    const deleteObject = await assertEncodedReferenceBlocksCleanup(path, encodedImageUrl(id));

    await lifecycle.deletePhotosWithReclamation([encodedPhotoId], now);
    await expectReclamationSweep(path, deleteObject);
  });

  it("recognizes a percent-encoded UUID in a surviving avatar reference", async () => {
    const id = "a2222222-2222-4222-8222-222222222222";
    const path = objectPath(id);
    const photographerId = await addPhotographer("Encoded avatar", encodedImageUrl(id));
    const literalPhotoId = await addPhoto(imageUrl(id));
    await addReservation(path);

    await lifecycle.deletePhotosWithReclamation([literalPhotoId], now);
    expect((await reservation(path)).status).toBe("attached");
    const deleteObject = await assertEncodedReferenceBlocksCleanup(path, encodedImageUrl(id));

    await lifecycle.updatePhotographerWithReclamation(photographerId, { avatarUrl: null }, now);
    await expectReclamationSweep(path, deleteObject);
  });

  it("recognizes a percent-encoded UUID in a surviving club-logo reference", async () => {
    const id = "a3333333-3333-4333-8333-333333333333";
    const path = objectPath(id);
    const literalPhotoId = await addPhoto(imageUrl(id));
    const { rows: [club] } = await pool.query<{ id: number }>(
      "INSERT INTO club (name, logo_url) VALUES ('Encoded logo', $1) RETURNING id",
      [encodedImageUrl(id)],
    );
    await addReservation(path);

    await lifecycle.deletePhotosWithReclamation([literalPhotoId], now);
    expect((await reservation(path)).status).toBe("attached");
    const deleteObject = await assertEncodedReferenceBlocksCleanup(path, encodedImageUrl(id));

    await staging.withUploadLifecycle({ release: [encodedImageUrl(id)] }, async (tx) => {
      await tx.update(schema.clubsTable).set({ logoUrl: null })
        .where(eq(schema.clubsTable.id, club.id));
    }, { now });
    await expectReclamationSweep(path, deleteObject);
  });

  it("refuses to delete a gallery-less photo that is referenced by a review session", async () => {
    const id = "12121212-1212-4212-8212-121212121212";
    const path = objectPath(id);
    const url = imageUrl(id);
    const photographerId = await addPhotographer();
    const photoId = await addPhoto(url, photographerId);
    await pool.query(
      "INSERT INTO session_photo (session_id, photo_id, photographer_id) VALUES (7, $1, $2)",
      [photoId, photographerId],
    );
    await addReservation(path);

    await expect(lifecycle.deletePhotosWithReclamation([photoId], now)).rejects.toThrow();
    const { rows: photos } = await pool.query("SELECT id FROM photo WHERE id = $1", [photoId]);
    expect(photos).toHaveLength(1);
    expect((await reservation(path)).status).toBe("attached");
  });

  it("refuses photographer deletion when they own a session submission or are a reviewer", async () => {
    const ownerId = await addPhotographer("Session owner");
    const ownerPhotoId = await addPhoto(imageUrl("13131313-1313-4313-8313-131313131313"), ownerId);
    await pool.query(
      "INSERT INTO session_photo (session_id, photo_id, photographer_id) VALUES (1, $1, $2)",
      [ownerPhotoId, ownerId],
    );
    await expect(lifecycle.deletePhotographerWithReclamation(ownerId, now)).rejects.toThrow();

    const assignedReviewerId = await addPhotographer("Assigned reviewer");
    await pool.query(
      "INSERT INTO session_reviewer (session_id, photographer_id) VALUES (2, $1)",
      [assignedReviewerId],
    );
    await expect(lifecycle.deletePhotographerWithReclamation(assignedReviewerId, now)).rejects.toThrow();

    const reviewAuthorId = await addPhotographer("Review author");
    const submitterId = await addPhotographer("Photo submitter");
    const reviewPhotoId = await addPhoto(imageUrl("14141414-1414-4414-8414-141414141414"), submitterId);
    const { rows: [sessionPhoto] } = await pool.query<{ id: number }>(
      `INSERT INTO session_photo (session_id, photo_id, photographer_id)
       VALUES (3, $1, $2) RETURNING id`,
      [reviewPhotoId, submitterId],
    );
    await pool.query(
      `INSERT INTO photo_review (session_photo_id, reviewer_photographer_id, rating)
       VALUES ($1, $2, 5)`,
      [sessionPhoto.id, reviewAuthorId],
    );
    await expect(lifecycle.deletePhotographerWithReclamation(reviewAuthorId, now)).rejects.toThrow();

    for (const id of [ownerId, assignedReviewerId, reviewAuthorId]) {
      const { rows } = await pool.query("SELECT id FROM photographer WHERE id = $1", [id]);
      expect(rows).toHaveLength(1);
    }
  });

  it("retires a deleted photographer's own photos and avatar but preserves another photographer's shared photo", async () => {
    const ownerId = await addPhotographer("To delete", imageUrl("15151515-1515-4515-8515-151515151515"));
    const otherId = await addPhotographer("Other photographer");
    const avatarPath = objectPath("15151515-1515-4515-8515-151515151515");
    const ownedPath = objectPath("16161616-1616-4616-8616-161616161616");
    const sharedPath = objectPath("17171717-1717-4717-8717-171717171717");
    await addPhoto(imageUrl("16161616-1616-4616-8616-161616161616"), ownerId);
    await addPhoto(imageUrl("17171717-1717-4717-8717-171717171717"), ownerId);
    await addPhoto(imageUrl("17171717-1717-4717-8717-171717171717"), otherId);
    await addReservation(avatarPath);
    await addReservation(ownedPath);
    await addReservation(sharedPath);

    const deleted = await lifecycle.deletePhotographerWithReclamation(ownerId, now);
    expect(deleted.id).toBe(ownerId);
    expect((await reservation(avatarPath)).status).toBe("pending");
    expect((await reservation(ownedPath)).status).toBe("pending");
    expect((await reservation(sharedPath)).status).toBe("attached");
    const { rows: remainingShared } = await pool.query(
      "SELECT id FROM photo WHERE image_url = $1", [imageUrl("17171717-1717-4717-8717-171717171717")],
    );
    expect(remainingShared).toHaveLength(1);
  });

  it("does not retire an unchanged avatar and retires the old avatar when it is cleared", async () => {
    const id = "18181818-1818-4818-8818-181818181818";
    const path = objectPath(id);
    const url = imageUrl(id);
    const photographerId = await addPhotographer("Avatar owner", url);
    await addReservation(path);

    await lifecycle.updatePhotographerWithReclamation(photographerId, { avatarUrl: url }, now);
    expect((await reservation(path)).status).toBe("attached");

    const updated = await lifecycle.updatePhotographerWithReclamation(photographerId, { avatarUrl: "" }, now);
    expect(updated.avatarUrl).toBe("");
    expect((await reservation(path)).status).toBe("pending");
  });

  it("serializes concurrent avatar replacements without leaking the intermediate upload", async () => {
    const initialId = "19191919-1919-4919-8919-191919191919";
    const firstId = "20202020-2020-4020-8020-202020202020";
    const secondId = "21212121-2121-4121-8121-212121212121";
    const initialUrl = imageUrl(initialId);
    const firstUrl = imageUrl(firstId);
    const secondUrl = imageUrl(secondId);
    const photographerId = await addPhotographer("Concurrent avatar", initialUrl);
    for (const id of [initialId, firstId, secondId]) await addReservation(objectPath(id));

    await Promise.all([
      lifecycle.updatePhotographerWithReclamation(photographerId, { avatarUrl: firstUrl }, now),
      lifecycle.updatePhotographerWithReclamation(photographerId, { avatarUrl: secondUrl }, now),
    ]);

    const { rows: [photographer] } = await pool.query<{ avatar_url: string }>(
      "SELECT avatar_url FROM photographer WHERE id = $1", [photographerId],
    );
    expect([firstUrl, secondUrl]).toContain(photographer.avatar_url);
    const finalPath = photographer.avatar_url === firstUrl ? objectPath(firstId) : objectPath(secondId);
    const replacedPath = photographer.avatar_url === firstUrl ? objectPath(secondId) : objectPath(firstId);
    expect((await reservation(finalPath)).status).toBe("attached");
    expect((await reservation(replacedPath)).status).toBe("pending");
    expect((await reservation(objectPath(initialId))).status).toBe("pending");
  });

  it("rolls back photo mutation and reclamation state when the database rejects deletion", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const path = objectPath(id);
    const photoId = await addPhoto(imageUrl(id));
    await addReservation(path);
    await pool.query(`
      CREATE FUNCTION reject_fixture_photo_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'simulated photo delete failure'; END;
      $$;
      CREATE TRIGGER reject_fixture_photo_delete BEFORE DELETE ON photo
      FOR EACH ROW EXECUTE FUNCTION reject_fixture_photo_delete();
    `);

    try {
      const failure = await lifecycle.deletePhotosWithReclamation([photoId], now)
        .catch((error: unknown) => error);
      expect(failure).toMatchObject({ cause: { message: "simulated photo delete failure" } });
      const { rows } = await pool.query("SELECT id FROM photo WHERE id = $1", [photoId]);
      expect(rows).toHaveLength(1);
      expect((await reservation(path)).status).toBe("attached");
    } finally {
      await pool.query("DROP TRIGGER reject_fixture_photo_delete ON photo");
      await pool.query("DROP FUNCTION reject_fixture_photo_delete()");
    }
  });

  it("backs off failed object deletion and retries only when retry_at is due", async () => {
    const id = "23232323-2323-4323-8323-232323232323";
    const path = objectPath(id);
    const photoId = await addPhoto(imageUrl(id));
    await addReservation(path);
    await lifecycle.deletePhotosWithReclamation([photoId], now);
    const due = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1);
    const failDelete = vi.fn(async (_path: string) => { throw new Error("temporary storage failure"); });

    const failed = await staging.cleanupExpiredUploads({ now: due, deleteObject: failDelete });
    expect(failed).toMatchObject({ failed: 1, deleted: 0 });
    let row = await reservation(path);
    expect(row.status).toBe("deleting");
    expect(row.retry_at?.getTime()).toBe(due.getTime() + staging.UPLOAD_CLEANUP_RETRY_MS);

    const retryDelete = vi.fn(async (_path: string) => undefined);
    await staging.cleanupExpiredUploads({ now: due, deleteObject: retryDelete });
    expect(retryDelete).not.toHaveBeenCalled();
    await staging.cleanupExpiredUploads({
      now: new Date(due.getTime() + staging.UPLOAD_CLEANUP_RETRY_MS), deleteObject: retryDelete,
    });
    expect(retryDelete).toHaveBeenCalledExactlyOnceWith(path);
    row = await reservation(path);
    expect(row.status).toBe("deleted");
    expect(row.retry_at).toBeNull();
  });

  it("lets attachment win a cleanup race when it holds the reservation lock first", async () => {
    const id = "24242424-2424-4424-8424-242424242424";
    const path = objectPath(id);
    const url = imageUrl(id);
    const photographerId = await addPhotographer("Attach race");
    await addReservation(path, "pending", new Date(Date.now() + 60 * 60 * 1000));

    let signalStarted!: () => void;
    let finishAttachment!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const attachmentGate = new Promise<void>((resolve) => { finishAttachment = resolve; });
    const attachment = lifecycle.withPhotographerUploadAttachment(photographerId, url, async (tx) => {
      signalStarted();
      await attachmentGate;
      await tx.update(schema.photographersTable)
        .set({ avatarUrl: url })
        .where(eq(schema.photographersTable.id, photographerId));
      return "attached";
    });
    await started;
    const deleteObject = vi.fn(async (_path: string) => undefined);
    const cleanup = staging.cleanupExpiredUploads({
      now: new Date(Date.now() + 2 * 60 * 60 * 1000), deleteObject,
    });
    finishAttachment();
    await expect(attachment).resolves.toBe("attached");
    await cleanup;

    expect(deleteObject).not.toHaveBeenCalled();
    expect((await reservation(path)).status).toBe("attached");
  });

  it("lets cleanup win a race and rejects attachment after the object is claimed", async () => {
    const id = "25252525-2525-4525-8525-252525252525";
    const path = objectPath(id);
    const url = imageUrl(id);
    const photographerId = await addPhotographer("Cleanup race");
    await addReservation(path, "pending", new Date(Date.now() + 60 * 60 * 1000));
    let signalDeleteStarted!: () => void;
    let finishDelete!: () => void;
    const deleteStarted = new Promise<void>((resolve) => { signalDeleteStarted = resolve; });
    const deletionGate = new Promise<void>((resolve) => { finishDelete = resolve; });
    const deleteObject = vi.fn(async (_path: string) => {
      signalDeleteStarted();
      await deletionGate;
    });
    const cleanup = staging.cleanupExpiredUploads({
      now: new Date(Date.now() + 2 * 60 * 60 * 1000), deleteObject,
    });

    try {
      await deleteStarted;
      expect((await reservation(path)).status).toBe("deleting");
      const create = vi.fn(async (tx: any) => {
        await tx.update(schema.photographersTable)
          .set({ avatarUrl: url })
          .where(eq(schema.photographersTable.id, photographerId));
        return "must not attach";
      });
      await expect(lifecycle.withPhotographerUploadAttachment(photographerId, url, create)).rejects.toThrow();
      expect(create).not.toHaveBeenCalled();
      const { rows: [photographer] } = await pool.query<{ avatar_url: string | null }>(
        "SELECT avatar_url FROM photographer WHERE id = $1", [photographerId],
      );
      expect(photographer.avatar_url).toBeNull();
    } finally {
      finishDelete();
    }

    await cleanup;
    expect(deleteObject).toHaveBeenCalledExactlyOnceWith(path);
    expect((await reservation(path)).status).toBe("deleted");
  });

  it("serializes review linking against photo deletion so exactly one operation safely wins", async () => {
    const id = "26262626-2626-4626-8626-262626262626";
    const path = objectPath(id);
    const photographerId = await addPhotographer("Review race");
    const photoId = await addPhoto(imageUrl(id), photographerId);
    await addReviewSession(9);
    await addReservation(path);

    const results = await Promise.allSettled([
      lifecycle.createReviewPhotoReference({ photographerId, sessionId: 9, photoId }),
      lifecycle.deletePhotosWithReclamation([photoId], now),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const { rows: photos } = await pool.query("SELECT id FROM photo WHERE id = $1", [photoId]);
    const { rows: links } = await pool.query("SELECT id FROM session_photo WHERE photo_id = $1", [photoId]);
    if (photos.length === 1) {
      expect(links).toHaveLength(1);
      expect((await reservation(path)).status).toBe("attached");
    } else {
      expect(links).toHaveLength(0);
      expect((await reservation(path)).status).toBe("pending");
    }
  });

  it("lets a review win against submission removal and then rejects removal with 409", async () => {
    const reviewerId = await addPhotographer("Review wins");
    await addReviewSession(41);
    const photoId = await addPhoto(imageUrl("41414141-4141-4141-8141-414141414141"), reviewerId);
    const { rows: [submission] } = await pool.query<{ id: number }>(
      `INSERT INTO session_photo (session_id, photo_id, photographer_id)
       VALUES (41, $1, $2) RETURNING id`,
      [photoId, reviewerId],
    );
    await pool.query(
      "INSERT INTO session_reviewer (session_id, photographer_id) VALUES (41, $1)",
      [reviewerId],
    );
    const helpers = lifecycle as typeof lifecycle & ReviewMutationHelpers;
    const blocker = await pool.connect();
    let review!: Promise<unknown>;
    let removal!: Promise<unknown>;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM session_photo WHERE id = $1 FOR UPDATE", [submission.id]);
      review = helpers.createPhotoReviewWithReferences({
        sessionPhotoId: submission.id, reviewerPhotographerId: reviewerId, rating: 5,
      });
      await waitForLockWait("session_photo");
      removal = helpers.removeSessionPhotoWithReferences(submission.id);
      await waitForLockWait("session_photo", 2);
    } finally {
      await blocker.query("COMMIT");
      blocker.release();
    }

    const [reviewResult, removalResult] = await Promise.allSettled([review, removal]);
    expect(reviewResult.status).toBe("fulfilled");
    expect(removalResult.status).toBe("rejected");
    if (removalResult.status === "rejected") {
      expect(removalResult.reason).toMatchObject({ status: 409 });
    }
    const { rows: submissions } = await pool.query(
      "SELECT id FROM session_photo WHERE id = $1", [submission.id],
    );
    const { rows: reviews } = await pool.query(
      "SELECT id FROM photo_review WHERE session_photo_id = $1", [submission.id],
    );
    expect(submissions).toHaveLength(1);
    expect(reviews).toHaveLength(1);
  });

  it("lets submission removal win and rejects a late review with 404 without creating an orphan", async () => {
    const reviewerId = await addPhotographer("Removal wins");
    await addReviewSession(42);
    const photoId = await addPhoto(imageUrl("42424242-4242-4242-8242-424242424242"), reviewerId);
    const { rows: [submission] } = await pool.query<{ id: number }>(
      `INSERT INTO session_photo (session_id, photo_id, photographer_id)
       VALUES (42, $1, $2) RETURNING id`,
      [photoId, reviewerId],
    );
    await pool.query(
      "INSERT INTO session_reviewer (session_id, photographer_id) VALUES (42, $1)",
      [reviewerId],
    );
    const helpers = lifecycle as typeof lifecycle & ReviewMutationHelpers;
    const blocker = await pool.connect();
    let review!: Promise<unknown>;
    let removal!: Promise<unknown>;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM session_photo WHERE id = $1 FOR UPDATE", [submission.id]);
      removal = helpers.removeSessionPhotoWithReferences(submission.id);
      await waitForLockWait("session_photo");
      review = helpers.createPhotoReviewWithReferences({
        sessionPhotoId: submission.id, reviewerPhotographerId: reviewerId, rating: 4,
      });
      await waitForLockWait("session_photo", 2);
    } finally {
      await blocker.query("COMMIT");
      blocker.release();
    }

    const [reviewResult, removalResult] = await Promise.allSettled([review, removal]);
    expect(removalResult.status).toBe("fulfilled");
    expect(reviewResult.status).toBe("rejected");
    if (reviewResult.status === "rejected") {
      expect(reviewResult.reason).toMatchObject({ status: 404 });
    }
    const { rows: submissions } = await pool.query(
      "SELECT id FROM session_photo WHERE id = $1", [submission.id],
    );
    const { rows: reviews } = await pool.query(
      "SELECT id FROM photo_review WHERE session_photo_id = $1", [submission.id],
    );
    expect(submissions).toHaveLength(0);
    expect(reviews).toHaveLength(0);
  });

  it("serializes a new reviewer reference against photographer deletion", async () => {
    const photographerId = await addPhotographer("Reviewer deletion race");
    const results = await Promise.allSettled([
      lifecycle.withReviewPhotographerReferences([photographerId], async (tx) => {
        const [reviewer] = await tx.insert(schema.sessionReviewersTable)
          .values({ sessionId: 10, photographerId }).returning();
        return reviewer;
      }),
      lifecycle.deletePhotographerWithReclamation(photographerId, now),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const { rows: photographers } = await pool.query(
      "SELECT id FROM photographer WHERE id = $1", [photographerId],
    );
    const { rows: reviewers } = await pool.query(
      "SELECT id FROM session_reviewer WHERE photographer_id = $1", [photographerId],
    );
    if (photographers.length === 1) {
      expect(reviewers).toHaveLength(1);
    } else {
      expect(reviewers).toHaveLength(0);
    }
  });

  it("does not track or reclaim untracked legacy, external, or imported images", async () => {
    const urls = [
      "/objects/imports/27272727-2727-4727-8727-272727272727",
      "https://legacy.example.test/photos/existing.jpg",
      "https://images.example.test/imported.webp",
    ];
    const ids: number[] = [];
    for (const url of urls) ids.push(await addPhoto(url));
    const photographerId = await addPhotographer("Legacy avatar", urls[1]);

    await lifecycle.deletePhotosWithReclamation(ids, now);
    await lifecycle.deletePhotographerWithReclamation(photographerId, now);
    const { rows: reservations } = await pool.query("SELECT object_path FROM upload_reservation");
    expect(reservations).toHaveLength(0);
    const deleteObject = vi.fn(async (_path: string) => undefined);
    await staging.cleanupExpiredUploads({
      now: new Date("2030-01-01T00:00:00.000Z"), deleteObject,
    });
    expect(deleteObject).not.toHaveBeenCalled();
  });
});