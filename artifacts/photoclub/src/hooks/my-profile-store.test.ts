import { afterEach, describe, expect, it, vi } from "vitest";
import { createMyProfileStore, getProfileView, ProfileLoadError, type MyProfile } from "./my-profile-store";

type PendingRequest = {
  input: RequestInfo | URL;
  init?: RequestInit;
  promise: Promise<Response>;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};

function createDeferredFetcher() {
  const requests: PendingRequest[] = [];
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    let resolve!: (response: Response) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Response>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    requests.push({ input, init, promise, resolve, reject });
    return promise;
  });

  return { fetcher: fetcher as unknown as typeof fetch, requests };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function profile(id: number, name: string): MyProfile {
  return {
    id,
    name,
    bio: null,
    avatarUrl: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    clubs: [{ id: 7, name: "Camera Club", memberSince: 2018 }],
    themes: [{ id: 11, name: "Street" }],
  };
}

async function settleAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createMyProfileStore", () => {
  it.each([401, 500, 503])("keeps an initial HTTP %s failure unknown until a successful retry", async (status) => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);
    store.setIdentity("fixture-account");
    requests[0].resolve(response({ error: "fixture failure" }, status));
    await settleAsyncWork();
    const failed = store.getSnapshot();
    expect(failed.profile).toBeUndefined();
    expect(failed.loading).toBe(false);
    expect(failed.error).toBeInstanceOf(ProfileLoadError);
    expect((failed.error as ProfileLoadError).status).toBe(status);

    const retry = store.refresh("fixture-account", failed.identityRevision);
    expect(store.getSnapshot()).toMatchObject({ profile: undefined, loading: true, error: null });
    requests[1].resolve(response(profile(42, "Recovered fixture")));
    await retry;
    expect(store.getSnapshot()).toMatchObject({ profile: { id: 42 }, loading: false, error: null });
  });

  it("does not turn an initial network failure into a confirmed missing profile", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);
    store.setIdentity("fixture-account");
    requests[0].reject(new TypeError("Fixture network unavailable"));
    await settleAsyncWork();
    expect(store.getSnapshot()).toMatchObject({ profile: undefined, loading: false });
    expect(store.getSnapshot().error).toBeInstanceOf(TypeError);
    const retry = store.refresh("fixture-account", store.getSnapshot().identityRevision);
    requests[1].resolve(response({ error: "No linked profile" }, 404));
    await retry;
    expect(store.getSnapshot()).toMatchObject({ profile: null, loading: false, error: null });
  });

  it.each([401, 500])("preserves the exact loaded profile during a failed HTTP %s refresh", async (status) => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);
    store.setIdentity("fixture-account");
    requests[0].resolve(response(profile(42, "Loaded fixture")));
    await settleAsyncWork();
    const loaded = store.getSnapshot().profile;
    const retry = store.refresh("fixture-account", store.getSnapshot().identityRevision);
    expect(store.getSnapshot()).toMatchObject({ loading: false, error: null });
    expect(store.getSnapshot().profile).toBe(loaded);
    requests[1].resolve(response({ error: "Fixture refresh failure" }, status));
    await retry;
    expect(store.getSnapshot().profile).toBe(loaded);
    expect(store.getSnapshot().loading).toBe(false);
    expect((store.getSnapshot().error as ProfileLoadError).status).toBe(status);
  });

  it("rejects a failed screen's retry callback after the identity changes", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);
    store.setIdentity("fixture-A");
    requests[0].resolve(response({}, 500));
    await settleAsyncWork();
    const oldRevision = store.getSnapshot().identityRevision;
    store.setIdentity("fixture-B");
    await store.refresh("fixture-A", oldRevision);
    expect(requests).toHaveLength(2);
    requests[1].resolve(response(profile(43, "Account B fixture")));
    await settleAsyncWork();
    expect(store.getSnapshot()).toMatchObject({ userId: "fixture-B", profile: { id: 43 }, error: null });
  });

  it("starts unloaded, does not fetch until signed in, and keeps stores isolated", () => {
    const firstFetcher = createDeferredFetcher();
    const secondFetcher = createDeferredFetcher();
    const firstStore = createMyProfileStore(firstFetcher.fetcher);
    const secondStore = createMyProfileStore(secondFetcher.fetcher);

    expect(firstStore.getSnapshot()).toMatchObject({
      userId: undefined,
      profile: undefined,
      loading: true,
      error: null,
    });
    expect(firstFetcher.requests).toHaveLength(0);

    firstStore.setIdentity(null);
    expect(firstStore.getSnapshot()).toMatchObject({
      userId: null,
      profile: null,
      loading: false,
      error: null,
    });
    expect(firstFetcher.requests).toHaveLength(0);
    expect(secondStore.getSnapshot().userId).toBeUndefined();
    expect(secondFetcher.requests).toHaveLength(0);
  });

  it("fetches /api/me with credentials, no-store, and an abort signal", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("A");

    expect(requests).toHaveLength(1);
    expect(requests[0].input).toBe("/api/me");
    expect(requests[0].init).toMatchObject({
      credentials: "include",
      cache: "no-store",
    });
    expect(requests[0].init?.signal).toBeInstanceOf(AbortSignal);

    requests[0].resolve(response(profile(1, "Account A")));
    await settleAsyncWork();
    expect(store.getSnapshot().profile).toEqual(profile(1, "Account A"));
  });

  it("deduplicates repeated identity sets and notifies multiple subscribers", () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribeFirst = store.subscribe(firstListener);
    const unsubscribeSecond = store.subscribe(secondListener);

    store.setIdentity("A");
    store.setIdentity("A");

    expect(requests).toHaveLength(1);
    expect(firstListener).toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalled();

    unsubscribeFirst();
    const firstCallsAfterUnsubscribe = firstListener.mock.calls.length;
    store.setIdentity(null);
    expect(firstListener).toHaveBeenCalledTimes(firstCallsAfterUnsubscribe);
    expect(secondListener).toHaveBeenCalled();
    unsubscribeSecond();
  });

  it("advances identity epochs without fetching on public-route auth transitions", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("A");
    requests[0].resolve(response(profile(1, "Initial A")));
    await settleAsyncWork();
    const oldARevision = store.getSnapshot().identityRevision;

    // The always-mounted Clerk listener updates identity even while no
    // profile consumer is mounted on a public route.
    store.setIdentity("B", false);
    store.setIdentity("A", false);
    expect(requests).toHaveLength(1);
    expect(store.getSnapshot()).toMatchObject({
      userId: "A",
      profile: undefined,
      loading: true,
    });

    await store.refresh("A", oldARevision);
    store.updateProfile("A", oldARevision, { name: "Stale A callback" });
    expect(requests).toHaveLength(1);

    // The next consumer mount sets the current identity with fetching enabled.
    store.setIdentity("A");
    expect(requests).toHaveLength(2);
    requests[1].resolve(response(profile(1, "Fresh A")));
    await settleAsyncWork();

    await store.refresh("A", oldARevision);
    store.updateProfile("A", oldARevision, { name: "Stale A callback" });
    expect(requests).toHaveLength(2);
    expect(store.getSnapshot().profile?.name).toBe("Fresh A");
  });

  it("clears A on sign-out and prevents A's late response from replacing B", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("A");
    const requestA = requests[0];
    store.setIdentity(null);
    expect(store.getSnapshot()).toMatchObject({ userId: null, profile: null, loading: false });
    store.setIdentity("B");
    const requestB = requests[1];

    requestB.resolve(response(profile(2, "Account B")));
    await settleAsyncWork();
    requestA.resolve(response(profile(1, "Account A")));
    await settleAsyncWork();

    expect(store.getSnapshot()).toMatchObject({
      userId: "B",
      profile: profile(2, "Account B"),
      loading: false,
    });
  });

  it("ignores both late successful and failed requests after a direct A-to-B switch", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("A");
    store.setIdentity("B");
    requests[1].resolve(response(profile(2, "Account B")));
    await settleAsyncWork();

    requests[0].reject(new Error("A request failed late"));
    await settleAsyncWork();

    expect(store.getSnapshot()).toMatchObject({
      userId: "B",
      profile: profile(2, "Account B"),
      loading: false,
      error: null,
    });
  });

  it("keeps a loaded profile visible without a loading transition during refresh", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("A");
    requests[0].resolve(response(profile(1, "Account A")));
    await settleAsyncWork();
    const revision = store.getSnapshot().identityRevision;

    const refresh = store.refresh("A", revision);

    expect(requests).toHaveLength(2);
    expect(store.getSnapshot()).toMatchObject({
      profile: profile(1, "Account A"),
      loading: false,
      error: null,
    });
    requests[1].resolve(response(profile(1, "Account A updated")));
    await refresh;
    expect(store.getSnapshot().profile?.name).toBe("Account A updated");
  });

  it("ignores callbacks captured for A after switching to B and across an A-to-B-to-A epoch", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("A");
    const firstARevision = store.getSnapshot().identityRevision;
    requests[0].resolve(response(profile(1, "First A")));
    await settleAsyncWork();

    store.setIdentity("B");
    const bRevision = store.getSnapshot().identityRevision;
    requests[1].resolve(response(profile(2, "B")));
    await settleAsyncWork();
    const beforeStaleCallbacks = requests.length;

    await store.refresh("A", firstARevision);
    store.updateProfile("A", firstARevision, { name: "Stale A update" });
    expect(requests).toHaveLength(beforeStaleCallbacks);
    expect(store.getSnapshot().profile?.name).toBe("B");

    store.setIdentity("A");
    expect(store.getSnapshot().identityRevision).not.toBe(firstARevision);
    requests[2].resolve(response(profile(1, "Second A")));
    await settleAsyncWork();

    await store.refresh("A", firstARevision);
    store.updateProfile("A", firstARevision, { name: "Stale ABA update" });
    expect(store.getSnapshot()).toMatchObject({
      userId: "A",
      profile: profile(1, "Second A"),
    });
    expect(store.getSnapshot().identityRevision).not.toBe(bRevision);
  });

  it("aborts an older in-flight refresh when a profile update arrives", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("A");
    requests[0].resolve(response(profile(1, "Account A")));
    await settleAsyncWork();
    const revision = store.getSnapshot().identityRevision;

    const oldRefresh = store.refresh("A", revision);
    const staleResponse = requests[1];
    store.updateProfile("A", revision, { name: "Saved name", themes: [{ id: 12, name: "Saved theme" }] });

    expect(staleResponse.init?.signal?.aborted).toBe(true);
    expect(store.getSnapshot().profile).toMatchObject({
      name: "Saved name",
      themes: [{ id: 12, name: "Saved theme" }],
    });

    staleResponse.resolve(response(profile(1, "Stale server response")));
    await oldRefresh;
    expect(store.getSnapshot().profile?.name).toBe("Saved name");
  });

  it("keeps a 404 as a distinct null result and retries only after explicit refresh", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("A");
    requests[0].resolve(response({ message: "No linked profile" }, 404));
    await settleAsyncWork();

    expect(store.getSnapshot()).toMatchObject({
      userId: "A",
      profile: null,
      loading: false,
      error: null,
    });

    store.setIdentity("A");
    expect(requests).toHaveLength(1);

    const revision = store.getSnapshot().identityRevision;
    const refresh = store.refresh("A", revision);
    expect(requests).toHaveLength(2);
    requests[1].resolve(response(profile(1, "Created profile")));
    await refresh;
    expect(store.getSnapshot().profile).toEqual(profile(1, "Created profile"));
  });

  it("retries a failed load when the same identity is set again", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("sameuser");
    requests[0].resolve(response({ message: "Temporary failure" }, 500));
    await settleAsyncWork();
    expect(store.getSnapshot().error).toBeInstanceOf(Error);
    expect(store.getSnapshot()).toMatchObject({
      userId: "sameuser",
      profile: undefined,
      loading: false,
    });

    store.setIdentity("sameuser");
    expect(requests).toHaveLength(2);
    requests[1].resolve(response(profile(3, "Recovered profile")));
    await settleAsyncWork();
    expect(store.getSnapshot().profile).toEqual(profile(3, "Recovered profile"));
  });

  it("masks stale identity data synchronously in getProfileView", async () => {
    const { fetcher, requests } = createDeferredFetcher();
    const store = createMyProfileStore(fetcher);

    store.setIdentity("A");
    requests[0].resolve(response(profile(1, "Account A")));
    await settleAsyncWork();

    expect(getProfileView(store.getSnapshot(), "B")).toEqual({
      profile: undefined,
      loading: true,
      error: null,
    });
    expect(getProfileView(store.getSnapshot(), null)).toEqual({
      profile: null,
      loading: false,
      error: null,
    });
    expect(getProfileView(store.getSnapshot(), undefined)).toEqual({
      profile: undefined,
      loading: true,
      error: null,
    });
    expect(requests).toHaveLength(1);
  });
});