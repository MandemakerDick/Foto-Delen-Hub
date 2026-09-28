import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import express from "express";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db/schema";

// Never import @workspace/db's live Pool. This test boots a disposable,
// socket-only PostgreSQL cluster, with no network listener or shared records.
const fixture = vi.hoisted(() => ({
  db: null as unknown,
  sessions: new Map<string, { inviteGranted?: boolean; invitePhotographerId?: number; inviteTokenId?: number }>(),
}));
vi.mock("@workspace/db", async () => ({
  ...await import("@workspace/db/schema"),
  db: fixture.db,
}));
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: { authorization?: string; cookie?: string } }) => ({
    userId: req.headers.authorization?.match(/^Bearer (claimant-[a-d])$/)?.[1]
      ?? req.headers.cookie?.match(/(?:^|;\s*)fixture-user=(claimant-[e-f])(?:;|$)/)?.[1] ?? null,
  }),
}));
vi.mock("./routes/admins", () => ({ requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("./lib/email", () => ({ sendEmail: vi.fn() }));

let tempDir: string;
let pgCtl: string;
let pool: pg.Pool;
let server: Server;
let baseUrl: string;

const run = (bin: string, args: string[]) => execFileSync(bin, args, { encoding: "utf8", stdio: "pipe" });
// pg_ctl starts a daemon that inherits its stdio; piping it to execFileSync
// leaves the pipe open and prevents the parent process from returning.
const runPgCtl = (args: string[]) => execFileSync(pgCtl, args, { stdio: "ignore" });

async function waitForTwoBlockedClaims(table: "invite_token" | "photographer") {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
         AND wait_event_type = 'Lock'
         AND query ILIKE $1`, [`%${table}%`],
    );
    if (Number(rows[0].count) >= 2) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  const { rows } = await pool.query<{
    state: string; wait_event_type: string | null; query: string;
  }>(`SELECT state, wait_event_type, query FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()`);
  throw new Error(`Both HTTP claims did not reach PostgreSQL's row-lock wait: ${JSON.stringify(
    rows.map((row) => ({ state: row.state, wait: row.wait_event_type, query: row.query.slice(0, 220) })),
  )}`);
}

async function redeem(token: string, claimant: "claimant-a" | "claimant-b" | "claimant-c" | "claimant-d") {
  const response = await fetch(`${baseUrl}/api/invites/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${claimant}` },
    body: JSON.stringify({ token }),
  });
  const result = { status: response.status, body: await response.json() as { linked?: boolean; error?: string } };
  return result;
}

async function link(photographerId: number, claimant: "claimant-e" | "claimant-f") {
  const response = await fetch(`${baseUrl}/api/me/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `fixture-user=${claimant}` },
    body: JSON.stringify({ photographerId }),
  });
  return { status: response.status, body: await response.json() as { clerkUserId?: string; error?: string } };
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "pm-invite-pg-"));
  // Replit exposes postgres on PATH; its sibling tools are from the same build.
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
    CREATE TABLE photographer (
      id serial PRIMARY KEY, name text NOT NULL, bio text, email text,
      avatar_url text, clerk_user_id text, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE invite_token (
      id serial PRIMARY KEY, token text NOT NULL UNIQUE, label text NOT NULL DEFAULT '',
      created_by_admin_id integer, photographer_id integer REFERENCES photographer(id),
      max_uses integer, use_count integer NOT NULL DEFAULT 0,
      expires_at timestamp, revoked boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE club (id serial PRIMARY KEY, name text NOT NULL);
    CREATE TABLE theme (id serial PRIMARY KEY, name text NOT NULL);
    CREATE TABLE photographer_club (
      photographer_id integer NOT NULL, club_id integer NOT NULL, member_since integer
    );
    CREATE TABLE photographer_theme (photographer_id integer NOT NULL, theme_id integer NOT NULL);
  `);
  fixture.db = drizzle(pool, { schema });
  const [{ default: invites }, { default: auth }] = await Promise.all([
    import("./routes/invites"), import("./routes/auth"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const browserUser = req.headers.cookie?.match(/(?:^|;\s*)fixture-user=(claimant-[e-f])(?:;|$)/)?.[1];
    (req as any).session = browserUser ? fixture.sessions.get(browserUser) : {};
    next();
  });
  app.use("/api", invites, auth);
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server has no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 30000);

afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (pool) await pool.end();
  if (pgCtl && tempDir) runPgCtl(["-D", join(tempDir, "data"), "-m", "immediate", "-w", "stop"]);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}, 30000);

describe("concurrent authenticated invite redemption with real PostgreSQL locks", () => {
  it("lets only one claimant consume and link a single-use invitation", async () => {
    const { rows: [profile] } = await pool.query<{ id: number }>(
      "INSERT INTO photographer (name) VALUES ('Concurrency fixture') RETURNING id",
    );
    await pool.query(
      "INSERT INTO invite_token (token, photographer_id, max_uses) VALUES ($1, $2, 1)",
      ["single-use-concurrent", profile.id],
    );

    // Hold the invite row while both HTTP requests begin; releasing it makes
    // PostgreSQL serialize both competing transactions rather than relying
    // on a lucky request scheduling order.
    const blocker = await pool.connect();
    let first: ReturnType<typeof redeem> | undefined;
    let second: ReturnType<typeof redeem> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM invite_token WHERE token = $1 FOR UPDATE", ["single-use-concurrent"]);
      first = redeem("single-use-concurrent", "claimant-a");
      second = redeem("single-use-concurrent", "claimant-b");
      await waitForTwoBlockedClaims("invite_token");
    } finally {
      await blocker.query("COMMIT");
      blocker.release();
    }
    const responses = await Promise.all([first!, second!]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(responses.find((r) => r.status === 200)?.body.linked).toBe(true);
    expect(responses.find((r) => r.status !== 200)?.body.error).toMatch(/usage limit/i);

    const { rows: [result] } = await pool.query<{ clerk_user_id: string; use_count: number }>(
      `SELECT p.clerk_user_id, i.use_count FROM photographer p
       JOIN invite_token i ON i.photographer_id = p.id WHERE i.token = $1`,
      ["single-use-concurrent"],
    );
    expect(result.use_count).toBe(1);
    expect(result.clerk_user_id).toBe(
      responses[0].status === 200 ? "claimant-a" : "claimant-b",
    );
  }, 15000);

  it("does not let separate valid tokens claim the same profile twice", async () => {
    const { rows: [profile] } = await pool.query<{ id: number }>(
      "INSERT INTO photographer (name) VALUES ('Shared profile fixture') RETURNING id",
    );
    await pool.query(
      "INSERT INTO invite_token (token, photographer_id, max_uses) VALUES ($1, $3, 1), ($2, $3, 1)",
      ["grant-a", "grant-b", profile.id],
    );
    const blocker = await pool.connect();
    let first: ReturnType<typeof redeem> | undefined;
    let second: ReturnType<typeof redeem> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM photographer WHERE id = $1 FOR UPDATE", [profile.id]);
      first = redeem("grant-a", "claimant-c");
      second = redeem("grant-b", "claimant-d");
      await waitForTwoBlockedClaims("photographer");
    } finally {
      await blocker.query("COMMIT");
      blocker.release();
    }
    const responses = await Promise.all([first!, second!]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(responses.find((r) => r.status === 409)?.body.error).toMatch(/already claimed/i);
    const { rows: [owner] } = await pool.query<{ clerk_user_id: string }>(
      "SELECT clerk_user_id FROM photographer WHERE id = $1", [profile.id],
    );
    expect(owner.clerk_user_id).toBe(responses[0].status === 200 ? "claimant-c" : "claimant-d");
    const { rows: invites } = await pool.query<{ token: string; use_count: number }>(
      "SELECT token, use_count FROM invite_token WHERE photographer_id = $1 ORDER BY token", [profile.id],
    );
    expect(invites.map((i) => i.use_count).sort()).toEqual([0, 1]);
    expect(invites.find((i) => i.use_count === 1)?.token).toBe(responses[0].status === 200 ? "grant-a" : "grant-b");
  }, 15000);
});

describe("concurrent browser profile linking with two valid session grants", () => {
  it("keeps the first owner and only consumes the winning browser grant", async () => {
    const { rows: [profile] } = await pool.query<{ id: number }>(
      "INSERT INTO photographer (name) VALUES ('Browser claim fixture') RETURNING id",
    );
    fixture.sessions.set("claimant-e", { inviteGranted: true, invitePhotographerId: profile.id, inviteTokenId: 101 });
    fixture.sessions.set("claimant-f", { inviteGranted: true, invitePhotographerId: profile.id, inviteTokenId: 102 });
    const blocker = await pool.connect();
    let first: ReturnType<typeof link> | undefined;
    let second: ReturnType<typeof link> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM photographer WHERE id = $1 FOR UPDATE", [profile.id]);
      first = link(profile.id, "claimant-e");
      second = link(profile.id, "claimant-f");
      await waitForTwoBlockedClaims("photographer");
    } finally {
      await blocker.query("COMMIT");
      blocker.release();
    }
    const responses = await Promise.all([first!, second!]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(responses.find((r) => r.status === 409)?.body.error).toMatch(/already claimed/i);
    const winner = responses[0].status === 200 ? "claimant-e" : "claimant-f";
    const loser = winner === "claimant-e" ? "claimant-f" : "claimant-e";
    expect(responses.find((r) => r.status === 200)?.body.clerkUserId).toBe(winner);
    const { rows: [owner] } = await pool.query<{ clerk_user_id: string }>(
      "SELECT clerk_user_id FROM photographer WHERE id = $1", [profile.id],
    );
    expect(owner.clerk_user_id).toBe(winner);
    expect(fixture.sessions.get(winner)).toEqual({});
    expect(fixture.sessions.get(loser)).toMatchObject({
      inviteGranted: true, invitePhotographerId: profile.id,
    });
    expect((await link(profile.id, loser)).status).toBe(409);
    expect(fixture.sessions.get(loser)?.inviteGranted).toBe(true);
  }, 15000);
});