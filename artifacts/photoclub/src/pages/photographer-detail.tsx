import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { User, Users, Calendar, ArrowLeft, Image as ImageIcon, Pencil, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  useGetPhotographer, getGetPhotographerQueryKey,
  useListPhotos, getListPhotosQueryKey,
  useUpdatePhoto,
  useGetAdminStatus, getGetAdminStatusQueryKey,
  useListThemes,
  useListClubs,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PhotoCard } from "@/components/photo-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type PhotoEdit = { title: string; themeId: string; clubId: string };

export default function PhotographerDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const photographerId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: photographer, isLoading: photographerLoading } = useGetPhotographer(photographerId, {
    query: { enabled: !!photographerId, queryKey: getGetPhotographerQueryKey(photographerId) },
  });
  const { data: photos, isLoading: photosLoading } = useListPhotos({ photographerId });
  const { data: adminStatus } = useGetAdminStatus({ query: { queryKey: getGetAdminStatusQueryKey() } });
  const { data: themes } = useListThemes();
  const { data: clubs } = useListClubs();

  const isAdmin = !!adminStatus?.isAdmin;

  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [photoEdits, setPhotoEdits] = useState<Record<number, PhotoEdit>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const updateMutation = useUpdatePhoto();

  // Derive unique themes present in this photographer's photos (for filter buttons)
  const portfolioThemes = useMemo(() => {
    if (!photos) return [];
    const seen = new Map<number, string>();
    for (const p of photos) {
      if (p.themeId && p.themeName && !seen.has(p.themeId)) {
        seen.set(p.themeId, p.themeName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [photos]);

  const visiblePhotos = useMemo(
    () => (selectedThemeId ? (photos ?? []).filter((p) => p.themeId === selectedThemeId) : (photos ?? [])),
    [photos, selectedThemeId],
  );

  const enterEditMode = () => {
    if (!photos) return;
    const edits: Record<number, PhotoEdit> = {};
    for (const p of photos) {
      edits[p.id] = {
        title: p.title || "",
        themeId: p.themeId?.toString() ?? "none",
        clubId: p.clubId?.toString() ?? "none",
      };
    }
    setPhotoEdits(edits);
    setDirtyIds(new Set());
    setEditMode(true);
  };

  const handleFieldChange = (photoId: number, field: keyof PhotoEdit, value: string) => {
    setPhotoEdits(prev => ({ ...prev, [photoId]: { ...prev[photoId], [field]: value } }));
    setDirtyIds(prev => {
      const next = new Set(prev);
      // Mark dirty by comparing against original
      const orig = photos?.find(p => p.id === photoId);
      if (!orig) return next;
      const origEdit: PhotoEdit = {
        title: orig.title || "",
        themeId: orig.themeId?.toString() ?? "none",
        clubId: orig.clubId?.toString() ?? "none",
      };
      const updated = { ...photoEdits[photoId], [field]: value };
      const isDirty = updated.title !== origEdit.title || updated.themeId !== origEdit.themeId || updated.clubId !== origEdit.clubId;
      isDirty ? next.add(photoId) : next.delete(photoId);
      return next;
    });
  };

  const handleSaveAll = async () => {
    if (dirtyIds.size === 0) { setEditMode(false); return; }
    setSaving(true);
    try {
      await Promise.all(
        [...dirtyIds].map(pid => {
          const edit = photoEdits[pid];
          return updateMutation.mutateAsync({
            id: pid,
            data: {
              title: edit.title.trim() || undefined,
              themeId: edit.themeId !== "none" ? Number(edit.themeId) : null,
              clubId: edit.clubId !== "none" ? Number(edit.clubId) : null,
            },
          });
        }),
      );
      queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetPhotographerQueryKey(photographerId) });
      toast({ title: t("photographerDetail.saveSuccess", { count: dirtyIds.size }) });
      setEditMode(false);
      setDirtyIds(new Set());
    } catch {
      toast({ title: t("common.error"), description: t("photographerDetail.saveError"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (photographerLoading) {
    return (
      <div className="container mx-auto px-4 py-12 animate-pulse">
        <div className="flex items-center gap-8 mb-12">
          <div className="w-32 h-32 rounded-full bg-muted" />
          <div className="flex-1">
            <div className="h-10 bg-muted rounded w-1/3 mb-4" />
            <div className="h-4 bg-muted rounded w-1/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!photographer) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-serif text-3xl mb-4">{t("photographerDetail.notFound")}</h2>
        <Link href="/photographers" className="text-primary hover:underline">
          {t("photographerDetail.returnLink")}
        </Link>
      </div>
    );
  }

  const themeNames = (photographer.themes ?? []).map((t) => t.name);

  return (
    <div className="flex flex-col">
      {/* Profile Header */}
      <section className="bg-secondary/30 border-b border-border/50 py-16">
        <div className="container mx-auto px-4">
          <Link
            href="/photographers"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("photographerDetail.back")}
          </Link>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-secondary overflow-hidden border-4 border-background shadow-xl shrink-0 flex items-center justify-center">
              {photographer.avatarUrl ? (
                <img
                  src={photographer.avatarUrl}
                  alt={photographer.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-16 h-16 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1">
              <h1 className="font-serif text-4xl md:text-5xl font-bold mb-3">
                {photographer.name}
              </h1>

              {themeNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {themeNames.map((name) => (
                    <Badge key={name} variant="secondary" className="font-mono text-sm px-3 py-0.5">
                      {name}
                    </Badge>
                  ))}
                </div>
              )}

              {photographer.bio && (
                <p className="text-lg text-foreground/80 mb-6 max-w-3xl leading-relaxed">
                  {photographer.bio}
                </p>
              )}

              <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-muted-foreground">
                {photographer.clubs?.map((club) => (
                  <Link
                    key={club.id}
                    href={`/clubs/${club.id}`}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    <span className="uppercase tracking-widest">{club.name}</span>
                    {club.memberSince && <span className="font-mono text-xs opacity-60">· {club.memberSince}</span>}
                  </Link>
                ))}
                <div className="flex items-center gap-2 font-mono">
                  <ImageIcon className="w-4 h-4" />
                  <span>{photographer.photoCount || 0} {t("common.photos")}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <Calendar className="w-4 h-4" />
                  <span>{t("photographerDetail.joined", { date: format(new Date(photographer.createdAt), "MMM yyyy") })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Gallery */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-3xl font-bold">{t("photographerDetail.portfolio")}</h2>
            {isAdmin && !photosLoading && !editMode && (photos?.length ?? 0) > 0 && (
              <Button variant="ghost" size="sm" onClick={enterEditMode} className="gap-1.5 self-end mb-1 text-muted-foreground hover:text-foreground">
                <Pencil className="w-4 h-4" />
                {t("photographerDetail.editPhotos")}
              </Button>
            )}
          </div>

          {!editMode && portfolioThemes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={selectedThemeId === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedThemeId(null)}
                className="text-xs font-mono"
              >
                {t("photographerDetail.allThemes")}
              </Button>
              {portfolioThemes.map((theme) => (
                <Button
                  key={theme.id}
                  variant={selectedThemeId === theme.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedThemeId(selectedThemeId === theme.id ? null : theme.id)}
                  className="text-xs font-mono"
                >
                  {theme.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {editMode ? (
          /* ── Bulk Edit List ── */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("photographerDetail.editHint")}
            </p>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {(photos ?? []).map((photo) => {
                const edit = photoEdits[photo.id];
                if (!edit) return null;
                const isDirty = dirtyIds.has(photo.id);
                const hasBlankTitle = !edit.title.trim();
                const rowClass = hasBlankTitle
                  ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20"
                  : isDirty
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/50 bg-background/50";
                return (
                  <div key={photo.id} className={`flex items-center gap-3 rounded-md p-2 border ${rowClass}`}>
                    <img
                      src={photo.imageUrl}
                      alt={photo.title}
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                    <Input
                      value={edit.title}
                      onChange={e => handleFieldChange(photo.id, "title", e.target.value)}
                      className={`flex-1 min-w-0 ${hasBlankTitle ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 focus-visible:ring-amber-400" : "bg-background"}`}
                      placeholder={t("photographerDetail.titlePlaceholder")}
                    />
                    <Select
                      value={edit.themeId}
                      onValueChange={v => handleFieldChange(photo.id, "themeId", v)}
                    >
                      <SelectTrigger className="bg-background w-36 shrink-0">
                        <SelectValue placeholder={t("photographerDetail.noTheme")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("photographerDetail.noTheme")}</SelectItem>
                        {(themes ?? []).map(th => (
                          <SelectItem key={th.id} value={th.id.toString()}>{th.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={edit.clubId}
                      onValueChange={v => handleFieldChange(photo.id, "clubId", v)}
                    >
                      <SelectTrigger className="bg-background w-40 shrink-0">
                        <SelectValue placeholder={t("photographerDetail.noClub")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("photographerDetail.noClub")}</SelectItem>
                        {(clubs ?? []).map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setEditMode(false); setDirtyIds(new Set()); }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveAll}
                disabled={saving}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("photographerDetail.saving")}</>
                ) : dirtyIds.size > 0 ? (
                  t("photographerDetail.saveChanges", { count: dirtyIds.size })
                ) : (
                  t("photographerDetail.noChanges")
                )}
              </Button>
            </div>
          </div>
        ) : photosLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col gap-3">
                <div className="aspect-[4/5] bg-muted rounded-sm" />
              </div>
            ))}
          </div>
        ) : visiblePhotos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {visiblePhotos.map((photo, i) => (
              <PhotoCard key={photo.id} photo={photo} index={i} context={`photographer:${photographerId}`} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-secondary/50 rounded-lg border border-border/50 border-dashed">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-serif text-xl font-medium mb-2">{t("photographerDetail.noPortfolio")}</h3>
            <p className="text-muted-foreground">{t("photographerDetail.noPortfolioBody")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
