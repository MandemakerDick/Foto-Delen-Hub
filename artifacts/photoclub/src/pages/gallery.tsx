import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Search, Filter, X } from "lucide-react";
import { useListPhotos, useListClubs, useListThemes, useListPhotographers } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Gallery() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || "");
  const initialSearch = searchParams.get("search") || "";
  
  const [search, setSearch] = useState(initialSearch);
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [photographerFilter, setPhotographerFilter] = useState<string>("all");

  const { data: photos, isLoading: photosLoading } = useListPhotos();
  const { data: clubs } = useListClubs();
  const { data: themes } = useListThemes();
  const { data: photographers } = useListPhotographers();

  const filteredPhotos = useMemo(() => {
    if (!photos) return [];
    return photos.filter((photo) => {
      const matchesSearch = search === "" || 
        photo.title.toLowerCase().includes(search.toLowerCase()) || 
        (photo.description && photo.description.toLowerCase().includes(search.toLowerCase()));
      
      const matchesClub = clubFilter === "all" || photo.clubId?.toString() === clubFilter;
      const matchesTheme = themeFilter === "all" || photo.themeId?.toString() === themeFilter;
      const matchesPhotographer = photographerFilter === "all" || photo.photographerId?.toString() === photographerFilter;
      
      return matchesSearch && matchesClub && matchesTheme && matchesPhotographer;
    });
  }, [photos, search, clubFilter, themeFilter, photographerFilter]);

  const activeFiltersCount = (clubFilter !== "all" ? 1 : 0) + (themeFilter !== "all" ? 1 : 0) + (photographerFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setClubFilter("all");
    setThemeFilter("all");
    setPhotographerFilter("all");
    setSearch("");
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-4xl font-bold mb-4">{t("gallery.title")}</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          {t("gallery.subtitle")}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-10 items-start md:items-center bg-secondary/50 p-4 rounded-lg border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("gallery.searchPlaceholder")}
            className="pl-9 w-full bg-background border-border/50"
          />
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <Select value={clubFilter} onValueChange={setClubFilter}>
            <SelectTrigger className="w-[160px] bg-background border-border/50">
              <SelectValue placeholder={`${t("gallery.filterAll")} ${t("nav.clubs")}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{`${t("gallery.filterAll")} ${t("nav.clubs")}`}</SelectItem>
              {clubs?.map((club) => (
                <SelectItem key={club.id} value={club.id.toString()}>{club.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={themeFilter} onValueChange={setThemeFilter}>
            <SelectTrigger className="w-[160px] bg-background border-border/50">
              <SelectValue placeholder={`${t("gallery.filterAll")} ${t("nav.themes")}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{`${t("gallery.filterAll")} ${t("nav.themes")}`}</SelectItem>
              {themes?.map((theme) => (
                <SelectItem key={theme.id} value={theme.id.toString()}>{theme.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={photographerFilter} onValueChange={setPhotographerFilter}>
            <SelectTrigger className="w-[160px] bg-background border-border/50">
              <SelectValue placeholder={`${t("gallery.filterAll")} ${t("nav.photographers")}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{`${t("gallery.filterAll")} ${t("nav.photographers")}`}</SelectItem>
              {photographers?.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFiltersCount > 0 && (
            <Button variant="ghost" onClick={clearFilters} className="px-3">
              <X className="w-4 h-4 mr-2" />
              {t("gallery.clearFilters")}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm font-mono text-muted-foreground">
          {filteredPhotos.length} {t("common.prints")}
        </div>
        {activeFiltersCount > 0 && (
          <div className="flex gap-2">
            {clubFilter !== "all" && <Badge variant="secondary">{t("gallery.filterClub")}: {clubs?.find(c => c.id.toString() === clubFilter)?.name}</Badge>}
            {themeFilter !== "all" && <Badge variant="secondary">{t("gallery.filterTheme")}: {themes?.find(th => th.id.toString() === themeFilter)?.name}</Badge>}
            {photographerFilter !== "all" && <Badge variant="secondary">{t("gallery.filterPhotographer")}: {photographers?.find(p => p.id.toString() === photographerFilter)?.name}</Badge>}
          </div>
        )}
      </div>

      {photosLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse flex flex-col gap-3">
              <div className="aspect-[4/5] bg-muted rounded-sm"></div>
              <div className="h-5 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
          {filteredPhotos.map((photo, i) => (
            <PhotoCard key={photo.id} photo={photo} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-secondary/50 rounded-lg border border-border/50 border-dashed">
          <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-serif text-xl font-medium mb-2">{t("gallery.empty")}</h3>
          <p className="text-muted-foreground mb-6">{t("home.recent.subheading")}</p>
          <Button variant="outline" onClick={clearFilters}>{t("gallery.clearFilters")}</Button>
        </div>
      )}
    </div>
  );
}
