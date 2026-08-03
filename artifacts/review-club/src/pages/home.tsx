import { useListReviewSessions, useListClubs } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Image as ImageIcon } from "lucide-react";
import { PaginationBar } from "@/components/pagination-bar";
import { usePageParam } from "@/hooks/use-page-param";
import { ScanEye } from "lucide-react";

const PAGE_SIZE = 12;

export function Home() {
  const { data: sessions, isLoading: sessionsLoading } = useListReviewSessions();
  const { data: clubs, isLoading: clubsLoading } = useListClubs();
  const [page, setPage] = usePageParam();

  const getClubName = (clubId: number) => {
    return clubs?.find((c) => c.id === clubId)?.name || "Unknown Club";
  };

  const activeSessions = sessions?.filter(s => s.status === "open" || s.status === "reviewing") || [];
  const totalPages = Math.ceil(activeSessions.length / PAGE_SIZE);
  const pagedSessions = activeSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col -mt-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-14 md:pt-12 md:pb-20 bg-background border-b border-border/50 -mx-4 px-4 mb-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/50 via-background to-background" />
        <div className="container relative z-10 mx-auto max-w-3xl text-center flex flex-col items-center gap-6">
          <div className="flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-primary/10 border border-primary/20">
            <ScanEye className="w-12 h-12 md:w-16 md:h-16 text-primary" />
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-bold tracking-tight">
            Photo<span className="text-primary italic">ReviewHub</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl">
            Collaborative critique sessions for your photography club.
          </p>
        </div>
      </section>

      <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-serif font-bold tracking-tight mb-2">Active Sessions</h2>
        <p className="text-muted-foreground text-lg">Browse ongoing review sessions and submit your work.</p>
      </div>

      {(sessionsLoading || clubsLoading) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
        </div>
      ) : activeSessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">No active sessions</h3>
            <p className="text-muted-foreground">Check back later or view the archive for past reviews.</p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pagedSessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group bg-card/50">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={session.status === "open" ? "default" : "secondary"} className="uppercase text-xs tracking-wider">
                      {session.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-serif group-hover:text-primary transition-colors line-clamp-2">
                    {session.title}
                  </CardTitle>
                  <CardDescription className="text-sm font-medium">
                    {getClubName(session.clubId)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {session.description && (
                    <p className="text-sm text-muted-foreground mb-6 line-clamp-3">
                      {session.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-auto">
                    {session.scheduledFor && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(session.scheduledFor), "MMM d, yyyy")}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4" />
                      <span>{session.photoCount || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
    </div>
  );
}
