import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Search, Image, TrendingUp, Users, User } from "lucide-react";
import { useListRecentPhotos, useGetStats, useListPhotographers } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { data: photos, isLoading: photosLoading } = useListRecentPhotos({ limit: 12 });
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: photographers } = useListPhotographers();

  const featuredPhotographers = photographers?.slice(0, 6) ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      setLocation(`/search?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-14 md:pt-12 md:pb-20 bg-secondary border-b border-border/50">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/50 via-background to-background" />
        <div className="container relative z-10 mx-auto px-4 max-w-4xl text-center flex flex-col items-center gap-6 md:gap-8">
          <img src="/photomatrix-logo.png" alt="PhotoMatrix" className="w-52 md:w-80 h-auto mix-blend-screen" />
          <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight">
            {t("home.heroTitle1")} <span className="text-primary italic">{t("home.heroTitle2")}</span>
          </h1>
          <p className="text-xl text-muted-foreground font-sans max-w-2xl">
            {t("home.heroSubtitle")}
          </p>

          <form onSubmit={handleSearch} className="w-full max-w-md relative mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("home.searchPlaceholder")}
              className="w-full pl-12 h-14 bg-background border-border/50 text-base focus-visible:ring-primary rounded-full shadow-lg"
            />
            <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-6">
              {t("common.find")}
            </Button>
          </form>
        </div>
      </section>

      {/* Stats Section — each card links to its page */}
      <section className="py-12 border-b border-border/50 bg-background/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard href="/photos"        icon={<Image className="w-5 h-5" />}     label={t("home.stats.photographs")}   value={stats?.totalPhotos}        loading={statsLoading} />
            <StatCard href="/clubs"         icon={<Users className="w-5 h-5" />}     label={t("home.stats.clubs")}         value={stats?.totalClubs}         loading={statsLoading} />
            <StatCard href="/photographers" icon={<User className="w-5 h-5" />}      label={t("home.stats.photographers")} value={stats?.totalPhotographers}  loading={statsLoading} />
            <StatCard href="/themes"        icon={<TrendingUp className="w-5 h-5" />} label={t("home.stats.themes")}       value={stats?.totalThemes}        loading={statsLoading} />
          </div>
        </div>
      </section>

      {/* Photographers strip */}
      {featuredPhotographers.length > 0 && (
        <section className="py-16 border-b border-border/50">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="font-serif text-3xl font-bold mb-1">{t("home.photographers.heading")}</h2>
                <p className="text-muted-foreground">{t("home.photographers.subheading")}</p>
              </div>
              <Link href="/photographers">
                <Button variant="outline" className="border-border/50 hover:bg-secondary">
                  {t("common.viewAll")}
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {featuredPhotographers.map((p) => (
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

            <div className="mt-8 text-center md:hidden">
              <Link href="/photographers">
                <Button variant="outline" className="w-full border-border/50">
                  {t("home.photographers.viewAllMobile")}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Recent Gallery */}
      <section className="py-20 container mx-auto px-4">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="font-serif text-3xl font-bold mb-2">{t("home.recent.heading")}</h2>
            <p className="text-muted-foreground">{t("home.recent.subheading")}</p>
          </div>
          <Link href="/photos">
            <Button variant="outline" className="hidden sm:flex border-border/50 hover:bg-secondary">
              {t("home.recent.viewAll")}
            </Button>
          </Link>
        </div>

        {photosLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col gap-3">
                <div className="aspect-[4/5] bg-muted rounded-sm" />
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
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
            <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-serif text-xl font-medium mb-2">{t("home.recent.empty")}</h3>
            <p className="text-muted-foreground mb-6">{t("home.recent.emptyCta")}</p>
            <Link href="/upload">
              <Button>{t("home.recent.uploadButton")}</Button>
            </Link>
          </div>
        )}

        <div className="mt-12 text-center sm:hidden">
          <Link href="/photos">
            <Button variant="outline" className="w-full border-border/50">
              {t("home.recent.viewAll")}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  href,
  icon,
  label,
  value,
  loading,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <Link href={href}>
      <div className="flex flex-col items-center justify-center p-6 text-center border border-border/50 rounded-lg bg-background hover:border-primary/50 hover:bg-secondary/30 transition-colors group cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-4 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
          {icon}
        </div>
        {loading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
        ) : (
          <div className="text-3xl font-mono font-medium tracking-tight mb-1">{value || 0}</div>
        )}
        <div className="text-xs text-muted-foreground uppercase tracking-widest">{label}</div>
      </div>
    </Link>
  );
}
