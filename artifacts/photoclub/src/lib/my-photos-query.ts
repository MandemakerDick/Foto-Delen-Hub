import { getListPhotosQueryKey, listPhotos } from "@workspace/api-client-react";
import type { QueryFunctionContext } from "@tanstack/react-query";

/**
 * Keep the generated list prefix so edit/delete/reorder invalidations still
 * work, but never reuse a private list across account identity epochs.
 */
export function myPhotosQueryOptions(
  photographerId: number,
  identityKey: string,
  isCurrentIdentity: () => boolean,
) {
  return {
    queryKey: [...getListPhotosQueryKey({ photographerId }), "my-photos", identityKey],
    retry: false as const,
    queryFn: async ({ signal }: QueryFunctionContext) => {
      if (!isCurrentIdentity() || signal.aborted) throw new Error("Obsolete photo request");
      const photos = await listPhotos({ photographerId }, { signal });
      if (!isCurrentIdentity() || signal.aborted) throw new Error("Obsolete photo request");
      return photos;
    },
  };
}

export async function retryMyPhotos(
  isCurrentIdentity: () => boolean,
  refetch: () => Promise<unknown>,
) {
  if (isCurrentIdentity()) await refetch();
}