/** Keep related detail links in the tab stack that opened the current detail. */
export function detailBasePath(pathname: string): '/gallery' | '/my-photos' | '/liked-photos' {
  if (pathname === '/my-photos' || pathname.startsWith('/my-photos/')) return '/my-photos';
  if (pathname === '/liked-photos' || pathname.startsWith('/liked-photos/')) return '/liked-photos';
  return '/gallery';
}