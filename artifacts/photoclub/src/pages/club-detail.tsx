import { useState } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Users, MapPin, Calendar, ArrowLeft, Image as ImageIcon, Globe, X } from "lucide-react";
import { format } from "date-fns";
import {
  useGetClub, getGetClubQueryKey,
  useListPhotos,
  useListPhotographers, getListPhotographersQueryKey,
} from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function ClubDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const clubId = Number(id);

  const [showMembers, setShowMembers] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<number | null>(null);

  const { data: club, isLoading: clubLoading } = useGetClub(clubId, {
    query: { enabled: !!clubId, queryKey: getGetClubQueryKey(clubId) },
  });

  const { data: members } = useListPhotographers(
    { clubId },
    { query: { enabled: showMembers, queryKey: getListPhotographersQueryKey({ clubId }) } },
  );

  const { data: photos, isLoading: photosLoading } = useListPhotos(
    selectedPhotographerId
      ? { photographerId: selectedPhotographerId }
      : { clubId },
  );

  const selectedMember = members?.find((m) => m.id === selectedPhotographerId) ?? null;

  const handleMemberClick = (photographerId: number) => {
    setSelectedPhotographerId((prev) => (prev === photographerId ? null : photographerId));
  };

  const handleMembersToggle = () => {
    setShowMembers((v) => {
      if (v) setSelectedPhotographerId(null);
      return !v;
    });
  };

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
        <h2 className="font-serif text-3xl mb-4">{t("clubDetail.notFound")}</h2>
        <Link href="/clubs" className="text-primary hover:underline">{t("clubDetail.returnLink")}</Link>
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
            {t("clubDetail.back")}
          </Link>

          <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-4 mb-4">
                {club.logoUrl ? (
                  <img
                    src={club.logoUrl}
                    alt={`${club.name} logo`}
                    className="h-16 w-auto object-contain shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                    <Users className="w-7 h-7 text-primary" />
                  </div>
                )}
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
                  <span>{t("clubDetail.established", { year: club.yearEstablished ?? format(new Date(club.createdAt), "yyyy") })}</span>
                </div>
              </div>
            </div>

            {/* Stats — members count is clickable */}
            <div className="flex gap-8 p-6 bg-background rounded-lg border border-border/50 shadow-sm w-full md:w-auto">
              <button
                onClick={handleMembersToggle}
                className={`text-center group focus:outline-none transition-colors ${showMembers ? "text-primary" : ""}`}
              >
                <div className="text-3xl font-mono font-medium mb-1">{club.memberCount || 0}</div>
                <div className={`text-xs uppercase tracking-widest flex items-center gap-1 justify-center transition-colors ${showMembers ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}>
                  {t("clubDetail.members")}
                  {showMembers && <X className="w-3 h-3" />}
                </div>
              </button>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-center">
                <div className="text-3xl font-mono font-medium mb-1">{club.photoCount || 0}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("clubDetail.prints")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Members panel */}
      {showMembers && (
        <section className="border-b border-border/50 bg-secondary/20 py-8">
          <div className="container mx-auto px-4">
            <h2 className="font-serif text-xl font-medium mb-5 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {t("clubDetail.membersHeading")}
            </h2>
            {!members ? (
              <div className="flex gap-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                    <div className="w-14 h-14 rounded-full bg-muted" />
                    <div className="h-3 w-12 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("clubDetail.noMembersYet")}</p>
            ) : (
              <div className="flex flex-wrap gap-5">
                {members.map((member) => {
                  const isSelected = selectedPhotographerId === member.id;
                  return (
                    <button
                      key={member.id}
                      onClick={() => handleMemberClick(member.id)}
                      className={`flex flex-col items-center gap-2 w-20 group focus:outline-none transition-opacity ${selectedPhotographerId && !isSelected ? "opacity-40" : ""}`}
                    >
                      <div className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-colors ${isSelected ? "border-primary" : "border-transparent group-hover:border-primary/50"} bg-secondary`}>
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl font-serif text-muted-foreground">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs text-center leading-tight font-medium line-clamp-2 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
                        {member.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Gallery */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
          <h2 className="font-serif text-3xl font-bold">
            {selectedMember
              ? t("clubDetail.filteringBy", { name: selectedMember.name })
              : t("clubDetail.collection")}
          </h2>
          {selectedMember && (
            <div className="flex items-center gap-3">
              <Link href={`/photographers/${selectedMember.id}`} className="text-sm text-primary hover:underline">
                {selectedMember.name}'s full portfolio →
              </Link>
              <Button variant="outline" size="sm" onClick={() => setSelectedPhotographerId(null)}>
                <X className="w-3.5 h-3.5 mr-1.5" />
                {t("clubDetail.allPhotos")}
              </Button>
            </div>
          )}
        </div>

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
              <PhotoCard key={photo.id} photo={photo} index={i} context={`club:${clubId}`} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-secondary/50 rounded-lg border border-border/50 border-dashed">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-serif text-xl font-medium mb-2">{t("clubDetail.noPhotos")}</h3>
            <p className="text-muted-foreground mb-6">{t("clubDetail.noPhotosBody")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
