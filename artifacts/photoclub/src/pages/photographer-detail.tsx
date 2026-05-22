import { useParams, Link } from "wouter";
import { User, Users, Calendar, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { useGetPhotographer, getGetPhotographerQueryKey, useListPhotos } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";

export default function PhotographerDetail() {
  const { id } = useParams();
  const photographerId = Number(id);

  const { data: photographer, isLoading: photographerLoading } = useGetPhotographer(photographerId, {
    query: { enabled: !!photographerId, queryKey: getGetPhotographerQueryKey(photographerId) }
  });

  const { data: photos, isLoading: photosLoading } = useListPhotos({ photographerId });

  if (photographerLoading) {
    return (
      <div className="container mx-auto px-4 py-12 animate-pulse">
        <div className="flex items-center gap-8 mb-12">
          <div className="w-32 h-32 rounded-full bg-muted"></div>
          <div className="flex-1">
            <div className="h-10 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!photographer) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-serif text-3xl mb-4">Photographer not found</h2>
        <Link href="/photographers" className="text-primary hover:underline">Return to Directory</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Profile Header */}
      <section className="bg-secondary/30 border-b border-border/50 py-16">
        <div className="container mx-auto px-4">
          <Link href="/photographers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Directory
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-secondary overflow-hidden border-4 border-background shadow-xl shrink-0 flex items-center justify-center">
              {photographer.avatarUrl ? (
                <img src={photographer.avatarUrl} alt={photographer.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1">
              <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">{photographer.name}</h1>
              
              {photographer.bio && (
                <p className="text-lg text-foreground/80 mb-6 max-w-3xl leading-relaxed">
                  {photographer.bio}
                </p>
              )}
              
              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-muted-foreground">
                {photographer.clubId && (
                  <Link href={`/clubs/${photographer.clubId}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                    <Users className="w-4 h-4" />
                    <span className="uppercase tracking-widest">{photographer.clubName}</span>
                  </Link>
                )}
                <div className="flex items-center gap-2 font-mono">
                  <ImageIcon className="w-4 h-4" />
                  <span>{photographer.photoCount || 0} prints</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {format(new Date(photographer.createdAt), 'MMM yyyy')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Gallery */}
      <section className="py-16 container mx-auto px-4">
        <h2 className="font-serif text-3xl font-bold mb-10 text-center">Portfolio</h2>
        
        {photosLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col gap-3">
                <div className="aspect-[4/5] bg-muted rounded-sm"></div>
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
            <h3 className="font-serif text-xl font-medium mb-2">No portfolio yet</h3>
            <p className="text-muted-foreground">This photographer hasn't uploaded any prints.</p>
          </div>
        )}
      </section>
    </div>
  );
}
