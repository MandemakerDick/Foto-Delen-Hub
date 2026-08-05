import { useGetReviewSession, useListSessionPhotos, useListClubs } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useDateLocale } from "@/hooks/use-date-locale";
import { StarRating } from "@/components/star-rating";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, MessageSquare, ArrowLeft, Trophy } from "lucide-react";

const MEDAL = [
  { label: "🥇", ring: "ring-yellow-400/60", bg: "bg-yellow-400/10", text: "text-yellow-400" },
  { label: "🥈", ring: "ring-zinc-400/60",   bg: "bg-zinc-400/10",   text: "text-zinc-400"   },
  { label: "🥉", ring: "ring-amber-700/60",  bg: "bg-amber-700/10",  text: "text-amber-700"  },
];

export function SessionResults() {
  const { id } = useParams();
  const sessionId = parseInt(id || "0", 10);
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const { data: session, isLoading: sessionLoading } = useGetReviewSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: ["reviewSession", sessionId] },
  });
  const { data: photos, isLoading: photosLoading } = useListSessionPhotos(sessionId, {
    query: { enabled: !!sessionId, queryKey: ["sessionPhotos", sessionId] },
  });
  const { data: clubs } = useListClubs();

  if (sessionLoading || photosLoading) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!session) return <p className="text-center py-20 text-muted-foreground">{t("session.notFound")}</p>;

  const clubName = clubs?.find((c) => c.id === session.clubId)?.name ?? t("common.unknownClub");

  // Sort: rated photos by averageRating desc, unrated last
  const sorted = [...(photos ?? [])].sort((a, b) => {
    if (a.averageRating == null && b.averageRating == null) return 0;
    if (a.averageRating == null) return 1;
    if (b.averageRating == null) return -1;
    return b.averageRating - a.averageRating;
  });

  const ratedPhotos = sorted.filter((p) => p.averageRating != null);
  const topThree = ratedPhotos.slice(0, 3);

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Back link */}
      <Link href={`/sessions/${sessionId}`}>
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          {t("results.backToSession")}
        </Button>
      </Link>

      {/* Header */}
      <div className="space-y-3 border-b border-border/50 pb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge
            variant={session.status === "open" ? "default" : session.status === "reviewing" ? "secondary" : "outline"}
            className="uppercase tracking-wider"
          >
            {t(`status.${session.status}`)}
          </Badge>
          <span className="text-sm text-muted-foreground">{clubName}</span>
          {session.scheduledFor && (
            <span className="text-sm text-muted-foreground">
              {format(new Date(session.scheduledFor), "PP", { locale: dateLocale })}
            </span>
          )}
        </div>
        <h1 className="text-4xl font-serif font-bold tracking-tight flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary shrink-0" />
          {t("results.title", { session: session.title })}
        </h1>
        {session.status !== "closed" && (
          <p className="text-sm text-muted-foreground italic">{t("results.liveNote")}</p>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>{t("results.noPhotos")}</p>
        </div>
      ) : (
        <>
          {/* Podium — top 3 rated */}
          {topThree.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-serif font-semibold">{t("results.topPicks")}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {topThree.map((photo, i) => {
                  const medal = MEDAL[i];
                  return (
                    <Link key={photo.id} href={`/sessions/${sessionId}/photos/${photo.id}`}>
                      <div className={`relative rounded-xl overflow-hidden border ring-2 ${medal.ring} ${medal.bg} group cursor-pointer transition-all hover:scale-[1.02]`}>
                        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                          {photo.photoImageUrl ? (
                            <img
                              src={photo.photoImageUrl}
                              alt={photo.photoTitle || t("common.photoAlt")}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-muted-foreground opacity-40" />
                            </div>
                          )}
                          <div className="absolute top-3 left-3 text-2xl leading-none">{medal.label}</div>
                        </div>
                        <div className="p-4 space-y-1">
                          <p className="font-serif font-semibold line-clamp-1">{photo.photoTitle || t("session.untitled")}</p>
                          <p className="text-sm text-muted-foreground">{t("common.by")} {photo.photographerName}</p>
                          <div className="flex items-center gap-2 pt-1">
                            <StarRating rating={photo.averageRating!} max={5} size="sm" className="text-primary" />
                            <span className={`text-sm font-bold ${medal.text}`}>{photo.averageRating!.toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                              <MessageSquare className="w-3 h-3" />
                              {photo.reviewCount}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Full ranked list */}
          <section className="space-y-4">
            <h2 className="text-xl font-serif font-semibold">{t("results.allRankings")}</h2>
            <div className="space-y-2">
              {sorted.map((photo, i) => {
                const rank = photo.averageRating != null ? i + 1 : null;
                const medal = rank && rank <= 3 ? MEDAL[rank - 1] : null;
                return (
                  <Link key={photo.id} href={`/sessions/${sessionId}/photos/${photo.id}`}>
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-card/40 border border-border/40 hover:border-primary/40 hover:bg-card/70 transition-colors cursor-pointer group">
                      {/* Rank */}
                      <div className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-sm font-bold ${medal ? `${medal.bg} ${medal.text}` : "text-muted-foreground"}`}>
                        {rank ? (medal ? medal.label : rank) : "—"}
                      </div>

                      {/* Thumbnail */}
                      <div className="w-16 h-12 rounded overflow-hidden bg-muted shrink-0">
                        {photo.photoImageUrl ? (
                          <img src={photo.photoImageUrl} alt={photo.photoTitle || ""} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground opacity-40" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-serif font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                          {photo.photoTitle || t("session.untitled")}
                        </p>
                        <p className="text-sm text-muted-foreground">{photo.photographerName}</p>
                      </div>

                      {/* Rating */}
                      <div className="text-right shrink-0 space-y-0.5">
                        {photo.averageRating != null ? (
                          <>
                            <div className="flex items-center gap-2 justify-end">
                              <StarRating rating={photo.averageRating} max={5} size="sm" className="text-primary" />
                              <span className="text-sm font-semibold">{photo.averageRating.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                              <MessageSquare className="w-3 h-3" />
                              {t("session.reviewCount", { count: photo.reviewCount ?? 0 })}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">{t("session.noRatings")}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
