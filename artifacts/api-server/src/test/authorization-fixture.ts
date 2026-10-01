import { vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { once } from "node:events";

type Row = Record<string, any>;
type TableName = "photographers" | "admins" | "invites" | "clubs" | "themes" | "uploadReservations";
type Condition = (row: Row) => boolean;

const fixture = vi.hoisted(() => {
  const state = {
    photographers: [] as Row[],
    admins: [] as Row[],
    invites: [] as Row[],
    clubs: [] as Row[],
    themes: [] as Row[],
    uploadReservations: [] as Row[],
    userId: null as string | null,
    failInviteUpdate: false,
    uploadCalls: 0,
  };
  return state;
});
export function getFixture() { return fixture; }

const column = (table: TableName, field: string) => `${table}.${field}`;
const table = (name: TableName, fields: string[]) =>
  Object.fromEntries(fields.map((field) => [field, column(name, field)]));
const tables = {
  photographersTable: table("photographers", ["id", "name", "bio", "email", "avatarUrl", "clerkUserId", "createdAt"]),
  photosTable: table("photographers", ["id", "photographerId"]),
  themesTable: table("themes", ["id", "name"]),
  photographerClubsTable: table("clubs", ["photographerId", "clubId", "memberSince"]),
  photographerThemesTable: table("themes", ["photographerId", "themeId"]),
  photographerFollowsTable: table("photographers", ["photographerId", "clerkUserId"]),
  adminsTable: table("admins", ["id", "clerkUserId", "email"]),
  inviteTokensTable: table("invites", ["id", "token", "photographerId", "maxUses", "useCount", "expiresAt", "revoked", "createdAt"]),
  uploadReservationsTable: table("uploadReservations", ["objectPath", "status", "expiresAt", "retryAt", "createdAt"]),
};

function field(row: Row, key: string) {
  return row[key.split(".")[1]];
}

vi.mock("drizzle-orm", () => ({
  eq: (key: string, value: unknown): Condition => (row: Row) => field(row, key) === value,
  isNull: (key: string): Condition => (row: Row) => field(row, key) == null,
  and: (...checks: Condition[]): Condition => (row: Row) => checks.every((check) => check(row)),
  or: (...checks: Condition[]): Condition => (row: Row) => checks.some((check) => check(row)),
  lte: (key: string, value: unknown): Condition => (row: Row) =>
    new Date(field(row, key)).getTime() <= new Date(value as Date).getTime(),
  like: (key: string, pattern: string): Condition => (row: Row) => {
    const needle = pattern.replace(/^%|%$/g, "");
    return String(field(row, key) ?? "").includes(needle);
  },
  sql: Object.assign(
    (parts: TemplateStringsArray, ...values: unknown[]): Condition =>
      (row: Row) => parts.join("").includes(" < ") ? Number(field(row, values[0] as string)) < Number(field(row, values[1] as string)) : true,
    { raw: () => () => true },
  ),
  count: () => "count",
  ilike: () => () => true,
  exists: () => () => true,
}));

function nameOf(tableRef: Row): TableName {
  if (tableRef === tables.photographersTable) return "photographers";
  if (tableRef === tables.adminsTable) return "admins";
  if (tableRef === tables.inviteTokensTable) return "invites";
  if (tableRef === tables.photographerClubsTable) return "clubs";
  if (tableRef === tables.photographerThemesTable) return "themes";
  if (tableRef === tables.uploadReservationsTable) return "uploadReservations";
  throw new Error("Unexpected table in authorization fixture");
}

function database() {
  const select = (selection?: Row) => {
    let name: TableName;
    let predicate: Condition = () => true;
    const result = () => fixture[name].filter(predicate).map((row) => {
      if (!selection) return { ...row };
      return Object.fromEntries(Object.entries(selection).map(([key, value]) => {
        if (key === "clubs" || key === "themes") return [key, []];
        if (key === "claimed") return [key, row.clerkUserId != null];
        if (key === "photoCount") return [key, 0];
        return [key, typeof value === "string" && value.includes(".") ? field(row, value) : value];
      }));
    });
    const query = {
      from: (ref: Row) => { name = nameOf(ref); return query; },
      leftJoin: () => query,
      where: (condition: Condition) => { predicate = condition ?? (() => true); return query; },
      groupBy: () => query,
      orderBy: () => query,
      limit: () => query,
      for: () => query,
      then: (resolve: (rows: Row[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  };
  const update = (ref: Row) => {
    const name = nameOf(ref);
    let values: Row;
    let changed: Row[];
    const query = {
      set: (next: Row) => { values = next; return query; },
      where: (condition: Condition) => {
        if (name === "invites" && fixture.failInviteUpdate) throw new Error("Simulated invite write failure");
        changed = fixture[name].filter(condition);
        for (const row of changed) Object.assign(row, values);
        return query;
      },
      returning: (selection?: Row) => Promise.resolve(changed.map((row) =>
        selection ? Object.fromEntries(Object.entries(selection).map(([key, value]) => [key, field(row, value as string)])) : { ...row },
      )),
      then: (resolve: (rows: Row[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(changed).then(resolve, reject),
    };
    return query;
  };
  const insert = (ref: Row) => ({
    values: (values: Row | Row[]) => {
      const name = nameOf(ref);
      const rows = (Array.isArray(values) ? values : [values]).map((value) => {
        const row = {
          id: fixture[name].length + 1, createdAt: new Date(),
          ...(name === "uploadReservations" ? { status: "pending" } : {}),
          ...value,
        };
        fixture[name].push(row);
        return row;
      });
      const builder = {
        onConflictDoNothing: () => ({ returning: () => Promise.resolve(rows) }),
        returning: () => Promise.resolve(rows),
        then: (resolve: (rows: Row[]) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return builder;
    },
  });
  const remove = (ref: Row) => ({
    where: (condition: Condition) => {
      const name = nameOf(ref);
      fixture[name] = fixture[name].filter((row) => !condition(row));
      return Promise.resolve([]);
    },
  });
  return {
    select, update, insert, delete: remove,
    transaction: async <T>(callback: (tx: ReturnType<typeof database>) => Promise<T>) => {
      const snapshot = structuredClone({
        photographers: fixture.photographers, admins: fixture.admins, invites: fixture.invites,
        clubs: fixture.clubs, themes: fixture.themes, uploadReservations: fixture.uploadReservations,
      });
      try { return await callback(database()); }
      catch (error) {
        Object.assign(fixture, snapshot);
        throw error;
      }
    },
  };
}

vi.mock("@workspace/db", () => ({ db: database(), ...tables }));
vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: fixture.userId }),
  clerkClient: { users: { getUser: async () => ({ emailAddresses: [] }) } },
}));
vi.mock("../routes/auth", () => ({ requireAuth: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    async getObjectEntityUploadURL() { fixture.uploadCalls++; return "https://uploads.example.test/objects/new"; }
    normalizeObjectEntityPath() { return "/objects/uploads/00000000-0000-4000-8000-000000000001"; }
  },
  ObjectNotFoundError: class extends Error {},
}));

export function resetFixture() {
  fixture.photographers = [{
    id: 1, name: "Owner", bio: null, email: null, avatarUrl: null,
    clerkUserId: "owner", createdAt: new Date("2026-01-01"),
  }, {
    id: 2, name: "Unclaimed", bio: null, email: null, avatarUrl: null,
    clerkUserId: null, createdAt: new Date("2026-01-01"),
  }];
  fixture.admins = [{ id: 1, clerkUserId: "admin", email: null }];
  fixture.invites = [{
    id: 1, token: "one-use", photographerId: 2, maxUses: 1, useCount: 0,
    expiresAt: null, revoked: false, createdAt: new Date("2026-01-01"),
  }];
  fixture.clubs = [];
  fixture.themes = [];
  fixture.uploadReservations = [];
  fixture.userId = null;
  fixture.failInviteUpdate = false;
  fixture.uploadCalls = 0;
}

export async function startFixture() {
  const [{ default: photographers }, { default: storage }, { default: invites }] = await Promise.all([
    import("../routes/photographers"), import("../routes/storage"), import("../routes/invites"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = {};
    (req as any).log = { warn() {}, error() {} };
    next();
  });
  app.use("/api", photographers, storage, invites);
  const server: Server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not bind a TCP port");
  return {
    request: async (method: string, path: string, body?: Row) => {
      const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      return {
        status: response.status,
        body: text && response.headers.get("content-type")?.includes("application/json")
          ? JSON.parse(text) as Row
          : null,
      };
    },
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}