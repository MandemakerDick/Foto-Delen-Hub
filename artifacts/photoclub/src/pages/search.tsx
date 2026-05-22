import { Link, useSearch } from "wouter";
import { User, Image as ImageIcon, Search, Camera } from "lucide-react";
import { useListPhotographers, useListPhotos, useListThemes } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";

export default function SearchResults() {
  const qs = useSearch();
  const params = new URLSearchParams(qs);
  const query = params.get("q") ?? "";

  const { data: photographers, isLoading: pgLoading } = useListPhotographers(
    query ? { search: query } : undefined,
  );

  const { data: photos, isLoading: phLoading } = useListPhotos(
    query ? { search: query } : undefined,
  );

  const { data: themes, isLoading: thLoading } = useListThemes(
    query ? { search: query } : undefined,
  );

  const loading = pgLoading || phLoading || thLoading;

  if (!query) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
        <h2 className="font-serif text-2xl font-bold mb-2">Start searching</h2>
        <p className="text-muted-foreground">Use the search bar on the home page to find photographs, photographers, and themes.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10">
        <p className="text-muted-foreground text-sm uppercase tracking-widest mb-1">Search results for</p>
        <h1 className="font-serif text-4xl font-bold">&ldquo;{query}&rdquo;</h1>
      </div>

      {loading ? (
        <div className="space-y-12">
          <SectionSkeleton count={4} tall={false} />
          <SectionSkeleton count={6} tall={false} />
          <SectionSkeleton count={8} tall />
        </div>
      ) : (
        <div className="space-y-16">
          {/* Photographers */}
          <section>
            <h2 className="font-serif text-2xl font-bold mb-1 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Photographers
              <span className="text-base font-mono text-muted-foreground ml-1">({photographers?.length ?? 0})</span>
            </h2>
            <p className="text-muted-foreground text-sm mb-6">People whose name or bio matches.</p>

            {photographers && photographers.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {photographers.map((p) => (
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
            ) : (
              <EmptyState message={`No photographers match \u201c${query}\u201d.`} />
            )}
          </section>

          {/* Themes */}
          <section>
            <h2 className="font-serif text-2xl font-bold mb-1 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Themes
              <span className="text-base font-mono text-muted-foreground ml-1">({themes?.length ?? 0})</span>
            </h2>
            <p className="text-muted-foreground text-sm mb-6">Collections whose name matches.</p>

            {themes && themes.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {themes.map((t) => (
                  <Link key={t.id} href={`/themes`}>
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border/50 bg-background hover:border-primary/60 hover:bg-secondary/40 transition-colors group cursor-pointer">
                      <Camera className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      <span className="text-sm font-medium group-hover:text-primary transition-colors">{t.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState message={`No themes match \u201c${query}\u201d.`} />
            )}
          </section>

          {/* Photos */}
          <section>
            <h2 className="font-serif text-2xl font-bold mb-1 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              Photographs
              <span className="text-base font-mono text-muted-foreground ml-1">({photos?.length ?? 0})</span>
            </h2>
            <p className="text-muted-foreground text-sm mb-6">Images whose title or description matches.</p>

            {photos && photos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
                {photos.map((photo, i) => (
                  <PhotoCard key={photo.id} photo={photo} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState message={`No photographs match \u201c${query}\u201d.`} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center border border-border/40 rounded-lg bg-secondary/20">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function SectionSkeleton({ count, tall }: { count: number; tall: boolean }) {
  return (
    <section>
      <div className="h-8 bg-muted rounded w-48 mb-6 animate-pulse" />
      <div className={`grid gap-4 ${tall ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`animate-pulse bg-muted rounded-lg ${tall ? "aspect-[4/5]" : "h-20"}`} />
        ))}
      </div>
    </section>
  );
}
