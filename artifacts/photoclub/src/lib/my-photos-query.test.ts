import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getListPhotosQueryKey, listPhotos } from "@workspace/api-client-react";
import { myPhotosQueryOptions, retryMyPhotos } from "./my-photos-query";

vi.mock("@workspace/api-client-react", async importOriginal => ({
  ...await importOriginal<typeof import("@workspace/api-client-react")>(),
  listPhotos: vi.fn(),
}));

const clients: QueryClient[] = [];
const photos = [{ id: 1, title: "Local fixture" }] as Awaited<ReturnType<typeof listPhotos>>;
beforeEach(() => vi.mocked(listPhotos).mockReset());
afterEach(() => clients.splice(0).forEach(client => client.clear()));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const options = myPhotosQueryOptions(42, "fixture-A:1", () => true);
  const observer = new QueryObserver(client, { ...options, enabled: false });
  observer.subscribe(() => {});
  return { client, options, observer };
}

describe("private My Photos recovery", () => {
  for (const failure of [
    new TypeError("Network unavailable"),
    Object.assign(new Error("Server unavailable"), { status: 503 }),
    Object.assign(new Error("Session expired"), { status: 401 }),
    Object.assign(new Error("Access denied"), { status: 403 }),
  ]) {
    it(`keeps ${failure.message} distinct from a successful empty list and recovers`, async () => {
      const { observer } = setup();
      vi.mocked(listPhotos).mockRejectedValueOnce(failure).mockResolvedValueOnce([]);
      await observer.refetch();
      expect(observer.getCurrentResult().isError).toBe(true);
      expect(observer.getCurrentResult().data).toBeUndefined();
      await observer.refetch();
      expect(observer.getCurrentResult().isSuccess).toBe(true);
      expect(observer.getCurrentResult().data).toEqual([]);
      expect(listPhotos).toHaveBeenCalledTimes(2);
      observer.destroy();
    });
  }

  it("retains loaded photos while refresh fails and retry is pending", async () => {
    const { observer } = setup();
    vi.mocked(listPhotos).mockResolvedValueOnce(photos).mockRejectedValueOnce(new Error("503"));
    await observer.refetch();
    await observer.refetch();
    expect(observer.getCurrentResult().isError).toBe(true);
    expect(observer.getCurrentResult().data).toBe(photos);
    let finish!: (value: typeof photos) => void;
    vi.mocked(listPhotos).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const retry = observer.refetch();
    expect(observer.getCurrentResult().isFetching).toBe(true);
    expect(observer.getCurrentResult().data).toBe(photos);
    finish(photos);
    await retry;
    expect(observer.getCurrentResult().error).toBeNull();
    observer.destroy();
  });

  it("does not fetch from an obsolete retry, including A → B → A", async () => {
    let epoch = 1;
    const captured = epoch;
    const isCurrent = () => epoch === captured;
    const refetch = vi.fn(async () => {});
    epoch = 3;
    await retryMyPhotos(isCurrent, refetch);
    expect(refetch).not.toHaveBeenCalled();
    await retryMyPhotos(() => true, refetch);
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("rejects an in-flight result after its identity becomes obsolete", async () => {
    const { client } = setup();
    let current = true;
    let finish!: (value: typeof photos) => void;
    vi.mocked(listPhotos).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const options = myPhotosQueryOptions(42, "fixture-A:1", () => current);
    const pending = client.fetchQuery(options);
    current = false;
    finish(photos);
    await expect(pending).rejects.toThrow("Obsolete photo request");
    expect(client.getQueryData(options.queryKey)).toBeUndefined();
  });

  it("keeps identity epochs separate and preserves generated mutation invalidation", async () => {
    const { client } = setup();
    const first = myPhotosQueryOptions(42, "fixture-A:1", () => true);
    const next = myPhotosQueryOptions(42, "fixture-A:3", () => true);
    client.setQueryData(first.queryKey, photos);
    expect(client.getQueryData(next.queryKey)).toBeUndefined();
    client.setQueryData(next.queryKey, []);
    await client.invalidateQueries({ queryKey: getListPhotosQueryKey({ photographerId: 42 }) });
    expect(client.getQueryState(first.queryKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(next.queryKey)?.isInvalidated).toBe(true);
  });

  it("does not start a request after identity changes", async () => {
    const { client } = setup();
    await expect(client.fetchQuery(myPhotosQueryOptions(42, "old", () => false)))
      .rejects.toThrow("Obsolete photo request");
    expect(listPhotos).not.toHaveBeenCalled();
  });
});