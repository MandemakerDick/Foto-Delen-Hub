import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Server } from "node:http";
import express from "express";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db/schema";

// Neither the live application pool nor the Replit storage client is used.
// Exercise the real route, storage service and lifecycle against disposable PG.
const fixture = vi.hoisted(() => ({
  db: null as unknown,
  objects: new Map<string, Buffer>(),
  save: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@workspace/db", async () => ({
  ...await import("@workspace/db/schema"), db: fixture.db,
}));
vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket(bucket: string) {
      if (bucket !== "import-fixture") throw new Error("Unexpected real bucket");
      return {
        file: (name: string) => ({
          save: (buffer: Buffer) => fixture.save(name, buffer),
          delete: (options: unknown) => fixture.delete(name, options),
          exists: async () => [fixture.objects.has(name)],
        }),
      };
    }
  },
}));
vi.mock("./routes/admins", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("./lib/photo-ai", () => ({ enqueuePhotoAiAnalysis: vi.fn(async () => undefined) }));
vi.mock("./lib/objectAcl", () => ({
  ObjectPermission: { READ: "read" },
  setObjectAclPolicy: vi.fn(async () => undefined),
  getObjectAclPolicy: vi.fn(),
  canAccessObject: vi.fn(),
}));

let pool: pg.Pool;
let tempDir: string;
let pgCtl: string;
let server: Server;
let baseUrl: string;
let staging: typeof import("./lib/upload-staging");
let lifecycle: typeof import("./lib/image-lifecycle");
let storage: InstanceType<typeof import("./lib/objectStorage").ObjectStorageService>;
const httpFetch = globalThis.fetch;
const future = () => new Date(Date.now() + staging.UPLOAD_STAGING_TTL_MS + 1000);
const urlFor = (path: string) => `/api/storage${path}`;
const pathForName = (name: string) => `/objects/${name.slice("private/".length)}`;
const run = (bin: string, args: string[]) => execFileSync(bin, args, { encoding: "utf8" });
const runPgCtl = (args: string[]) => execFileSync(pgCtl, args, { stdio: "ignore" });

async function reservations() {
  return (await pool.query<{ object_path: string; status: string; retry_at: Date | null }>(
    "SELECT object_path, status, retry_at FROM upload_reservation ORDER BY object_path",
  )).rows;
}

async function importImages(titles: string[], linkOnly = false) {
  const response = await httpFetch(`${baseUrl}/admins/import-from-url/import`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      photographerId: 1, linkOnly,
      images: titles.map(title => ({ title, src: "https://source.invalid/photo.jpg" })),
    }),
  });
  expect(response.status).toBe(200);
  return response.json() as Promise<{ imported: number; failed: number; photos: { imageUrl: string }[] }>;
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "pm-import-staging-pg-"));
  const binDir = dirname(run("which", ["postgres"]).trim());
  pgCtl = join(binDir, "pg_ctl");
  run(join(binDir, "initdb"), [
    "-D", join(tempDir, "data"), "-A", "trust", "-U", "postgres", "--no-instructions", "--no-sync",
  ]);
  runPgCtl(["-D", join(tempDir, "data"), "-o",
    `-k ${tempDir} -c listen_addresses='' -c fsync=off`, "-w", "start"]);
  pool = new pg.Pool({ host: tempDir, database: "postgres", user: "postgres", max: 8 });
  await pool.query(`
    CREATE TABLE upload_reservation (
      object_path text PRIMARY KEY, status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'attached', 'deleting', 'deleted')),
      expires_at timestamptz NOT NULL, retry_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE photographer (
      id serial PRIMARY KEY, name text NOT NULL, bio text, email text, avatar_url text,
      clerk_user_id text, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE photo (
      id serial PRIMARY KEY, title text NOT NULL CHECK (title <> 'Fail'), description text,
      image_url text NOT NULL, photographer_id integer REFERENCES photographer(id), club_id integer,
      theme_id integer, like_count integer NOT NULL DEFAULT 0, sort_order integer,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE club (id serial PRIMARY KEY, logo_url text);
    CREATE TABLE comment (id serial PRIMARY KEY, photo_id integer);
  `);
  fixture.db = drizzle(pool, { schema });
  // Replace the directory method, never inspect or change a real storage secret.
  const { ObjectStorageService } = await import("./lib/objectStorage");
  vi.spyOn(ObjectStorageService.prototype, "getPrivateObjectDir").mockReturnValue("/import-fixture/private");
  storage = new ObjectStorageService();
  staging = await import("./lib/upload-staging");
  lifecycle = await import("./lib/image-lifecycle");
  const router = (await import("./routes/url-import")).default;
  const app = express();
  app.use(express.json(), router);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 30000);

