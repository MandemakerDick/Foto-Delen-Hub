import { useListReviewSessions, useListClubs } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Image as ImageIcon } from "lucide-react";

export function Archive() {
  const { data: sessions, isLoading: sessionsLoading } = useListReviewSessions({ status: "closed" });
  const { data: clubs, isLoading: clubsLoading } = useListClubs();

  const getClubName = (clubId: number) => {
    return clubs?.find((c) => c.id === clubId)?.name || "Unknown Club";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">Archive</h1>
        <p className="text-muted-foreground text-lg">Past review sessions and historical feedback.</p>
      </div>

      {(sessionsLoading || clubsLoading) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">No archived sessions</h3>
            <p className="text-muted-foreground">Closed review sessions will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group bg-card/50">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="uppercase text-xs tracking-wider opacity-70">
                      closed
                    </Badge>
                    {session.closedAt && (
                      <span className="text-xs text-muted-foreground">
                        Closed {format(new Date(session.closedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-xl font-serif group-hover:text-primary transition-colors line-clamp-2">
                    {session.title}
                  </CardTitle>
                  <CardDescription className="text-sm font-medium">
                    {getClubName(session.clubId)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-auto">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4" />
                      <span>{session.photoCount || 0} photos</span>
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
