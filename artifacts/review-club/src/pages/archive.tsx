import { useListReviewSessions, useListClubs } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { PaginationBar } from "@/components/pagination-bar";
import { usePageParam } from "@/hooks/use-page-param";
import { useTranslation } from "react-i18next";
import { ArchiveCard } from "@/components/archive-card";

const PAGE_SIZE = 12;

export function Archive() {
  const { data: sessions, isLoading: sessionsLoading } = useListReviewSessions({ status: "closed" });
  const { data: clubs, isLoading: clubsLoading } = useListClubs();
  const [page, setPage] = usePageParam();
  const { t } = useTranslation();

  const getClubName = (clubId: number) => {
    return clubs?.find((c) => c.id === clubId)?.name || t("common.unknownClub");
  };

  const totalPages = Math.ceil((sessions?.length ?? 0) / PAGE_SIZE);
  const pagedSessions = sessions?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">{t("archive.title")}</h1>
        <p className="text-muted-foreground text-lg">{t("archive.subtitle")}</p>
      </div>

      {(sessionsLoading || clubsLoading) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">{t("archive.emptyTitle")}</h3>
            <p className="text-muted-foreground">{t("archive.emptyBody")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pagedSessions.map((session) => (
            <ArchiveCard
              key={session.id}
              session={session}
              clubName={getClubName(session.clubId)}
            />
          ))}
        </div>
        <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
