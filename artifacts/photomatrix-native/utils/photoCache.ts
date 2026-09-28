import type { QueryClient } from '@tanstack/react-query';

// The directory detail screens use custom query keys while other discovery
// screens use generated API keys. Invalidating both makes mounted screens
// refetch now and inactive screens refetch when they are opened again.
export function invalidatePhotoCaches(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      const key = queryKey[0];
      return typeof key === 'string' && (
        key === 'my-photos' ||
        key.startsWith('directory-') ||
        /^\/api\/(?:photos|photographers|clubs|themes)(?:\/|$)/.test(key)
      );
    },
  });
}