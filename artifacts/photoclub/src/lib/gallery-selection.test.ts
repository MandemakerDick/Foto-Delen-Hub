import { afterEach, describe, expect, it, vi } from "vitest";
import { readGallerySelection, rememberGallerySelection } from "./gallery-selection";

afterEach(() => vi.unstubAllGlobals());
describe("Gallery navigation snapshots", () => {
  it("isolates views and keeps ordered unique IDs even when storage is unavailable", () => {
    vi.stubGlobal("sessionStorage", { setItem: () => { throw new Error("Unavailable"); }, getItem: () => null });
    rememberGallerySelection({ path: "/photos?search=A", ids: [3, 1, 3], cursor: "24", hasMore: true });
    rememberGallerySelection({ path: "/photos?search=B", ids: [8], cursor: null, hasMore: false });
    expect(readGallerySelection("/photos?search=A")?.ids).toEqual([3, 1]);
    expect(readGallerySelection("/photos?search=B")?.ids).toEqual([8]);
  });
  it("does not use expired or corrupt storage records", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => JSON.stringify([
      { path: "/photos?expired", ids: [1], cursor: null, hasMore: false, savedAt: Date.now() - 31 * 60_000 },
      { path: "/photos?corrupt", ids: ["bad"], cursor: null, hasMore: false, savedAt: Date.now() },
    ]) });
    expect(readGallerySelection("/photos?expired")).toBeNull();
    expect(readGallerySelection("/photos?corrupt")).toBeNull();
  });
});