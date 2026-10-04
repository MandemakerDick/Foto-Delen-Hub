import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getListGalleryPhotosQueryKey, listGalleryPhotos, type GalleryPhotoPage } from "@workspace/api-client-react";
import { galleryParams, parseGalleryView } from "@/lib/gallery-view";
import { readGallerySelection, rememberGallerySelection } from "@/lib/gallery-selection";

export function useGalleryNavigation(path: string | null, photoId: number) {
  const client = useQueryClient();
  const [selection, setSelection] = useState(() => path ? readGallerySelection(path) : null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  const cancelCurrent = useCallback(() => {
    version.current++;
    controller.current?.abort();
  }, []);
  useEffect(() => {
    cancelCurrent();
    setSelection(path ? readGallerySelection(path) : null);
    setPending(false);
    setFailed(false);
    return cancelCurrent;
  }, [path, photoId, cancelCurrent]);
  const current = selection?.path === path ? selection : null;
  const index = current?.ids.indexOf(photoId) ?? -1;
  const previous = index > 0 ? current!.ids[index - 1] : null;
  const next = index >= 0 ? current!.ids[index + 1] ?? null : null;

  const loadNext = async () => {
    if (!path || !current?.hasMore || !current.cursor || pending || index < 0) return null;
    const revision = version.current;
    const expectedLocation = window.location.pathname + window.location.search;
    const cursor = current.cursor;
    const params = galleryParams(parseGalleryView(new URL(path, window.location.origin).search).view);
    const request = new AbortController();
    controller.current = request;
    setPending(true);
    setFailed(false);
    try {
      const page = await listGalleryPhotos({ ...params, cursor }, { signal: request.signal });
      if (revision !== version.current || request.signal.aborted ||
        expectedLocation !== window.location.pathname + window.location.search) return null;
      const updated = rememberGallerySelection({
        path, ids: [...current.ids, ...page.items.map(photo => photo.id)],
        cursor: page.nextCursor ?? null, hasMore: page.hasMore,
      });
      setSelection(updated);
      // Append only to the exact cached selection. Never recreate missing pages.
      client.setQueryData<InfiniteData<GalleryPhotoPage, string | undefined>>(
        getListGalleryPhotosQueryKey(params), old => {
          if (!old || old.pages.at(-1)?.nextCursor !== cursor) return old;
          return { pages: [...old.pages, page], pageParams: [...old.pageParams, cursor] };
        },
      );
      const nextId = updated.ids[updated.ids.indexOf(photoId) + 1] ?? null;
      if (!nextId && page.hasMore) setFailed(true);
      return nextId;
    } catch {
      if (revision === version.current) setFailed(true);
      return null;
    } finally {
      if (revision === version.current) setPending(false);
    }
  };
  return { previous, next, canLoadNext: index >= 0 && !!current?.hasMore, pending, failed, unavailable: !!path && index < 0, loadNext };
}