import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDateLocale } from "@/hooks/use-date-locale";
import type { ReviewSession } from "@workspace/api-client-react";

interface ArchiveCardProps {
  session: ReviewSession;
  clubName: string;
}

export function ArchiveCard({ session, clubName }: ArchiveCardProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group bg-card/50">
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            <Badge variant="outline" className="uppercase text-xs tracking-wider opacity-70">
              {t("archive.closedBadge")}
            </Badge>
            {session.closedAt && (
              <span className="text-xs text-muted-foreground">
                {t("archive.closedOn", {
                  date: format(new Date(session.closedAt), "PP", { locale: dateLocale }),
                })}
              </span>
            )}
          </div>
          <CardTitle className="text-xl font-serif group-hover:text-primary transition-colors line-clamp-2">
            {session.title}
          </CardTitle>
          <CardDescription className="text-sm font-medium">
            {clubName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-auto">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" />
              <span>{t("archive.photoCount", { count: session.photoCount || 0 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
