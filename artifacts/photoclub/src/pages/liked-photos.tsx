import { Heart, LogIn } from "lucide-react";
import { SignInButton, useAuth } from "@clerk/react";
import { useTranslation } from "react-i18next";
import { useListLikedPhotos, getListLikedPhotosQueryKey } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Button } from "@/components/ui/button";

export default function LikedPhotos() {
  const { t } = useTranslation();
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { data: photos = [], isLoading } = useListLikedPhotos({
    query: { enabled: !!isSignedIn, queryKey: [...getListLikedPhotosQueryKey(), userId] as const },
  });

  if (!isLoaded || (isSignedIn && isLoading)) {
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
        <Heart className="mx-auto mb-5 h-12 w-12 text-primary" />
        <h1 className="font-serif text-4xl font-bold">{t("likedPhotos.signInTitle")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">{t("likedPhotos.signInBody")}</p>
        <SignInButton mode="modal">
          <Button className="mt-7 gap-2"><LogIn className="h-4 w-4" />{t("nav.signIn")}</Button>
        </SignInButton>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="mb-10 flex items-end gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">{t("likedPhotos.eyebrow")}</p>
          <h1 className="mt-2 font-serif text-4xl font-bold">{t("likedPhotos.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("likedPhotos.subtitle")}</p>
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => <PhotoCard key={photo.id} photo={photo} index={index} context="liked" />)}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-secondary/30 px-6 py-20 text-center">
          <Heart className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="font-serif text-2xl font-semibold">{t("likedPhotos.emptyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t("likedPhotos.emptyBody")}</p>
        </div>
      )}
    </section>
  );
}