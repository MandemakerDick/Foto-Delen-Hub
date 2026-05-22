import { useParams, Link } from "wouter";
import { Users, MapPin, Calendar, ArrowLeft, Image as ImageIcon, Globe, User } from "lucide-react";
import { format } from "date-fns";
import { useGetClub, getGetClubQueryKey, useListPhotos } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Separator } from "@/components/ui/separator";

export default function ClubDetail() {
  const { id } = useParams();
  const clubId = Number(id);

  const { data: club, isLoading: clubLoading } = useGetClub(clubId, {
    query: { enabled: !!clubId, queryKey: getGetClubQueryKey(clubId) }
  });

  const { data: photos, isLoading: photosLoading } = useListPhotos({ clubId });

  if (clubLoading) {
    return (
      <div className="container mx-auto px-4 py-12 animate-pulse">
        <div className="h-12 bg-muted rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-muted rounded w-1/4 mb-12"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-muted rounded-sm"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-serif text-3xl mb-4">Community not found</h2>
        <Link href="/clubs" className="text-primary hover:underline">Return to Clubs</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Club Header */}
      <section className="bg-secondary/50 border-b border-border/50 py-16">
        <div className="container mx-auto px-4">
          <Link href="/clubs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clubs
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 overflow-hidden">
                  {club.logoUrl ? (
                    <img src={club.logoUrl} alt={`${club.name} logo`} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-7 h-7 text-primary" />
                  )}
                </div>
                <h1 className="font-serif text-5xl font-bold">{club.name}</h1>
              </div>
              
              {club.description && (
                <p className="text-xl text-muted-foreground mb-6 font-serif italic">
                  "{club.description}"
                </p>
              )}
              
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground font-mono">
                {club.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{club.location}</span>
                  </div>
                )}
                {club.websiteUrl && (
                  <a
                    href={club.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span>{new URL(club.websiteUrl).hostname}</span>
                  </a>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Est. {format(new Date(club.createdAt), 'yyyy')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-8 p-6 bg-background rounded-lg border border-border/50 shadow-sm w-full md:w-auto">
              <div className="text-center">
                <div className="text-3xl font-mono font-medium mb-1">{club.memberCount || 0}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Members</div>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-center">
                <div className="text-3xl font-mono font-medium mb-1">{club.photoCount || 0}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Prints</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Club Gallery */}
      <section className="py-16 container mx-auto px-4">
        <h2 className="font-serif text-3xl font-bold mb-10">Collection</h2>
        
        {photosLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col gap-3">
                <div className="aspect-[4/5] bg-muted rounded-sm"></div>
                <div className="h-5 bg-muted rounded w-3/4"></div>
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
            <p className="text-muted-foreground mb-6">This community hasn't shared any prints.</p>
          </div>
        )}
      </section>
    </div>
  );
}
