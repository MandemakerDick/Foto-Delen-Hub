import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useUser } from "@clerk/react";
import { createMyProfileStore, getProfileView, type MyProfile } from "./my-profile-store";

export type { MyProfile } from "./my-profile-store";

const store = createMyProfileStore();

// Keep the epoch current even on public routes with no profile-hook consumer.
// This invalidates old callbacks across A → B → A without fetching a private
// profile until a consumer actually mounts.
export function syncMyProfileIdentity(userId: string | null) {
  store.setIdentity(userId, false);
}

/**
 * Current Clerk account's linked photographer profile. Shared consumers use
 * one cache and request; identity transitions hide the old result immediately.
 * Refresh keeps a loaded dashboard mounted, while callbacks from a previous
 * identity cannot refresh or mutate the next account's cache.
 */
export function useMyProfile() {
  const { isSignedIn, isLoaded, user } = useUser();
  const userId = !isLoaded ? undefined : isSignedIn && user ? user.id : null;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const identityRevision = snapshot.userId === userId ? snapshot.identityRevision : undefined;

  useEffect(() => {
    if (userId !== undefined) store.setIdentity(userId);
  }, [userId]);

  const refetch = useCallback(
    () => store.refresh(userId, identityRevision),
    [userId, identityRevision],
  );
  const updateProfile = useCallback(
    (partial: Partial<MyProfile>) => store.updateProfile(userId, identityRevision, partial),
    [userId, identityRevision],
  );
  const isCurrentIdentity = useCallback(() => {
    const current = store.getSnapshot();
    return typeof userId === "string" && current.userId === userId &&
      current.identityRevision === identityRevision;
  }, [userId, identityRevision]);

  return {
    ...getProfileView(snapshot, userId), invalidate: refetch, refetch, updateProfile,
    identityKey: `${userId ?? ""}:${identityRevision ?? ""}`, isCurrentIdentity,
  };
}