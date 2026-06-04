import { useListReviewSessions, useListClubs } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Image as ImageIcon, Users } from "lucide-react";

export function Home() {
  const { data: sessions, isLoading: sessionsLoading } = useListReviewSessions();
  const { data: clubs, isLoading: clubsLoading } = useListClubs();

  const getClubName = (clubId: number) => {
    return clubs?.find((c) => c.id === clubId)?.name || "Unknown Club";
  };

  const activeSessions = sessions?.filter(s => s.status === "open" || s.status === "reviewing") || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">Active Sessions</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeSessions.map((session) => (
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
      )}
    </div>
  );
}
