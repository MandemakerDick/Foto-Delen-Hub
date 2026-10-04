import { describe, expect, it } from "vitest";
import type { Photo } from "@workspace/api-client-react";
import { galleryParams, galleryPath, parseGalleryView, safeGalleryPath, uniqueGalleryPhotos } from "./gallery-view";

describe("Gallery view contract", () => {
  it("round-trips a complete combined and seeded view", () => {
    const { view, invalid } = parseGalleryView("?search=Fox&clubs=1,2&themes=3&photographer=4&from=2026-01-01&to=2026-12-31&group=club&sort=random&seed=123", 1);
    expect(invalid).toBe(false);
    expect(parseGalleryView(galleryPath(view).split("?")[1], 1).view).toEqual(view);
    expect(galleryParams(view)).toEqual({
      search: "Fox", clubIds: "1,2", themeIds: "3", photographerId: 4,
      from: "2026-01-01", to: "2026-12-31", group: "club", sort: "random", seed: 123, limit: 24,
    });
  });
  it("normalizes duplicate IDs and accepts existing single-filter links", () => {
    expect(parseGalleryView("?clubs=01,1,2&themeId=4&photographerId=3").view).toMatchObject({
      clubs: ["1", "2"], themes: ["4"], photographer: "3",
    });
  });
  it("detects invalid IDs, invalid calendar days, sort/group and seed", () => {
    const result = parseGalleryView("?clubs=0,no,2&from=2026-02-31&sort=bad&group=bad&seed=-1", 7);
    expect(result.invalid).toBe(true);
    expect(result.view).toMatchObject({ clubs: ["2"], from: "", sort: "newest", group: "none", seed: 7 });
  });
  it("maintains photographer sorting/grouping and legacy random links", () => {
    expect(parseGalleryView("?sort=photographer&group=club").view.group).toBe("photographer");
    expect(parseGalleryView("?group=random&seed=42").view.sort).toBe("random");
  });
  it("rejects external and non-Gallery return targets", () => {
    expect(safeGalleryPath("//example.com/photos")).toBeNull();
    expect(safeGalleryPath("/sign-in")).toBeNull();
    expect(safeGalleryPath("/photos?clubs=no")).toBeNull();
    expect(safeGalleryPath("/photos?search=fox")).toBe("/photos?search=fox");
    expect(safeGalleryPath("/app/photos?sort=oldest", "/app")).toBe("/app/photos?sort=oldest");
  });
  it("drops overlapping page IDs without changing their initial order", () => {
    const p = (id: number) => ({ id } as Photo);
    expect(uniqueGalleryPhotos([{ items: [p(3), p(1)] }, { items: [p(1), p(2)] }]).map(p => p.id)).toEqual([3, 1, 2]);
  });
});