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

let cache: MyProfile | null | "none" = "none"; // "none" = not fetched yet, null = no profile

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
      cache = null;
      setProfile(null);
      setLoading(false);
      return;
    }
    if (cache === "none") {
      fetchProfile();
    }
  }, [isSignedIn, isLoaded]);

  const invalidate = () => {
    cache = "none";
    fetchProfile();
  };

  return { profile, loading, invalidate };
}
