import type { QueryClient } from '@tanstack/react-query';

// Keep public discovery and Gallery data across account changes, but never
// share authenticated results between Clerk identities.
export function clearPrivateAccountCaches(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: ({ queryKey }) => {
      const key = queryKey[0];
      return typeof key === 'string' && (
        key === '/api/me' ||
        key.startsWith('/api/me/') ||
        key === 'my-photos' ||
        key === 'photo-like' ||
        key === '/api/photos/liked' ||
        key === '/api/photographers/following' ||
        /^\/api\/photos\/[^/]+\/like(?:\/|$)/.test(key) ||
        /^\/api\/photographers\/[^/]+\/follow(?:\/|$)/.test(key) ||
        /^\/api\/clubs\/[^/]+\/membership(?:\/|$)/.test(key)
      );
    },
  });
}