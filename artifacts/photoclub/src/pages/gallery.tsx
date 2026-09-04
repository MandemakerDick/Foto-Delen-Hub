import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Filter, Shuffle, CalendarDays, ArrowDownUp, Layers, Share2, X } from "lucide-react";
import { useListPhotos, useListClubs, useListThemes, useListPhotographers } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchBar } from "@/components/search-bar";
import { useToast } from "@/hooks/use-toast";

type SortOption = "newest" | "oldest" | "photographer" | "likes" | "comments" | "random";
type GroupOption = "none" | "club" | "photographer" | "theme";

const sortOptions = new Set<SortOption>(["newest", "oldest", "photographer", "likes", "comments", "random"]);
const groupOptions = new Set<GroupOption>(["none", "club", "photographer", "theme"]);

function parseIdList(value: string | null) {
  return value?.split(",").filter((id) => /^\d+$/.test(id)) ?? [];
}

function parseDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function randomRank(id: number, seed: number) {
  let value = (id * 1103515245 + seed) | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export default function Gallery() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialGroupParam = initialParams.get("group");
  const initialGroup = initialGroupParam as GroupOption | null;
  const initialSort = initialParams.get("sort") as SortOption | null;
  const initialSeed = Number(initialParams.get("seed"));

  const [search, setSearch] = useState(initialParams.get("search") ?? "");
  const [clubFilter, setClubFilter] = useState<string[]>(() => parseIdList(initialParams.get("clubs")));
  const [themeFilter, setThemeFilter] = useState<string[]>(() => parseIdList(initialParams.get("themes")));
  const [photographerFilter, setPhotographerFilter] = useState<string>(() => {
    const photographer = initialParams.get("photographer");
    return photographer && /^\d+$/.test(photographer) ? photographer : "all";
  });
  const [dateFrom, setDateFrom] = useState(() => parseDate(initialParams.get("from")));
  const [dateTo, setDateTo] = useState(() => parseDate(initialParams.get("to")));
  const [groupBy, setGroupBy] = useState<GroupOption>(
    initialSort === "photographer"
      ? "photographer"
      : initialGroup && groupOptions.has(initialGroup)
        ? initialGroup
        : "none",
  );
  const [sortBy, setSortBy] = useState<SortOption>(
    initialSort && sortOptions.has(initialSort)
      ? initialSort
      : initialGroupParam === "random"
        ? "random"
        : "newest",
  );
  const [randomSeed, setRandomSeed] = useState(
    Number.isSafeInteger(initialSeed) && initialSeed > 0 ? initialSeed : Date.now(),
  );

  const shareablePath = useMemo(() => {
    const params = new URLSearchParams();
    const trimmedSearch = search.trim();
    if (trimmedSearch) params.set("search", trimmedSearch);
    if (clubFilter.length) params.set("clubs", clubFilter.join(","));
    if (themeFilter.length) params.set("themes", themeFilter.join(","));
    if (photographerFilter !== "all") params.set("photographer", photographerFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (groupBy !== "none") params.set("group", groupBy);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (sortBy === "random") params.set("seed", String(randomSeed));
    const query = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ""}`;
  }, [clubFilter, dateFrom, dateTo, groupBy, photographerFilter, randomSeed, search, sortBy, themeFilter]);

  useEffect(() => {
    window.history.replaceState(window.history.state, "", shareablePath);
  }, [shareablePath]);

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

    if (sortBy === "random") {
      return result.sort((a, b) => randomRank(a.id, randomSeed) - randomRank(b.id, randomSeed));
    }
    if (sortBy === "photographer") {
      return result.sort((a, b) => {
        const photographerCompare = (a.photographerName ?? "").localeCompare(
          b.photographerName ?? "",
          undefined,
          { sensitivity: "base" },
        );
        if (photographerCompare !== 0) return photographerCompare;
        const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || newestFirst(a, b);
      });
    }
    if (sortBy === "oldest") return result.sort((a, b) => -newestFirst(a, b));
    if (sortBy === "likes") return result.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0) || newestFirst(a, b));
    if (sortBy === "comments") return result.sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0) || newestFirst(a, b));
    return result.sort(newestFirst);
  }, [filteredPhotos, randomSeed, sortBy]);

  const groupedPhotos = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "all", label: "", photos: sortedPhotos }];
    }

    const groups = new Map<string, { key: string; label: string; photos: typeof sortedPhotos }>();
    for (const photo of sortedPhotos) {
      const key =
        groupBy === "club"
          ? photo.clubId?.toString() ?? "none"
          : groupBy === "photographer"
            ? photo.photographerId?.toString() ?? "none"
            : photo.themeId?.toString() ?? "none";
      const label =
        groupBy === "club"
          ? photo.clubName ?? t("gallery.ungroupedClub")
          : groupBy === "photographer"
            ? photo.photographerName ?? t("gallery.ungroupedPhotographer")
            : photo.themeName ?? t("gallery.ungroupedTheme");
      const existing = groups.get(key);
      if (existing) {
        existing.photos.push(photo);
      } else {
        groups.set(key, { key, label, photos: [photo] });
      }
    }
    return Array.from(groups.values());
  }, [groupBy, sortedPhotos, t]);

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
    setSearch((current) => current.trim());
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(shareablePath, window.location.origin).toString());
      toast({ title: t("gallery.shareCopied") });
    } catch {
      toast({
        title: t("gallery.shareFailed"),
        description: t("gallery.shareFailedDescription"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-4xl font-bold mb-4">{t("gallery.title")}</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          {t("gallery.subtitle")}
        </p>
      </div>

      <div className="mb-4 flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSubmit={handleSearchSubmit}
          placeholder={t("home.searchPlaceholder")}
          className="min-w-0 flex-1"
        />
        <Button
          data-testid="gallery-share"
          type="button"
          variant="outline"
          onClick={copyShareLink}
          className="h-9 self-start shrink-0 gap-2 rounded-full px-6 sm:self-auto"
        >
          <Share2 className="w-4 h-4" />
          {t("gallery.shareView")}
        </Button>
      </div>

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
            <SelectTrigger data-testid="gallery-photographer-filter" className="flex-1 min-w-[160px] bg-background border-border/50">
              <SelectValue placeholder={`${t("gallery.filterAll")} ${t("nav.photographers")}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{`${t("gallery.filterAll")} ${t("nav.photographers")}`}</SelectItem>
              {photographers?.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="mb-2 mt-4 text-xs leading-relaxed text-muted-foreground">
          {t("gallery.viewControlsHelp")}
        </p>
        <div className="flex min-w-0 flex-wrap gap-3">
          <Select value={groupBy} onValueChange={(value) => {
            const next = value as GroupOption;
            setGroupBy(next);
            if (sortBy === "photographer" && next !== "photographer") {
              setSortBy("newest");
            }
          }}>
            <SelectTrigger
              data-testid="gallery-group-by"
              icon={<Layers className="h-4 w-4 opacity-60" />}
              className="flex-1 min-w-[170px] bg-background border-border/50"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-muted-foreground">{t("gallery.groupByPrefix")}:</span>
                <SelectValue placeholder={t("gallery.groupByLabel")} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("gallery.groupByNone")}</SelectItem>
              <SelectItem value="club">{t("gallery.groupByClub")}</SelectItem>
              <SelectItem value="photographer">{t("gallery.groupByPhotographer")}</SelectItem>
              <SelectItem value="theme">{t("gallery.groupByTheme")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => {
            const next = value as SortOption;
            setSortBy(next);
            if (next === "photographer") setGroupBy("photographer");
            if (next === "random") setRandomSeed(Date.now());
          }}>
            <SelectTrigger
              data-testid="gallery-sort"
              icon={<ArrowDownUp className="h-4 w-4 opacity-60" />}
              className="flex-1 min-w-[155px] bg-background border-border/50"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-muted-foreground">{t("gallery.sortByPrefix")}:</span>
                <SelectValue placeholder={t("gallery.sortLabel")} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("gallery.sortNewest")}</SelectItem>
              <SelectItem value="oldest">{t("gallery.sortOldest")}</SelectItem>
              <SelectItem value="photographer">{t("gallery.sortPhotographer")}</SelectItem>
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
          <div className="flex max-w-full items-center gap-1.5 rounded-md border border-border/50 bg-background px-2 py-1.5 sm:gap-2 sm:px-3">
            <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" />
            <Input data-testid="gallery-date-from" aria-label={t("gallery.dateFrom")} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-7 w-24 sm:w-28 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0" />
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{t("gallery.dateTo")}</span>
            <Input data-testid="gallery-date-to" aria-label={t("gallery.dateTo")} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-7 w-24 sm:w-28 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0" />
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
        <div className="space-y-12">
          {groupedPhotos.map((group) => (
            <section key={group.key} className="space-y-6">
              {group.label && (
                <div className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-3">
                  <h2 className="font-serif text-2xl font-bold">{group.label}</h2>
                  <span className="text-xs font-mono text-muted-foreground">
                    {group.photos.length} {t("common.prints")}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
                {group.photos.map((photo, i) => (
                  <PhotoCard key={photo.id} photo={photo} index={i} context="gallery" />
                ))}
              </div>
            </section>
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
