export type MyProfile = {
  id: number;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  clubs: { id: number; name: string; memberSince?: number | null }[];
  themes: { id: number; name: string }[];
  createdAt: string;
};

export type ProfileSnapshot = {
  userId: string | null | undefined;
  identityRevision: number;
  profile: MyProfile | null | undefined;
  loading: boolean;
  error: Error | null;
};

// Render-time guard: effects have not necessarily reset the store yet when
// Clerk first renders the next account. Never expose the previous profile.
export function getProfileView(snapshot: ProfileSnapshot, userId: string | null | undefined) {
  if (userId === null) return { profile: null, loading: false, error: null };
  if (userId === undefined || snapshot.userId !== userId) {
    return { profile: undefined, loading: true, error: null };
  }
  return { profile: snapshot.profile, loading: snapshot.loading, error: snapshot.error };
}

/** One current-account cache, shared by every profile consumer. */
export function createMyProfileStore(fetcher: typeof fetch = (...args) => fetch(...args)) {
  let snapshot: ProfileSnapshot = {
    userId: undefined, identityRevision: 0, profile: undefined, loading: true, error: null,
  };
  let requestVersion = 0;
  let pendingVersion: number | undefined;
  let controller: AbortController | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: ProfileSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const matches = (userId: string | null | undefined, revision: number | undefined) =>
    typeof userId === "string" && snapshot.userId === userId && snapshot.identityRevision === revision;

  const refresh = async (userId: string | null | undefined, identityRevision: number | undefined) => {
    if (!matches(userId, identityRevision)) return;
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    const version = ++requestVersion;
    pendingVersion = version;
    const isCurrent = () => matches(userId, identityRevision) && requestVersion === version;
    // Preserve a resolved profile during refresh so form/dashboard state is
    // not unmounted while a successful profile edit is being reconciled.
    publish({ ...snapshot, loading: snapshot.profile === undefined, error: null });
    try {
      const response = await fetcher("/api/me", {
        credentials: "include", cache: "no-store", signal: requestController.signal,
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Could not load photographer profile (${response.status})`);
      }
      const profile = response.status === 404 ? null : await response.json() as MyProfile;
      if (!isCurrent()) return;
      publish({ ...snapshot, profile, loading: false, error: null });
    } catch (error) {
      if (!isCurrent()) return;
      publish({
        ...snapshot, profile: snapshot.profile ?? null, loading: false,
        error: error instanceof Error ? error : new Error("Could not load photographer profile"),
      });
    } finally {
      if (pendingVersion === version) pendingVersion = undefined;
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setIdentity(userId: string | null, fetchProfile = true) {
      if (snapshot.userId === userId) {
        if (fetchProfile && pendingVersion === undefined &&
          (snapshot.profile === undefined || snapshot.error)) {
          void refresh(userId, snapshot.identityRevision);
        }
        return;
      }
      controller?.abort();
      requestVersion++;
      pendingVersion = undefined;
      publish({
        userId, identityRevision: snapshot.identityRevision + 1,
        profile: userId === null ? null : undefined, loading: userId !== null, error: null,
      });
      if (userId !== null && fetchProfile) void refresh(userId, snapshot.identityRevision);
    },
    refresh,
    updateProfile(userId: string | null | undefined, identityRevision: number | undefined, partial: Partial<MyProfile>) {
      if (!matches(userId, identityRevision) || !snapshot.profile) return;
      // A read begun before the mutation must not overwrite its saved fields.
      controller?.abort();
      requestVersion++;
      pendingVersion = undefined;
      publish({ ...snapshot, profile: { ...snapshot.profile, ...partial }, loading: false, error: null });
    },
  };
}