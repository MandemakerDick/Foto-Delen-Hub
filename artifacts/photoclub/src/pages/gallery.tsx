import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Filter, Shuffle, CalendarDays, ArrowDownUp, X } from "lucide-react";
import { useListPhotos, useListClubs, useListThemes, useListPhotographers } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchBar } from "@/components/search-bar";

type SortOption = "newest" | "oldest" | "likes" | "comments" | "random";

function randomRank(id: number, seed: number) {
  let value = (id * 1103515245 + seed) | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export default function Gallery() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || "");
  const initialSearch = searchParams.get("search") || "";
  
  const [search, setSearch] = useState(initialSearch);
  const [clubFilter, setClubFilter] = useState<string[]>([]);
  const [themeFilter, setThemeFilter] = useState<string[]>([]);
  const [photographerFilter, setPhotographerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [randomSeed, setRandomSeed] = useState(() => Date.now());

  const { data: photos, isLoading: photosLoading } = useListPhotos();
  const { data: clubs } = useListClubs();
  const { data: themes } = useListThemes();
  const { data: photographers } = useListPhotographers();

  const filteredPhotos = useMemo(() => {
    if (!photos) return [];
    return photos.filter((photo) => {
      const matchesSearch = search === "" || 
        photo.title.toLowerCase().includes(search.toLowerCase()) || 
        (photo.description && photo.description.toLowerCase().includes(search.toLowerCase())) ||
        (photo.photographerName && photo.photographerName.toLowerCase().includes(search.toLowerCase())) ||
        (photo.themeName && photo.themeName.toLowerCase().includes(search.toLowerCase()));
      
      const matchesClub = clubFilter.length === 0 || clubFilter.includes(photo.clubId?.toString() ?? "");
      const matchesTheme = themeFilter.length === 0 || themeFilter.includes(photo.themeId?.toString() ?? "");
      const matchesPhotographer = photographerFilter === "all" || photo.photographerId?.toString() === photographerFilter;
      const createdAt = new Date(photo.createdAt);
      const matchesStartDate = !dateFrom || createdAt >= new Date(`${dateFrom}T00:00:00`);
      const matchesEndDate = !dateTo || createdAt <= new Date(`${dateTo}T23:59:59.999`);

      return matchesSearch && matchesClub && matchesTheme && matchesPhotographer && matchesStartDate && matchesEndDate;
    });
  }, [photos, search, clubFilter, themeFilter, photographerFilter, dateFrom, dateTo]);

  const sortedPhotos = useMemo(() => {
    const result = [...filteredPhotos];
    const newestFirst = (a: typeof result[number], b: typeof result[number]) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    if (sortBy === "oldest") return result.sort((a, b) => -newestFirst(a, b));
    if (sortBy === "likes") return result.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0) || newestFirst(a, b));
    if (sortBy === "comments") return result.sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0) || newestFirst(a, b));
    if (sortBy === "random") return result.sort((a, b) => randomRank(a.id, randomSeed) - randomRank(b.id, randomSeed));
    return result.sort(newestFirst);
  }, [filteredPhotos, randomSeed, sortBy]);

  const activeFiltersCount = clubFilter.length + themeFilter.length + (photographerFilter !== "all" ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const toggleFilter = (
    value: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const clearFilters = () => {
    setClubFilter([]);
    setThemeFilter([]);
    setPhotographerFilter("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    setSearch(query);
    setLocation(query ? `/photos?search=${encodeURIComponent(query)}` : "/photos");
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-4xl font-bold mb-4">{t("gallery.title")}</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          {t("gallery.subtitle")}
        </p>
      </div>

      <SearchBar
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onSubmit={handleSearchSubmit}
        placeholder={t("home.searchPlaceholder")}
        className="mb-4"
      />

      <div data-testid="gallery-filter-bar" className="mb-10 bg-secondary/50 p-4 rounded-lg border border-border/50">
        <div className="flex min-w-0 flex-wrap gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button data-testid="gallery-club-filter" type="button" variant="outline" className="flex-1 min-w-[150px] justify-between bg-background border-border/50 font-normal">
                <span>{clubFilter.length ? t("gallery.filterSelected", { count: clubFilter.length, label: t("nav.clubs") }) : `${t("gallery.filterAll")} ${t("nav.clubs")}`}</span>
                <Filter className="w-4 h-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-72 overflow-y-auto">
              <p className="mb-3 text-sm font-medium">{t("gallery.filterClubs")}</p>
              <div className="space-y-2">
                {clubs?.map((club) => (
                  <label key={club.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={clubFilter.includes(String(club.id))} onCheckedChange={() => toggleFilter(String(club.id), clubFilter, setClubFilter)} />
                    {club.name}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button data-testid="gallery-theme-filter" type="button" variant="outline" className="flex-1 min-w-[150px] justify-between bg-background border-border/50 font-normal">
                <span>{themeFilter.length ? t("gallery.filterSelected", { count: themeFilter.length, label: t("nav.themes") }) : `${t("gallery.filterAll")} ${t("nav.themes")}`}</span>
                <Filter className="w-4 h-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-72 overflow-y-auto">
              <p className="mb-3 text-sm font-medium">{t("gallery.filterThemes")}</p>
              <div className="space-y-2">
                {themes?.map((theme) => (
                  <label key={theme.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={themeFilter.includes(String(theme.id))} onCheckedChange={() => toggleFilter(String(theme.id), themeFilter, setThemeFilter)} />
                    {theme.name}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Select value={photographerFilter} onValueChange={setPhotographerFilter}>
            <SelectTrigger className="flex-1 min-w-[160px] bg-background border-border/50">
              <SelectValue placeholder={`${t("gallery.filterAll")} ${t("nav.photographers")}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{`${t("gallery.filterAll")} ${t("nav.photographers")}`}</SelectItem>
              {photographers?.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => {
            const next = value as SortOption;
            setSortBy(next);
            if (next === "random") setRandomSeed(Date.now());
          }}>
            <SelectTrigger
              data-testid="gallery-sort"
              icon={<ArrowDownUp className="h-4 w-4 opacity-60" />}
              className="flex-1 min-w-[155px] bg-background border-border/50"
            >
              <SelectValue placeholder={t("gallery.sortLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("gallery.sortNewest")}</SelectItem>
              <SelectItem value="oldest">{t("gallery.sortOldest")}</SelectItem>
              <SelectItem value="likes">{t("gallery.sortLikes")}</SelectItem>
              <SelectItem value="comments">{t("gallery.sortComments")}</SelectItem>
              <SelectItem value="random">{t("gallery.sortRandom")}</SelectItem>
            </SelectContent>
          </Select>
          {sortBy === "random" && (
            <Button type="button" variant="outline" size="icon" onClick={() => setRandomSeed(Date.now())} aria-label={t("gallery.shuffle")}>
              <Shuffle className="w-4 h-4" />
            </Button>
          )}
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-1.5">
            <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" />
            <Input data-testid="gallery-date-from" aria-label={t("gallery.dateFrom")} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-7 w-28 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0" />
            <span className="text-xs text-muted-foreground shrink-0">{t("gallery.dateTo")}</span>
            <Input data-testid="gallery-date-to" aria-label={t("gallery.dateTo")} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-7 w-28 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0" />
          </div>

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
          {sortedPhotos.length} {t("common.prints")}
        </div>
        {activeFiltersCount > 0 && (
          <div className="flex gap-2">
            {clubFilter.map((id) => <Badge key={id} variant="secondary">{t("gallery.filterClub")}: {clubs?.find(c => c.id.toString() === id)?.name}</Badge>)}
            {themeFilter.map((id) => <Badge key={id} variant="secondary">{t("gallery.filterTheme")}: {themes?.find(th => th.id.toString() === id)?.name}</Badge>)}
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
      ) : sortedPhotos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
          {sortedPhotos.map((photo, i) => (
            <PhotoCard key={photo.id} photo={photo} index={i} context="gallery" />
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
