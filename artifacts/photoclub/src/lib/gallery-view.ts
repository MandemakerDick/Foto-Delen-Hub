import type { ListGalleryPhotosParams, Photo } from "@workspace/api-client-react";

export type GallerySort = "newest" | "oldest" | "photographer" | "likes" | "comments" | "random";
export type GalleryGroup = "none" | "club" | "photographer" | "theme";
export type GalleryView = {
  search: string; clubs: string[]; themes: string[]; photographer: string;
  from: string; to: string; group: GalleryGroup; sort: GallerySort; seed: number;
};
const sorts = new Set(["newest", "oldest", "photographer", "likes", "comments", "random"]);
const groups = new Set(["none", "club", "photographer", "theme"]);

export function parseGalleryView(search: string, seed = Date.now()) {
  const q = new URLSearchParams(search);
  let invalid = false;
  const ids = (key: string) => {
    const values = (q.get(key) ?? q.get(key === "clubs" ? "clubId" : "themeId"))?.split(",") ?? [];
    const valid = values.filter(value => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0);
    if (valid.length !== values.length) invalid = true;
    return [...new Set(valid.map(value => String(Number(value))))];
  };
  const date = (key: string) => {
    const value = q.get(key);
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value) return value;
    invalid = true;
    return "";
  };
  const rawSort = q.get("sort");
  const rawGroup = q.get("group");
  const sort = (sorts.has(rawSort ?? "") ? rawSort : rawGroup === "random" ? "random" : "newest") as GallerySort;
  if (rawSort && !sorts.has(rawSort)) invalid = true;
  if (rawGroup && rawGroup !== "random" && !groups.has(rawGroup)) invalid = true;
  const photographer = q.get("photographer") ?? q.get("photographerId");
  const validPhotographer = photographer && /^\d+$/.test(photographer) &&
    Number.isSafeInteger(Number(photographer)) && Number(photographer) > 0;
  if (photographer && !validPhotographer) invalid = true;
  const rawSeed = q.get("seed");
  const numericSeed = Number(rawSeed);
  const validSeed = Number.isSafeInteger(numericSeed) && numericSeed > 0;
  if (rawSeed && !validSeed) invalid = true;
  const view: GalleryView = {
    search: (q.get("search") ?? "").trim(), clubs: ids("clubs"), themes: ids("themes"),
    photographer: validPhotographer ? String(Number(photographer)) : "all",
    from: date("from"), to: date("to"),
    group: sort === "photographer" ? "photographer" : groups.has(rawGroup ?? "") ? rawGroup as GalleryGroup : "none",
    sort, seed: validSeed ? numericSeed : seed,
  };
  return { view, invalid };
}

export function galleryPath(view: GalleryView, pathname = "/photos") {
  const q = new URLSearchParams();
  if (view.search.trim()) q.set("search", view.search.trim());
  if (view.clubs.length) q.set("clubs", view.clubs.join(","));
  if (view.themes.length) q.set("themes", view.themes.join(","));
  if (view.photographer !== "all") q.set("photographer", view.photographer);
  if (view.from) q.set("from", view.from);
  if (view.to) q.set("to", view.to);
  if (view.group !== "none") q.set("group", view.group);
  if (view.sort !== "newest") q.set("sort", view.sort);
  if (view.sort === "random") q.set("seed", String(view.seed));
  return `${pathname}${q.size ? `?${q}` : ""}`;
}

export function galleryParams(view: GalleryView): ListGalleryPhotosParams {
  return {
    search: view.search.trim() || undefined, clubIds: view.clubs.join(",") || undefined,
    themeIds: view.themes.join(",") || undefined,
    photographerId: view.photographer === "all" ? undefined : Number(view.photographer),
    from: view.from || undefined, to: view.to || undefined,
    group: view.group, sort: view.sort, seed: view.sort === "random" ? view.seed : undefined, limit: 24,
  };
}

export function uniqueGalleryPhotos(pages: { items: Photo[] }[]) {
  const seen = new Set<number>();
  return pages.flatMap(page => page.items).filter(photo => {
    if (seen.has(photo.id)) return false;
    seen.add(photo.id);
    return true;
  });
}

export function safeGalleryPath(value: string | null, base = "") {
  if (!value) return null;
  try {
    const url = new URL(value, "https://gallery.invalid");
    if (url.origin !== "https://gallery.invalid" || url.pathname !== `${base}/photos`) return null;
    const { view, invalid } = parseGalleryView(url.search, 1);
    return invalid ? null : galleryPath(view, url.pathname);
  } catch { return null; }
}