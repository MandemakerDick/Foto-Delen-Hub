export type GallerySelection = {
  path: string; ids: number[]; cursor: string | null; hasMore: boolean; savedAt: number;
};
const key = "photomatrix.gallery-selections";
const selections = new Map<string, GallerySelection>();
const maxAge = 30 * 60 * 1000;

export function rememberGallerySelection(selection: Omit<GallerySelection, "savedAt">) {
  const snapshot = { ...selection, ids: [...new Set(selection.ids)], savedAt: Date.now() };
  selections.delete(snapshot.path);
  selections.set(snapshot.path, snapshot);
  while (selections.size > 5) selections.delete(selections.keys().next().value!);
  try { sessionStorage.setItem(key, JSON.stringify([...selections.values()])); } catch {
    // Storage can be unavailable; in-memory selection still supports navigation.
  }
  return snapshot;
}

export function readGallerySelection(path: string) {
  if (!selections.has(path)) {
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
      if (Array.isArray(stored)) {
        for (const item of stored.slice(-5)) {
          if (item && item.path === path && Array.isArray(item.ids) &&
            item.ids.every((id: unknown) => typeof id === "number" && Number.isSafeInteger(id) && id > 0) &&
            (item.cursor === null || typeof item.cursor === "string") && typeof item.hasMore === "boolean" &&
            typeof item.savedAt === "number") {
            selections.set(path, item as GallerySelection);
          }
        }
      }
    } catch { /* A missing/corrupt snapshot must not block public photo detail. */ }
  }
  const result = selections.get(path);
  if (!result || result.savedAt > Date.now() || Date.now() - result.savedAt > maxAge) {
    selections.delete(path);
    return null;
  }
  return result;
}