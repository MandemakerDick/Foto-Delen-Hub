import { useParams, Link } from "wouter";
import { Camera, Image as ImageIcon, User, ArrowLeft } from "lucide-react";
import { useGetTheme, getGetThemeQueryKey, useListPhotos, useListPhotographers } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Separator } from "@/components/ui/separator";

export default function ThemeDetail() {
  const { id } = useParams();
  const themeId = Number(id);

  const { data: theme, isLoading: themeLoading } = useGetTheme(themeId, {
    query: { enabled: !!themeId, queryKey: getGetThemeQueryKey(themeId) },
  });

  const { data: photos, isLoading: photosLoading } = useListPhotos({ themeId });
  const { data: photographers, isLoading: pgLoading } = useListPhotographers({ themeId });

  if (themeLoading) {
    return (
      <div className="container mx-auto px-4 py-12 animate-pulse">
        <div className="h-12 bg-muted rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted rounded w-1/4 mb-12" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-muted rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-serif text-3xl mb-4">Theme not found</h2>
        <Link href="/themes" className="text-primary hover:underline">Return to Themes</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="bg-secondary/50 border-b border-border/50 py-16">
        <div className="container mx-auto px-4">
          <Link href="/themes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Themes
          </Link>

          <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <h1 className="font-serif text-5xl font-bold">{theme.name}</h1>
              </div>
              {theme.description && (
                <p className="text-xl text-muted-foreground font-serif italic">
                  &ldquo;{theme.description}&rdquo;
                </p>
              )}
            </div>

            <div className="flex gap-8 p-6 bg-background rounded-lg border border-border/50 shadow-sm w-full md:w-auto">
              <div className="text-center">
                <div className="text-3xl font-mono font-medium mb-1">{theme.photoCount ?? 0}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Prints</div>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-center">
                <div className="text-3xl font-mono font-medium mb-1">{photographers?.length ?? 0}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Photographers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Photographers in this theme */}
      {(pgLoading || (photographers && photographers.length > 0)) && (
        <section className="py-12 border-b border-border/50">
          <div className="container mx-auto px-4">
            <h2 className="font-serif text-2xl font-bold mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Photographers
            </h2>

            {pgLoading ? (
              <div className="flex gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-16 h-16 rounded-full bg-muted animate-pulse shrink-0" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {photographers!.map((p) => (
                  <Link key={p.id} href={`/photographers/${p.id}`}>
                    <div className="flex flex-col items-center text-center gap-2 group">
                      <div className="w-16 h-16 rounded-full bg-secondary border-2 border-border/50 group-hover:border-primary/60 transition-colors overflow-hidden flex items-center justify-center shrink-0">
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-7 h-7 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-xs font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {p.name}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Photos */}
      <section className="py-16 container mx-auto px-4">
        <h2 className="font-serif text-3xl font-bold mb-10 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-primary" />
          Collection
        </h2>

        {photosLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col gap-3">
                <div className="aspect-[4/5] bg-muted rounded-sm" />
                <div className="h-5 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : photos && photos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {photos.map((photo, i) => (
              <PhotoCard key={photo.id} photo={photo} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-secondary/50 rounded-lg border border-border/50 border-dashed">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-serif text-xl font-medium mb-2">No photographs yet</h3>
            <p className="text-muted-foreground">No prints have been tagged with this theme.</p>
          </div>
        )}
      </section>
    </div>
  );
}
