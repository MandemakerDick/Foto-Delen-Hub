import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getFixture, resetFixture, startFixture } from "./test/authorization-fixture";

const fixture = getFixture();

let http: Awaited<ReturnType<typeof startFixture>>;
beforeAll(async () => { http = await startFixture(); });
afterAll(async () => { await http?.close(); });
beforeEach(resetFixture);

const upload = { name: "portrait.jpg", size: 1024, contentType: "image/jpeg" };

describe("authenticated authorization over HTTP", () => {
  it("rejects anonymous profile creation, edits, invites and upload URLs without mutating anything", async () => {
    expect((await http.request("POST", "/photographers", { name: "New" })).status).toBe(401);
    expect((await http.request("PATCH", "/photographers/1", { name: "Changed" })).status).toBe(401);
    expect((await http.request("POST", "/invites", { label: "New" })).status).toBe(401);
    expect((await http.request("POST", "/storage/uploads/request-url", upload)).status).toBe(401);
    expect(fixture.photographers.map((p) => p.name)).toEqual(["Owner", "Unclaimed"]);
    expect(fixture.invites).toHaveLength(1);
    expect(fixture.uploadCalls).toBe(0);
  });

  it("allows a linked owner to edit their profile and request an upload URL, but not create admin records", async () => {
    fixture.userId = "owner";
    const edited = await http.request("PATCH", "/photographers/1", { name: "Updated owner", bio: "Hello" });
    expect(edited.status).toBe(200);
    expect(edited.body.name).toBe("Updated owner");
    expect(fixture.photographers[0]).toMatchObject({ name: "Updated owner", bio: "Hello", clerkUserId: "owner" });
    expect((await http.request("POST", "/storage/uploads/request-url", upload)).body).toMatchObject({
      uploadURL: "https://uploads.example.test/objects/new",
      objectPath: "/objects/uploads/00000000-0000-4000-8000-000000000001",
    });
    expect(fixture.uploadCalls).toBe(1);
    expect((await http.request("POST", "/photographers", { name: "Forbidden" })).status).toBe(401);
    expect((await http.request("POST", "/invites", { label: "Forbidden" })).status).toBe(401);
  });

  it("does not let another signed-in user change someone else's profile or claim ownership through PATCH", async () => {
    fixture.userId = "stranger";
    expect((await http.request("PATCH", "/photographers/1", {
      name: "Stolen", clerkUserId: "stranger",
    })).status).toBe(401);
    expect(fixture.photographers[0]).toMatchObject({ name: "Owner", clerkUserId: "owner" });
    expect((await http.request("POST", "/storage/uploads/request-url", upload)).status).toBe(401);
    fixture.userId = "owner";
    const response = await http.request("PATCH", "/photographers/1", { clerkUserId: "stranger", bio: "Safe" });
    expect(response.status).toBe(200);
    expect(fixture.photographers[0]).toMatchObject({ clerkUserId: "owner", bio: "Safe" });
  });

  it("lets a verified admin create and edit profiles and issue upload URLs and invites", async () => {
    fixture.userId = "admin";
    const created = await http.request("POST", "/photographers", { name: "New photographer" });
    expect(created.status).toBe(201);
    expect(fixture.photographers[2].name).toBe("New photographer");
    expect((await http.request("PATCH", "/photographers/1", { name: "Admin edit" })).status).toBe(200);
    expect(fixture.photographers[0].name).toBe("Admin edit");
    expect((await http.request("POST", "/storage/uploads/request-url", upload)).status).toBe(200);
    expect((await http.request("POST", "/invites", { label: "Welcome", photographerId: 2, maxUses: 1 })).status).toBe(201);
    expect(fixture.invites[1]).toMatchObject({ photographerId: 2, maxUses: 1, useCount: 0 });
  });

  it("keeps club reads public while denying anonymous and member club writes", async () => {
    const list = await http.request("GET", "/clubs");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: 1, name: "Public club" });
    expect((await http.request("GET", "/clubs/1")).status).toBe(200);

    expect((await http.request("POST", "/clubs", { name: "Anonymous club" })).status).toBe(401);
    expect((await http.request("PUT", "/clubs/1", { name: "Anonymous edit" })).status).toBe(401);
    fixture.userId = "owner";
    expect((await http.request("POST", "/clubs", { name: "Member club" })).status).toBe(401);
    expect((await http.request("PUT", "/clubs/1", { name: "Member edit" })).status).toBe(401);
    expect(fixture.clubRecords).toHaveLength(1);
    expect(fixture.clubRecords[0].name).toBe("Public club");
  });

  it("allows verified Clerk admins and session admins to create and update clubs", async () => {
    fixture.userId = "admin";
    const created = await http.request("POST", "/clubs", { name: "Admin-created club" });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Admin-created club");
    const edited = await http.request("PUT", "/clubs/2", { name: "Clerk admin edit" });
    expect(edited.status).toBe(200);
    expect(fixture.clubRecords[1].name).toBe("Clerk admin edit");

    fixture.userId = null;
    fixture.sessionAdminId = 1;
    const sessionEdited = await http.request("PUT", "/clubs/1", { name: "Session admin edit" });
    expect(sessionEdited.status).toBe(200);
    expect(fixture.clubRecords[0].name).toBe("Session admin edit");
  });
});

describe("one-use prelinked invite transaction over HTTP", () => {
  it("commits the link and use count together, then refuses a second claim", async () => {
    fixture.userId = "new-owner";
    const claimed = await http.request("POST", "/invites/redeem", { token: "one-use" });
    expect(claimed).toMatchObject({ status: 200, body: { ok: true, linked: true, photographerId: 2 } });
    expect(fixture.photographers[1].clerkUserId).toBe("new-owner");
    expect(fixture.invites[0].useCount).toBe(1);
    fixture.userId = "other-owner";
    expect((await http.request("POST", "/invites/redeem", { token: "one-use" })).status).toBe(400);
    expect(fixture.photographers[1].clerkUserId).toBe("new-owner");
    expect(fixture.invites[0].useCount).toBe(1);
  });

  it("rolls back a profile link if writing the invite use count fails", async () => {
    fixture.userId = "new-owner";
    fixture.failInviteUpdate = true;
    expect((await http.request("POST", "/invites/redeem", { token: "one-use" })).status).toBe(500);
    expect(fixture.photographers[1].clerkUserId).toBeNull();
    expect(fixture.invites[0].useCount).toBe(0);
  });

  it("does not consume a token when the account or target profile belongs to someone else", async () => {
    fixture.userId = "owner";
    expect((await http.request("POST", "/invites/redeem", { token: "one-use" })).status).toBe(409);
    expect(fixture.invites[0].useCount).toBe(0);
    fixture.userId = "stranger";
    fixture.photographers[1].clerkUserId = "somebody-else";
    expect((await http.request("POST", "/invites/redeem", { token: "one-use" })).status).toBe(409);
    expect(fixture.invites[0].useCount).toBe(0);
    expect(fixture.photographers[1].clerkUserId).toBe("somebody-else");
  });
});