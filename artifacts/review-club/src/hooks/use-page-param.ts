import { useSearch, useLocation } from "wouter";

/**
 * Syncs a pagination page number with the URL ?page=N query param.
 * Page 1 is the default — no param is written for page 1.
 * Setting the page replaces the current history entry so pagination
 * doesn't flood the back-stack, while the URL is still bookmarkable/shareable.
 */
export function usePageParam(): [number, (page: number) => void] {
  const search = useSearch();
  const [pathname, navigate] = useLocation();

  const params = new URLSearchParams(search);
  const raw = parseInt(params.get("page") ?? "1", 10);
  const page = isNaN(raw) || raw < 1 ? 1 : raw;

  const setPage = (newPage: number) => {
    const next = new URLSearchParams(search);
    if (newPage <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(newPage));
    }
    const qs = next.toString();
    navigate(pathname + (qs ? "?" + qs : ""), { replace: true });
  };

  return [page, setPage];
}
