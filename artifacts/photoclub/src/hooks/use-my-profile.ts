import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";

export type MyProfile = {
  id: number;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  clubId: number | null;
  clubName: string | null;
  createdAt: string;
};

/**
 * Module-level cache for the current user's profile.
 *
 * "none" = not yet fetched; null = fetched but no profile exists.
 *
 * Using a module-level variable means the profile is only fetched once per
 * page session regardless of how many components call this hook. Call
 * `invalidate()` after creating or linking a profile to force a re-fetch.
 */
let cache: MyProfile | null | "none" = "none";

/**
 * Returns the Clerk-linked photographer profile for the signed-in user.
 *
 * - `profile === undefined` — loading
 * - `profile === null`      — signed in but no profile linked yet
 * - `profile`               — fully resolved photographer profile
 */
export function useMyProfile() {
  const { isSignedIn, isLoaded } = useUser();
  const [profile, setProfile] = useState<MyProfile | null | undefined>(
    cache === "none" ? undefined : cache,
  );
  const [loading, setLoading] = useState(cache === "none");

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        cache = data;
        setProfile(data);
      } else {
        cache = null;
        setProfile(null);
      }
    } catch {
      cache = null;
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      // User is signed out — clear cache immediately so it is not stale on
      // the next sign-in.
      cache = null;
      setProfile(null);
      setLoading(false);
      return;
    }
    if (cache === "none") {
      fetchProfile();
    }
  }, [isSignedIn, isLoaded]);

  /** Reset the cache and re-fetch — call after linking or creating a profile. */
  const invalidate = () => {
    cache = "none";
    fetchProfile();
  };

  return { profile, loading, invalidate };
}