beforeEach(async () => {
  await pool.query("TRUNCATE upload_reservation, photo, photographer, club, comment RESTART IDENTITY CASCADE");
  await pool.query("INSERT INTO photographer (name) VALUES ('Import fixture')");
  fixture.objects.clear();
  fixture.save.mockReset();
  fixture.delete.mockReset();
  fixture.save.mockImplementation(async (name: string, buffer: Buffer) => {
    // Reservation must already be durably visible from another connection.
    expect(await reservations()).toContainEqual(expect.objectContaining({
      object_path: pathForName(name), status: "pending",
    }));
    fixture.objects.set(name, buffer);
  });
  fixture.delete.mockImplementation(async (name: string, options: unknown) => {
    expect(options).toEqual({ ignoreNotFound: true });
    fixture.objects.delete(name);
  });
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    if (input !== "https://source.invalid/photo.jpg") throw new Error("Unexpected network request");
    return new Response(Buffer.alloc(2048), { headers: { "Content-Type": "image/jpeg" } });
  }));
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  if (pool) await pool.end();
  if (pgCtl && tempDir) runPgCtl(["-D", join(tempDir, "data"), "-m", "immediate", "-w", "stop"]);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}, 30000);

describe("new URL import object staging", () => {
  it("collects failed database imports but protects successfully saved imports in the same batch", async () => {
    const result = await importImages(["Fail", "Saved"]);
    expect(result).toMatchObject({ failed: 1, imported: 1 });
    expect(fixture.objects.size).toBe(2);
    expect((await reservations()).map(row => row.status).sort()).toEqual(["attached", "pending"]);
    expect(await staging.cleanupExpiredUploads({ now: future() })).toEqual({ deleted: 1, retained: 0, failed: 0 });
    expect(fixture.objects.size).toBe(1);
    const savedPath = result.photos[0].imageUrl.replace("/api/storage/objects/", "private/");
    expect(fixture.objects.has(savedPath)).toBe(true);
    expect((await reservations()).map(row => row.status).sort()).toEqual(["attached", "deleted"]);
  });

  it("fails closed before uploading if durable reservation creation fails", async () => {
    await pool.query("ALTER TABLE upload_reservation ADD CONSTRAINT reject_import CHECK (object_path NOT LIKE '/objects/imports/%')");
    try {
      expect(await importImages(["Saved"])).toMatchObject({ failed: 1, imported: 0 });
      expect(fixture.save).not.toHaveBeenCalled();
      expect(await reservations()).toEqual([]);
    } finally {
      await pool.query("ALTER TABLE upload_reservation DROP CONSTRAINT reject_import");
    }
  });

  it("collects ambiguous storage writes and tombstones uploads that never reached storage", async () => {
    fixture.save.mockImplementationOnce(async (name: string, buffer: Buffer) => {
      fixture.objects.set(name, buffer);
      throw new Error("Storage wrote bytes but response failed");
    }).mockRejectedValueOnce(new Error("Storage unavailable before write"));
    expect(await importImages(["First", "Second"])).toMatchObject({ failed: 2, imported: 0 });
    expect(fixture.objects.size).toBe(1);
    expect((await reservations()).map(row => row.status)).toEqual(["pending", "pending"]);
    expect(await staging.cleanupExpiredUploads({ now: future() })).toEqual({ deleted: 2, retained: 0, failed: 0 });
    expect(fixture.objects.size).toBe(0);
    expect((await reservations()).map(row => row.status)).toEqual(["deleted", "deleted"]);
  });

  it("retries failed import deletion and rejects attachments during deletion and after tombstoning", async () => {
    await importImages(["Fail"]);
    const [{ object_path: path }] = await reservations();
    const now = future();
    fixture.delete.mockRejectedValueOnce(new Error("Temporary delete failure"));
    expect(await staging.cleanupExpiredUploads({ now })).toEqual({ deleted: 0, retained: 0, failed: 1 });
    const create = vi.fn(async () => "must not run");
    await expect(staging.withUploadAttachment(urlFor(path), create)).rejects.toThrow(staging.UploadUnavailableError);
    expect(create).not.toHaveBeenCalled();
    expect(await staging.cleanupExpiredUploads({ now })).toEqual({ deleted: 0, retained: 0, failed: 0 });
    expect(fixture.delete).toHaveBeenCalledTimes(1);
    expect(await staging.cleanupExpiredUploads({
      now: new Date(now.getTime() + staging.UPLOAD_CLEANUP_RETRY_MS),
    })).toEqual({ deleted: 1, retained: 0, failed: 0 });
    await expect(staging.withUploadAttachment(urlFor(path), create)).rejects.toThrow(staging.UploadUnavailableError);
    expect((await reservations())[0].status).toBe("deleted");
    expect(fixture.objects.size).toBe(0);
  });

  it("does not touch untracked legacy import objects or external link-only images", async () => {
    const legacy = "private/imports/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    fixture.objects.set(legacy, Buffer.alloc(2048));
    const [photo] = await lifecycle.withPhotographerUploadAttachment(1, "/api/storage/objects/" + legacy.slice(8),
      tx => tx.insert(schema.photosTable).values({ title: "Legacy", imageUrl: "/api/storage/objects/" + legacy.slice(8) }).returning());
    expect(photo).toBeDefined();
    expect(await importImages(["Linked"], true)).toMatchObject({ imported: 1, failed: 0 });
    expect(await reservations()).toEqual([]);
    expect(await staging.cleanupExpiredUploads({ now: future() })).toEqual({ deleted: 0, retained: 0, failed: 0 });
    expect(fixture.save).not.toHaveBeenCalled();
    expect(fixture.delete).not.toHaveBeenCalled();
    expect(fixture.objects.has(legacy)).toBe(true);
  });

  it("keeps cleanup out while a slow storage write holds its reservation lock", async () => {
    let started!: () => void;
    let finish!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { finish = resolve; });
    fixture.save.mockImplementationOnce(async (name: string, buffer: Buffer) => {
      started();
      await gate;
      fixture.objects.set(name, buffer);
    });
    const upload = storage.uploadBufferAsEntity(Buffer.alloc(2048), "image/jpeg");
    try {
      await writing;
      expect(await staging.cleanupExpiredUploads({ now: future() })).toEqual({ deleted: 0, retained: 0, failed: 0 });
      expect(fixture.delete).not.toHaveBeenCalled();
    } finally {
      finish();
    }
    await upload;
    expect(await staging.cleanupExpiredUploads({ now: future() })).toEqual({ deleted: 1, retained: 0, failed: 0 });
    expect(fixture.objects.size).toBe(0);
  });

  it("protects a concurrent transactional attachment from cleanup", async () => {
    const path = await storage.uploadBufferAsEntity(Buffer.alloc(2048), "image/jpeg");
    let started!: () => void;
    let finish!: () => void;
    const attaching = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const attachment = lifecycle.withPhotographerUploadAttachment(1, urlFor(path), async tx => {
      await tx.insert(schema.photosTable).values({ title: "Concurrent", imageUrl: urlFor(path), photographerId: 1 });
      started();
      await gate;
    });
    try {
      await attaching;
      expect(await staging.cleanupExpiredUploads({ now: future() })).toEqual({ deleted: 0, retained: 0, failed: 0 });
    } finally {
      finish();
    }
    await attachment;
    expect(await staging.cleanupExpiredUploads({ now: future() })).toEqual({ deleted: 0, retained: 0, failed: 0 });
    expect(fixture.delete).not.toHaveBeenCalled();
    expect((await reservations())[0].status).toBe("attached");
  });

  it("rejects a concurrent attachment when cleanup claimed the import first", async () => {
    await importImages(["Fail"]);
    const [{ object_path: path }] = await reservations();
    let started!: () => void;
    let finish!: () => void;
    const deleting = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { finish = resolve; });
    fixture.delete.mockImplementationOnce(async (name: string) => {
      started();
      await gate;
      fixture.objects.delete(name);
    });
    const cleanup = staging.cleanupExpiredUploads({ now: future() });
    const create = vi.fn(async (tx: import("./lib/upload-staging").UploadTransaction) =>
      tx.insert(schema.photosTable).values({ title: "Too late", imageUrl: urlFor(path) }).returning());
    try {
      await deleting;
      await expect(lifecycle.withPhotographerUploadAttachment(1, urlFor(path), create))
        .rejects.toThrow(staging.UploadUnavailableError);
      expect(create).not.toHaveBeenCalled();
      expect((await pool.query("SELECT id FROM photo")).rows).toEqual([]);
    } finally {
      finish();
    }
    expect(await cleanup).toEqual({ deleted: 1, retained: 0, failed: 0 });
    expect((await reservations())[0].status).toBe("deleted");
    expect(fixture.objects.size).toBe(0);
  });

  it("retires a tracked import after its final photo reference is released", async () => {
    const result = await importImages(["Saved"]);
    const path = result.photos[0].imageUrl.replace("/api/storage", "");
    const now = new Date();
    await staging.withUploadLifecycle({ release: [urlFor(path)] }, async tx => {
      await tx.delete(schema.photosTable);
    }, { now });
    expect((await reservations())[0].status).toBe("pending");
    expect(await staging.cleanupExpiredUploads({ now })).toEqual({ deleted: 0, retained: 0, failed: 0 });
    expect(await staging.cleanupExpiredUploads({
      now: new Date(now.getTime() + staging.UPLOAD_RECLAIM_DELAY_MS + 1),
    })).toEqual({ deleted: 1, retained: 0, failed: 0 });
    expect(fixture.objects.size).toBe(0);
  });

  it("recognizes encoded import references when protecting a previously saved file", async () => {
    const path = await storage.uploadBufferAsEntity(Buffer.alloc(2048), "image/jpeg");
    const encoded = path.replace(/.$/, char => `%${char.charCodeAt(0).toString(16)}`);
    await pool.query("INSERT INTO photo (title, image_url) VALUES ('Existing reference', $1)", [urlFor(encoded)]);
    expect(await staging.cleanupExpiredUploads({ now: future() })).toEqual({ deleted: 0, retained: 1, failed: 0 });
    expect((await reservations())[0].status).toBe("attached");
    expect(fixture.delete).not.toHaveBeenCalled();
  });
});