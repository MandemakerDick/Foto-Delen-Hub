import { describe, expect, it } from "vitest";
import {
  galleryCursor,
  parseGalleryCursor,
  parseGalleryIds,
  type GalleryQuery,
} from "./routes/photos";

function query(overrides: Partial<GalleryQuery> = {}): GalleryQuery {
  return {
    group: "none",
    sort: "newest",
    limit: 24,
    ...overrides,
  };
}

describe("Gallery pagination helpers", () => {
  it("normalizes valid combined filter IDs and rejects malformed lists", () => {
    expect(parseGalleryIds("3,1,3,2")).toEqual([3, 1, 2]);
    expect(parseGalleryIds(undefined)).toEqual([]);
    expect(parseGalleryIds("1,not-a-number")).toBeUndefined();
    expect(parseGalleryIds("0,1")).toBeUndefined();
  });

  it("round-trips an opaque page cursor", () => {
    const params = query({
      search: "fox",
      clubIds: "1,2",
      themeIds: "4",
      photographerId: 7,
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-12-31T00:00:00.000Z"),
      group: "photographer",
      sort: "photographer",
    });
    const cursor = galleryCursor(params, 24);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parseGalleryCursor(cursor, params)).toBe(24);
  });

  it("rejects malformed cursors and cursors from another Gallery view", () => {
    const params = query({ sort: "random", seed: 12345 });
    const cursor = galleryCursor(params, 48);

    expect(parseGalleryCursor("not+a+cursor", params)).toBeUndefined();
    expect(parseGalleryCursor(cursor, query({ sort: "random", seed: 98765 }))).toBeUndefined();
    expect(parseGalleryCursor(cursor, query({ sort: "oldest" }))).toBeUndefined();
  });
});