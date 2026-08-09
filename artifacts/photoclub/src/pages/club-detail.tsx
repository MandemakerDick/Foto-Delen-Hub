import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Users, MapPin, Calendar, ArrowLeft, Image as ImageIcon, Globe, X, Pencil, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  useGetClub, getGetClubQueryKey,
  useListPhotos, getListPhotosQueryKey,
  useListPhotographers, getListPhotographersQueryKey,
  useUpdatePhoto,
  useGetAdminStatus, getGetAdminStatusQueryKey,
  useListThemes,
  useListClubs,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PhotoCard } from "@/components/photo-card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type PhotoEdit = { title: string; themeId: string; clubId: string };

export default function ClubDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const clubId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showMembers, setShowMembers] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [photoEdits, setPhotoEdits] = useState<Record<number, PhotoEdit>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());

  const { data: club, isLoading: clubLoading } = useGetClub(clubId, {
    query: { enabled: !!clubId, queryKey: getGetClubQueryKey(clubId) },
  });

  const { data: members } = useListPhotographers(
    { clubId },
    { query: { enabled: showMembers, queryKey: getListPhotographersQueryKey({ clubId }) } },
  );

  const { data: photos, isLoading: photosLoading } = useListPhotos(
    selectedPhotographerId
      ? { photographerId: selectedPhotographerId }
      : { clubId },
  );

  const { data: adminStatus } = useGetAdminStatus({ query: { queryKey: getGetAdminStatusQueryKey() } });
  const { data: themes } = useListThemes();
  const { data: clubs } = useListClubs();

  const isAdmin = !!adminStatus?.isAdmin;

  const updateMutation = useUpdatePhoto();

  // react-helmet-async v3 + React 19: the <title> child is received as an
  // array of strings by React 19's document-metadata hoisting path, which
  // yields an empty <title>.  Set document.title imperatively instead.
  useEffect(() => {
    if (!club) return;
    const prev = document.title;
    document.title = `${club.name} — PhotoMatrix`;
    return () => { document.title = prev; };
  }, [club?.name]);

  const selectedMember = members?.find((m) => m.id === selectedPhotographerId) ?? null;

  // The gallery shown in view mode (all club photos, or filtered by member)
  const visiblePhotos = useMemo(
    () => photos ?? [],
    [photos],
  );

  const handleMemberClick = (photographerId: number) => {
    setSelectedPhotographerId((prev) => (prev === photographerId ? null : photographerId));
  };

  const handleMembersToggle = () => {
    setShowMembers((v) => {
      if (v) setSelectedPhotographerId(null);
      return !v;
    });
  };

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
    setFailedIds(new Set());
    setEditMode(true);
  };

  const handleFieldChange = (photoId: number, field: keyof PhotoEdit, value: string) => {
    setPhotoEdits(prev => ({ ...prev, [photoId]: { ...prev[photoId], [field]: value } }));
    setFailedIds(prev => {
      if (!prev.has(photoId)) return prev;
      const next = new Set(prev);
      next.delete(photoId);
      return next;
    });
    setDirtyIds(prev => {
      const next = new Set(prev);
      const orig = photos?.find(p => p.id === photoId);
      if (!orig) return next;
      const origEdit: PhotoEdit = {
        title: orig.title || "",
        themeId: orig.themeId?.toString() ?? "none",
        clubId: orig.clubId?.toString() ?? "none",
      };
      const updated = { ...photoEdits[photoId], [field]: value };
      const isDirty =
        updated.title !== origEdit.title ||
        updated.themeId !== origEdit.themeId ||
        updated.clubId !== origEdit.clubId;
      isDirty ? next.add(photoId) : next.delete(photoId);
      return next;
    });
  };

  const handleSaveAll = async () => {
    if (dirtyIds.size === 0) { setEditMode(false); return; }
    setSaving(true);
    const dirtyArr = [...dirtyIds];
    const results = await Promise.allSettled(
      dirtyArr.map(pid => {
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
    const succeeded: number[] = [];
    const failed: number[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") succeeded.push(dirtyArr[i]);
      else failed.push(dirtyArr[i]);
    });
    if (succeeded.length > 0) {
      queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetClubQueryKey(clubId) });
    }
    if (failed.length === 0) {
      toast({ title: t("clubDetail.saveSuccess", { count: dirtyIds.size }) });
      setEditMode(false);
      setDirtyIds(new Set());
      setFailedIds(new Set());
    } else {
      setDirtyIds(new Set(failed));
      setFailedIds(new Set(failed));
      if (succeeded.length > 0) {
        toast({ title: t("clubDetail.savePartialError", { succeeded: succeeded.length, failed: failed.length }), variant: "destructive" });
      } else {
        toast({ title: t("common.error"), description: t("clubDetail.saveError"), variant: "destructive" });
      }
    }
    setSaving(false);
  };

  if (clubLoading) {
    return (
      <div className="container mx-auto px-4 py-12 animate-pulse">
        <div className="h-12 bg-muted rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-muted rounded w-1/4 mb-12"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-muted rounded-sm"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-serif text-3xl mb-4">{t("clubDetail.notFound")}</h2>
        <Link href="/clubs" className="text-primary hover:underline">{t("clubDetail.returnLink")}</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Helmet>
        <meta property="og:title" content={club.name} />
        <meta property="og:description" content={club.description ?? `${club.name} on PhotoMatrix`} />
        <meta property="og:image" content={club.logoUrl ?? ""} />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Club Header */}
      <section className="bg-secondary/50 border-b border-border/50 py-16">
        <div className="container mx-auto px-4">
          <Link href="/clubs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("clubDetail.back")}
          </Link>

          <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-4 mb-4">
                {club.logoUrl ? (
                  <img
                    src={club.logoUrl}
                    alt={`${club.name} logo`}
                    className="h-16 w-auto object-contain shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                    <Users className="w-7 h-7 text-primary" />
                  </div>
                )}
                <h1 className="font-serif text-5xl font-bold">{club.name}</h1>
              </div>

              {club.description && (
                <p className="text-xl text-muted-foreground mb-6 font-serif italic">
                  "{club.description}"
                </p>
              )}

              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground font-mono">
                {club.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{club.location}</span>
                  </div>
                )}
                {club.websiteUrl && (
                  <a
                    href={club.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span>{new URL(club.websiteUrl).hostname}</span>
                  </a>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{t("clubDetail.established", { year: club.yearEstablished ?? format(new Date(club.createdAt), "yyyy") })}</span>
                </div>
              </div>
            </div>

            {/* Stats — members count is clickable */}
            <div className="flex gap-8 p-6 bg-background rounded-lg border border-border/50 shadow-sm w-full md:w-auto">
              <button
                onClick={handleMembersToggle}
                className={`text-center group focus:outline-none transition-colors ${showMembers ? "text-primary" : ""}`}
              >
                <div className="text-3xl font-mono font-medium mb-1">{club.memberCount || 0}</div>
                <div className={`text-xs uppercase tracking-widest flex items-center gap-1 justify-center transition-colors ${showMembers ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}>
                  {t("clubDetail.members")}
                  {showMembers && <X className="w-3 h-3" />}
                </div>
              </button>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-center">
                <div className="text-3xl font-mono font-medium mb-1">{club.photoCount || 0}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("clubDetail.prints")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Members panel */}
      {showMembers && (
        <section className="border-b border-border/50 bg-secondary/20 py-8">
          <div className="container mx-auto px-4">
            <h2 className="font-serif text-xl font-medium mb-5 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {t("clubDetail.membersHeading")}
            </h2>
            {!members ? (
              <div className="flex gap-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                    <div className="w-14 h-14 rounded-full bg-muted" />
                    <div className="h-3 w-12 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("clubDetail.noMembersYet")}</p>
            ) : (
              <div className="flex flex-wrap gap-5">
                {members.map((member) => {
                  const isSelected = selectedPhotographerId === member.id;
                  return (
                    <button
                      key={member.id}
                      onClick={() => handleMemberClick(member.id)}
                      className={`flex flex-col items-center gap-2 w-20 group focus:outline-none transition-opacity ${selectedPhotographerId && !isSelected ? "opacity-40" : ""}`}
                    >
                      <div className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-colors ${isSelected ? "border-primary" : "border-transparent group-hover:border-primary/50"} bg-secondary`}>
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl font-serif text-muted-foreground">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs text-center leading-tight font-medium line-clamp-2 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
                        {member.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Gallery */}
      <section className="py-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-3xl font-bold">
              {selectedMember
                ? t("clubDetail.filteringBy", { name: selectedMember.name })
                : t("clubDetail.collection")}
            </h2>
            {isAdmin && !photosLoading && !editMode && (visiblePhotos.length > 0) && !selectedPhotographerId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={enterEditMode}
                className="gap-1.5 self-end mb-1 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-4 h-4" />
                {t("clubDetail.editPhotos")}
              </Button>
            )}
          </div>
          {selectedMember && !editMode && (
            <div className="flex items-center gap-3">
              <Link href={`/photographers/${selectedMember.id}`} className="text-sm text-primary hover:underline">
                {selectedMember.name}'s full portfolio →
              </Link>
              <Button variant="outline" size="sm" onClick={() => setSelectedPhotographerId(null)}>
                <X className="w-3.5 h-3.5 mr-1.5" />
                {t("clubDetail.allPhotos")}
              </Button>
            </div>
          )}
        </div>

        {editMode ? (
          /* ── Bulk Edit List ── */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("clubDetail.editHint")}
            </p>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {(photos ?? []).map((photo) => {
                const edit = photoEdits[photo.id];
                if (!edit) return null;
                const isDirty = dirtyIds.has(photo.id);
                const hasFailed = failedIds.has(photo.id);
                const hasBlankTitle = !edit.title.trim();
                const rowClass = hasFailed
                  ? "border-destructive/60 bg-destructive/5"
                  : hasBlankTitle
                    ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20"
                    : isDirty
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/50 bg-background/50";
                return (
                  <div key={photo.id} className={`flex items-start gap-2 rounded-md p-2 border ${rowClass}`}>
                    <img
                      src={photo.imageUrl}
                      alt={photo.title}
                      className="w-20 h-20 rounded object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <Input
                        value={edit.title}
                        onChange={e => handleFieldChange(photo.id, "title", e.target.value)}
                        className={`w-full ${hasBlankTitle ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 focus-visible:ring-amber-400" : "bg-background"}`}
                        placeholder={t("clubDetail.titlePlaceholder")}
                      />
                      <div className="flex gap-1.5">
                        <Select
                          value={edit.themeId}
                          onValueChange={v => handleFieldChange(photo.id, "themeId", v)}
                        >
                          <SelectTrigger className="bg-background flex-1 min-w-0">
                            <SelectValue placeholder={t("clubDetail.noTheme")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("clubDetail.noTheme")}</SelectItem>
                            {(themes ?? []).map(th => (
                              <SelectItem key={th.id} value={th.id.toString()}>{th.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={edit.clubId}
                          onValueChange={v => handleFieldChange(photo.id, "clubId", v)}
                        >
                          <SelectTrigger className="bg-background flex-1 min-w-0">
                            <SelectValue placeholder={t("clubDetail.noClub")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("clubDetail.noClub")}</SelectItem>
                            {(clubs ?? []).map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setEditMode(false); setDirtyIds(new Set()); setFailedIds(new Set()); }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveAll}
                disabled={saving}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("clubDetail.saving")}</>
                ) : dirtyIds.size > 0 ? (
                  t("clubDetail.saveChanges", { count: dirtyIds.size })
                ) : (
                  t("clubDetail.noChanges")
                )}
              </Button>
            </div>
          </div>
        ) : photosLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col gap-3">
                <div className="aspect-[4/5] bg-muted rounded-sm"></div>
                <div className="h-5 bg-muted rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : visiblePhotos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {visiblePhotos.map((photo, i) => (
              <PhotoCard key={photo.id} photo={photo} index={i} context={`club:${clubId}`} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-secondary/50 rounded-lg border border-border/50 border-dashed">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-serif text-xl font-medium mb-2">{t("clubDetail.noPhotos")}</h3>
            <p className="text-muted-foreground mb-6">{t("clubDetail.noPhotosBody")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
