import { Heart, LogIn, User, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { SignInButton, useAuth } from "@clerk/react";
import { useTranslation } from "react-i18next";
import {
  useListFollowingPhotographers,
  useListFollowingPhotos,
  getListFollowingPhotographersQueryKey,
  getListFollowingPhotosQueryKey,
} from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Button } from "@/components/ui/button";

export default function Following() {
  const { t } = useTranslation();
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { data: photographers = [], isLoading: photographersLoading } = useListFollowingPhotographers({
    query: { enabled: !!isSignedIn, queryKey: [...getListFollowingPhotographersQueryKey(), userId] as const },
  });
  const { data: photos = [], isLoading: photosLoading } = useListFollowingPhotos({
    query: { enabled: !!isSignedIn, queryKey: [...getListFollowingPhotosQueryKey(), userId] as const },
  });

  if (!isLoaded || (isSignedIn && (photographersLoading || photosLoading))) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="h-10 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-sm bg-muted" />)}
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <section className="container mx-auto px-4 py-24 text-center">
        <UserPlus className="mx-auto mb-5 h-12 w-12 text-primary" />
        <h1 className="font-serif text-4xl font-bold">{t("following.signInTitle")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">{t("following.signInBody")}</p>
        <SignInButton mode="modal">
          <Button className="mt-7 gap-2"><LogIn className="h-4 w-4" />{t("nav.signIn")}</Button>
        </SignInButton>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">{t("following.eyebrow")}</p>
      <h1 className="mt-2 font-serif text-4xl font-bold">{t("following.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("following.subtitle")}</p>

      {photographers.length > 0 ? (
        <>
          <div className="mt-10 flex gap-3 overflow-x-auto pb-2">
            {photographers.map((photographer) => (
              <Link
                key={photographer.id}
                href={`/photographers/${photographer.id}`}
                className="group flex min-w-48 items-center gap-3 rounded-lg border border-border/60 bg-secondary/25 p-3 transition-colors hover:border-primary/50 hover:bg-secondary/55"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                  {photographer.avatarUrl ? (
                    <img src={photographer.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : <User className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium group-hover:text-primary">{photographer.name}</p>
                  <p className="text-xs text-muted-foreground">{t("following.photoCount", { count: photographer.photoCount ?? 0 })}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-14 flex items-center gap-3">
            <Heart className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-3xl font-bold">{t("following.feedTitle")}</h2>
          </div>
          {photos.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo, index) => <PhotoCard key={photo.id} photo={photo} index={index} context="following" />)}
            </div>
          ) : (
            <div className="mt-8 rounded-lg border border-dashed border-border/60 bg-secondary/30 px-6 py-16 text-center">
              <h2 className="font-serif text-2xl font-semibold">{t("following.feedEmptyTitle")}</h2>
              <p className="mt-2 text-muted-foreground">{t("following.feedEmptyBody")}</p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-10 rounded-lg border border-dashed border-border/60 bg-secondary/30 px-6 py-20 text-center">
          <UserPlus className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="font-serif text-2xl font-semibold">{t("following.emptyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t("following.emptyBody")}</p>
          <Link href="/photographers"><Button variant="outline" className="mt-6">{t("following.browsePhotographers")}</Button></Link>
        </div>
      )}
    </section>
  );
}