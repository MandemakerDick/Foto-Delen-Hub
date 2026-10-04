import { useParams, Link, useSearch, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Calendar, ArrowLeft, ChevronLeft, ChevronRight, MoreHorizontal, User, Users, Tag, MessageCircle, Send, Trash2, Pencil, X } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetPhoto,
  getGetPhotoQueryKey,
  useListPhotos,
  getListPhotosQueryKey,
  useTogglePhotoLike,
  useGetPhotoLikeStatus,
  getGetPhotoLikeStatusQueryKey,
  getListLikedPhotosQueryKey,
  useDeletePhoto,
  useUpdatePhoto,
  useListClubs,
  useListThemes,
  useListComments,
  getListCommentsQueryKey,
  useCreateComment,
  useDeleteComment,
  useGetAdminStatus,
  getGetAdminStatusQueryKey,
  useProposeTheme,
} from "@workspace/api-client-react";
import { SignInButton, useAuth } from "@clerk/react";
import { useMyProfile } from "@/hooks/use-my-profile";
import { ProfileLoadNotice } from "@/components/profile-load-notice";
import { useGalleryNavigation } from "@/hooks/use-gallery-navigation";
import { safeGalleryPath } from "@/lib/gallery-view";
import { useDateLocale } from "@/hooks/use-date-locale";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PhotoDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const photoId = Number(id);
  const search = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isSignedIn, userId } = useAuth();

  // Always start at the top of the page regardless of scroll position in the gallery
  useEffect(() => { window.scrollTo(0, 0); }, [photoId]);

  // Parse navigation context from ?ctx= query param
  const ctx = new URLSearchParams(search).get("ctx") ?? "gallery";
  const [ctxType, ctxId] = ctx.includes(":") ? ctx.split(":") : [ctx, ""];
  const contextId = Number(ctxId);
  const rawView = new URLSearchParams(search).get("view");
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const galleryView = ctxType === "gallery" ? safeGalleryPath(rawView, base) : null;
  const galleryNavigation = useGalleryNavigation(galleryView, photoId);
  const useGallerySelection = ctxType === "gallery" && rawView !== null;
  const backHref =
    galleryView ? galleryView.slice(base.length) :
    ctxType === "photographer" && Number.isInteger(contextId) && contextId > 0
      ? `/photographers/${contextId}`
      : ctxType === "club" && Number.isInteger(contextId) && contextId > 0
        ? `/clubs/${contextId}`
        : ctxType === "theme" && Number.isInteger(contextId) && contextId > 0
          ? `/themes/${contextId}`
          : "/photos";
  const backLabel =
    ctxType === "photographer"
      ? t("photoDetail.backToPhotographer")
      : ctxType === "club"
        ? t("photoDetail.backToClub")
        : ctxType === "theme"
          ? t("photoDetail.backToTheme")
          : t("photoDetail.back");
  const listParams =
    ctxType === "photographer" ? { photographerId: Number(ctxId) } :
    ctxType === "club"         ? { clubId: Number(ctxId) } :
    ctxType === "theme"        ? { themeId: Number(ctxId) } :
    {};
  const { data: ctxPhotos = [] } = useListPhotos(listParams, {
    query: { enabled: !useGallerySelection, queryKey: getListPhotosQueryKey(listParams) },
  });
  const ctxIndex = ctxPhotos.findIndex((p) => p.id === photoId);
  const previousId = useGallerySelection ? galleryNavigation.previous : ctxIndex > 0 ? ctxPhotos[ctxIndex - 1].id : null;
  const nextId = useGallerySelection ? galleryNavigation.next : ctxIndex !== -1 && ctxIndex < ctxPhotos.length - 1 ? ctxPhotos[ctxIndex + 1].id : null;
  const ctxParam = galleryView ? `?${new URLSearchParams({ ctx: "gallery", view: galleryView })}` :
    ctx !== "gallery" ? `?ctx=${encodeURIComponent(ctx)}` : "";
  const queryClient = useQueryClient();

  const { data: photo, isLoading, error, refetch: retryPhoto, isFetching: photoFetching } = useGetPhoto(photoId, {
    query: { enabled: !!photoId, queryKey: getGetPhotoQueryKey(photoId) },
  });

  const { data: comments = [], isLoading: commentsLoading } = useListComments(photoId, {
    query: { enabled: !!photoId, queryKey: getListCommentsQueryKey(photoId) },
  });
  const { data: likeStatus } = useGetPhotoLikeStatus(photoId, {
    query: {
      enabled: !!photoId && !!isSignedIn,
      queryKey: [...getGetPhotoLikeStatusQueryKey(photoId), userId] as const,
    },
  });

  const likeMutation = useTogglePhotoLike();
  const deleteMutation = useDeletePhoto();
  const updateMutation = useUpdatePhoto();
  const createCommentMutation = useCreateComment();
  const deleteCommentMutation = useDeleteComment();

  const { profile: myProfile, error: profileError, refetch: retryProfile } = useMyProfile();
  const { data: adminStatus } = useGetAdminStatus({ query: { queryKey: getGetAdminStatusQueryKey() } });
  const dateLocale = useDateLocale();

  const { data: allClubs } = useListClubs();
  const { data: themes } = useListThemes();
  // Non-admins may only reassign a photo to a club they belong to.
  const isAdmin = !!adminStatus?.isAdmin;
  const clubs = isAdmin ? allClubs : allClubs?.filter((c) => myProfile?.clubs?.some((pc) => pc.id === c.id));

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editClubId, setEditClubId] = useState<string>("none");
  const [editThemeId, setEditThemeId] = useState<string>("none");

  const [commentBody, setCommentBody] = useState("");
  const [showPropose, setShowPropose] = useState(false);
  const [proposedName, setProposedName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const proposeThemeMutation = useProposeTheme();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex flex-col md:flex-row gap-12 animate-pulse">
        <div className="w-full md:w-2/3 aspect-[4/3] bg-muted rounded-sm" />
        <div className="w-full md:w-1/3 flex flex-col gap-6">
          <div className="h-10 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <Separator />
          <div className="h-24 bg-muted rounded w-full" />
        </div>
      </div>
    );
  }

  const notFound = error && typeof error === "object" && "status" in error && error.status === 404;
  if (notFound || (!error && !photo)) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-serif text-3xl mb-4">{t("photoDetail.notFound")}</h2>
        <p className="text-muted-foreground mb-8">{t("photoDetail.notFoundBody")}</p>
        <Link href={backHref}>
          <Button variant="outline">{t("photoDetail.returnLink")}</Button>
        </Link>
      </div>
    );
  }

  if (!photo) {
    return (
      <div role="alert" data-testid="photo-load-error" className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-serif text-3xl mb-4">{t("photoDetail.loadErrorTitle")}</h2>
        <p className="text-muted-foreground mb-8">{t("photoDetail.loadErrorBody")}</p>
        <Button disabled={photoFetching} onClick={() => void retryPhoto()}>{t("gallery.retry")}</Button>
        <Link href={backHref} className="ml-3"><Button variant="outline">{backLabel}</Button></Link>
      </div>
    );
  }

  const loadNextPhoto = async () => {
    const id = await galleryNavigation.loadNext();
    if (id !== null) navigate(`/photos/${id}${ctxParam}`);
  };

  const handleProposeTheme = () => {
    if (!proposedName.trim()) return;
    proposeThemeMutation.mutate(
      { data: { name: proposedName.trim() } },
      {
        onSuccess: () => {
          toast({ title: t("upload.proposeThemeSuccess") });
          setProposedName("");
          setShowPropose(false);
        },
        onError: () => toast({ title: t("common.error"), description: t("upload.proposeThemeError"), variant: "destructive" }),
      },
    );
  };

  const handleLike = () => {
    likeMutation.mutate(
      { id: photoId },
      {
        onSuccess: ({ photo: updatedPhoto, liked }) => {
          queryClient.setQueryData(getGetPhotoQueryKey(photoId), updatedPhoto);
          queryClient.setQueryData([...getGetPhotoLikeStatusQueryKey(photoId), userId] as const, { liked });
          queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListLikedPhotosQueryKey() });
          if (photo?.photographerId) {
            queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey({ photographerId: photo.photographerId }) });
          }
          toast({ title: liked ? t("likedPhotos.saved") : t("likedPhotos.removed") });
        },
        onError: () => toast({ title: t("common.error"), description: t("toasts.likeError"), variant: "destructive" }),
      },
    );
  };

  const likeButton = isSignedIn ? (
    <Button
      onClick={handleLike}
      disabled={likeMutation.isPending}
      variant="outline"
      aria-pressed={!!likeStatus?.liked}
      className="gap-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
    >
      <Heart className={`w-4 h-4 ${likeStatus?.liked ? "fill-current" : ""} ${likeMutation.isPending ? "animate-pulse" : ""}`} />
      <span className="font-mono">{photo.likeCount || 0}</span>
      <span className="sr-only">{likeStatus?.liked ? t("photoDetail.unlike") : t("photoDetail.like")}</span>
    </Button>
  ) : (
    <SignInButton mode="modal">
      <Button variant="outline" className="gap-2 border-primary/50 text-primary">
        <Heart className="w-4 h-4" />
        <span className="font-mono">{photo.likeCount || 0}</span>
        <span className="sr-only">{t("photoDetail.signInToLike")}</span>
      </Button>
    </SignInButton>
  );

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: photoId },
      {
        onSuccess: () => {
          toast({ title: t("toasts.removedTitle"), description: t("toasts.removedDesc") });
          window.location.href = "/photos";
        },
        onError: () => toast({ title: t("common.error"), description: t("toasts.removeError"), variant: "destructive" }),
      },
    );
  };

  const openEdit = () => {
    setEditTitle(photo?.title ?? "");
    setEditDescription(photo?.description ?? "");
    setEditClubId(photo?.clubId?.toString() ?? "none");
    setEditThemeId(photo?.themeId?.toString() ?? "none");
    setEditOpen(true);
  };

  const handleEdit = () => {
    updateMutation.mutate(
      {
        id: photoId,
        data: {
          title: editTitle || undefined,
          description: editDescription || undefined,
          clubId: editClubId !== "none" ? Number(editClubId) : null,
          themeId: editThemeId !== "none" ? Number(editThemeId) : null,
        },
      },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetPhotoQueryKey(photoId), updated);
          setEditOpen(false);
          toast({ title: t("toasts.savedTitle"), description: t("toasts.savedDesc") });
        },
        onError: () => toast({ title: t("common.error"), description: t("toasts.saveError"), variant: "destructive" }),
      },
    );
  };

  const handleComment = () => {
    if (!commentBody.trim()) {
      toast({ title: t("toasts.emptyCommentTitle"), description: t("toasts.emptyCommentDesc"), variant: "destructive" });
      return;
    }
    createCommentMutation.mutate(
      {
        id: photoId,
        data: {
          body: commentBody.trim(),
          ...(myProfile ? { photographerId: myProfile.id } : {}),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(photoId) });
          queryClient.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
          queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
          if (photo?.photographerId) {
            queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey({ photographerId: photo.photographerId }) });
          }
          setCommentBody("");
          toast({ title: t("toasts.commentPostedTitle"), description: t("toasts.commentPostedDesc") });
        },
        onError: () => toast({ title: t("common.error"), description: t("toasts.commentPostError"), variant: "destructive" }),
      },
    );
  };

  const handleDeleteComment = (commentId: number) => {
    deleteCommentMutation.mutate(
      { id: photoId, commentId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(photoId) });
          queryClient.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
          queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
          if (photo?.photographerId) {
            queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey({ photographerId: photo.photographerId }) });
          }
          toast({ title: t("toasts.commentRemovedTitle") });
        },
        onError: () => toast({ title: t("common.error"), description: t("toasts.commentDeleteError"), variant: "destructive" }),
      },
    );
  };

  const canEdit = !!(myProfile?.id === photo.photographerId || adminStatus?.isAdmin);

  /** Action dropdown — rendered in both the mobile header and the desktop sidebar */
  const actionMenu = canEdit ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-testid="photo-action-menu" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0" aria-label="Photo actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={openEdit} className="cursor-pointer gap-2">
          <Pencil className="h-3.5 w-3.5" />
          {t("photoDetail.edit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setDeleteOpen(true)}
          className="text-destructive focus:bg-destructive/10 cursor-pointer gap-2"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("photoDetail.remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  /** Metadata rows — rendered in the desktop sidebar (and partially reused for mobile) */
  const metaRows = (
    <>
      {photo.description && (
        <div className="mb-8 text-lg leading-relaxed text-foreground/90 font-serif break-words overflow-hidden">
          {photo.description}
        </div>
      )}

      <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground font-mono">
        <Calendar className="w-4 h-4" />
        <span>{format(new Date(photo.createdAt), "d MMMM yyyy", { locale: dateLocale })}</span>
      </div>

      {/* Like Action */}
      <div className="flex items-center gap-4 mb-8 bg-secondary/30 p-4 rounded-lg border border-border/50">
        {likeButton}
      </div>

      <Separator className="mb-8" />

      <div className="flex flex-col gap-6">
        {/* Photographer */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
            {photo.photographerAvatarUrl ? (
              <img src={photo.photographerAvatarUrl} alt={photo.photographerName || ""} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("photoDetail.photographer")}</div>
            <Link href={`/photographers/${photo.photographerId}`} className="font-medium text-lg hover:text-primary transition-colors inline-block">
              {photo.photographerName || t("common.unknown")}
            </Link>
          </div>
        </div>

        {/* Club */}
        {photo.clubId && (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("photoDetail.community")}</div>
              <Link href={`/clubs/${photo.clubId}`} className="font-medium text-lg hover:text-primary transition-colors inline-block">
                {photo.clubName}
              </Link>
            </div>
          </div>
        )}

        {/* Theme */}
        {photo.themeId && (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
              <Tag className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("photoDetail.theme")}</div>
              <Link href={`/photos?themeId=${photo.themeId}`} className="font-medium text-lg hover:text-primary transition-colors inline-block">
                <Badge variant="outline" className="text-sm font-normal py-1 border-primary/30 text-foreground">
                  {photo.themeName}
                </Badge>
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <ProfileLoadNotice error={profileError} retry={retryProfile} background={myProfile !== undefined} publicView />
      {error && (
        <div role="alert" data-testid="photo-load-error" className="mb-6 rounded-lg border border-destructive/40 p-4">
          <p className="mb-3">{t("photoDetail.loadErrorBody")}</p>
          <Button disabled={photoFetching} onClick={() => void retryPhoto()}>{t("gallery.retry")}</Button>
        </div>
      )}
      {useGallerySelection && (!galleryView || galleryNavigation.unavailable) && (
        <p role="status" className="mb-6 text-sm text-muted-foreground">{t("photoDetail.selectionUnavailable")}</p>
      )}
      {galleryNavigation.failed && (
        <div role="alert" data-testid="photo-navigation-error" className="mb-6">
          <p className="mb-3 text-sm text-muted-foreground">{t("photoDetail.nextLoadError")}</p>
          <Button disabled={galleryNavigation.pending} onClick={() => void loadNextPhoto()}>{t("gallery.retry")}</Button>
        </div>
      )}
      {photo && (
        <Helmet>
          <title>{photo.title} — PhotoMatrix</title>
          <meta property="og:title" content={photo.title} />
          <meta property="og:description" content={photo.description ?? `A photograph by ${photo.photographerName || "a PhotoMatrix member"}`} />
          <meta property="og:image" content={photo.imageUrl} />
          <meta property="og:type" content="article" />
          {/* Canonical URL — prevents duplicate-content signals when the same photo is
              shared via different URL variants (e.g. with ?context=gallery:5 appended) */}
          <meta property="og:url" content={`${window.location.origin}/photos/${photo.id}`} />
          <link rel="canonical" href={`${window.location.origin}/photos/${photo.id}`} />
        </Helmet>
      )}

      {/* Edit dialog — single portal, controlled via editOpen state */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{t("photoDetail.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">{t("photoDetail.title")}</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">{t("photoDetail.description")}</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="resize-none h-24 bg-background font-serif"
                placeholder={t("photoDetail.artistStatement")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("photoDetail.community")}</Label>
                <Select value={editClubId} onValueChange={setEditClubId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={t("photoDetail.none")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("photoDetail.none")}</SelectItem>
                    {clubs?.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("photoDetail.theme")}</Label>
                <Select value={editThemeId} onValueChange={setEditThemeId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={t("photoDetail.none")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("photoDetail.none")}</SelectItem>
                    {themes?.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id.toString()}>{theme.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!showPropose ? (
                  <button
                    type="button"
                    onClick={() => setShowPropose(true)}
                    className="mt-2 w-full text-sm font-medium text-primary border border-primary/40 rounded-md py-1.5 px-3 hover:bg-primary/10 transition-colors text-left"
                  >
                    + {t("upload.proposeTheme")}
                  </button>
                ) : (
                  <div className="mt-2 space-y-2 p-3 border border-primary/40 rounded-md bg-primary/5">
                    <Input
                      value={proposedName}
                      onChange={(e) => setProposedName(e.target.value)}
                      placeholder={t("upload.proposeThemePlaceholder")}
                      className="bg-background h-10"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleProposeTheme(); } if (e.key === "Escape") { setShowPropose(false); setProposedName(""); } }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button type="button" className="flex-1 h-9" disabled={!proposedName.trim() || proposeThemeMutation.isPending} onClick={handleProposeTheme}>
                        {proposeThemeMutation.isPending ? t("upload.proposeThemeSubmitting") : t("upload.proposeThemeBtn")}
                      </Button>
                      <Button type="button" variant="outline" className="h-9 px-3" onClick={() => { setShowPropose(false); setProposedName(""); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending || !editTitle.trim()}>
              {updateMutation.isPending ? t("photoDetail.saving") : t("photoDetail.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — single portal, controlled via deleteOpen state */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("photoDetail.areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("photoDetail.deleteBody", { title: photo.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Link href={backHref} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        {backLabel}
      </Link>

      <div className="flex flex-col lg:flex-row gap-12">

        {/* ── Left column: image + comments ── */}
        <div className="lg:w-2/3 flex flex-col gap-8">

          {/* Mobile header: title only (hidden on lg+) */}
          <h1 className="lg:hidden font-serif text-3xl font-bold leading-tight">{photo.title}</h1>

          {/* Photo */}
          <div data-testid="photo-image-container" className="relative flex items-center justify-center bg-secondary/20 rounded-sm p-4 border border-border/50 h-[50vh] lg:h-[75vh]">
            <img
              src={photo.imageUrl}
              alt={photo.title}
              className="max-h-[50vh] lg:max-h-[75vh] max-w-full w-auto object-contain shadow-2xl"
            />
            {previousId !== null && (
              <Link
                href={`/photos/${previousId}${ctxParam}`}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
                aria-label={t("photoDetail.previousPhoto")}
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
            )}
            {nextId !== null && (
              <Link
                href={`/photos/${nextId}${ctxParam}`}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
                aria-label={t("photoDetail.nextPhoto")}
              >
                <ChevronRight className="w-5 h-5" />
              </Link>
            )}
            {nextId === null && galleryNavigation.canLoadNext && (
              <Button type="button" variant="ghost" size="icon" onClick={() => void loadNextPhoto()}
                disabled={galleryNavigation.pending} aria-label={t("photoDetail.nextPhoto")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/80">
                <ChevronRight className={`w-5 h-5 ${galleryNavigation.pending ? "animate-pulse" : ""}`} />
              </Button>
            )}
          </div>

          {/* Mobile metadata block — sits between image and comments (hidden on lg+) */}
          <div className="lg:hidden flex flex-col">
            {/* Description first, right below the photo */}
            {photo.description && (
              <div data-testid="mobile-photo-description" className="mb-6 text-lg leading-relaxed text-foreground/90 font-serif break-words overflow-hidden">
                {photo.description}
              </div>
            )}

            {/* Date + edit button on the same row */}
            <div data-testid="mobile-photo-date-row" className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(photo.createdAt), "d MMMM yyyy", { locale: dateLocale })}</span>
              </div>
              {actionMenu}
            </div>

            {/* Like Action */}
            <div className="flex items-center gap-4 mb-8 bg-secondary/30 p-4 rounded-lg border border-border/50">
              {likeButton}
            </div>

            <Separator className="mb-8" />

            <div className="flex flex-col gap-6">
              {/* Photographer */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
                  {photo.photographerAvatarUrl ? (
                    <img src={photo.photographerAvatarUrl} alt={photo.photographerName || ""} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("photoDetail.photographer")}</div>
                  <Link href={`/photographers/${photo.photographerId}`} className="font-medium text-lg hover:text-primary transition-colors inline-block">
                    {photo.photographerName || t("common.unknown")}
                  </Link>
                </div>
              </div>

              {/* Club */}
              {photo.clubId && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("photoDetail.community")}</div>
                    <Link href={`/clubs/${photo.clubId}`} className="font-medium text-lg hover:text-primary transition-colors inline-block">
                      {photo.clubName}
                    </Link>
                  </div>
                </div>
              )}

              {/* Theme */}
              {photo.themeId && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
                    <Tag className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("photoDetail.theme")}</div>
                    <Link href={`/photos?themeId=${photo.themeId}`} className="font-medium text-lg hover:text-primary transition-colors inline-block">
                      <Badge variant="outline" className="text-sm font-normal py-1 border-primary/30 text-foreground">
                        {photo.themeName}
                      </Badge>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h2 className="font-serif text-2xl">
                {comments.length === 0
                  ? t("photoDetail.notesNone")
                  : `${comments.length} ${comments.length === 1 ? t("photoDetail.noteOne") : t("photoDetail.noteOther")}`}
              </h2>
            </div>

            {/* Comment list */}
            {commentsLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-muted rounded w-1/4" />
                      <div className="h-4 bg-muted rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <AnimatePresence initial={false}>
                <div className="space-y-5 mb-8">
                  {comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="flex gap-3 group"
                    >
                      <div className="w-9 h-9 rounded-full bg-secondary border border-border shrink-0 overflow-hidden flex items-center justify-center">
                        {comment.photographerAvatarUrl ? (
                          <img src={comment.photographerAvatarUrl} alt={comment.photographerName || ""} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 bg-secondary/30 border border-border/40 rounded-lg px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {comment.photographerName || t("common.anonymous")}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono">
                              {format(new Date(comment.createdAt), "MMM d, yyyy")}
                            </span>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={deleteCommentMutation.isPending}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              aria-label="Delete comment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed">{comment.body}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}

            {/* Post a comment */}
            {myProfile && (
              <div className="border border-border/50 rounded-lg p-4 bg-secondary/10 space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{t("photoDetail.leaveNote")}</p>
                <Textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder={t("photoDetail.writePlaceholder")}
                  className="resize-none bg-background border-border/50 min-h-[80px] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleComment();
                  }}
                />
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-muted-foreground">{t("photoDetail.postingAs")} <span className="text-foreground font-medium">{myProfile.name}</span></span>
                  <Button
                    onClick={handleComment}
                    disabled={createCommentMutation.isPending || !commentBody.trim()}
                    className="gap-2 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    {t("photoDetail.post")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("photoDetail.postTip")}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop sidebar: title + metadata (hidden below lg) ── */}
        <div data-testid="photo-metadata-sidebar" className="hidden lg:flex lg:flex-col lg:w-1/3 lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-start justify-between mb-4">
            <h1 className="font-serif text-4xl font-bold leading-tight flex-1 min-w-0 pr-3">{photo.title}</h1>
            {actionMenu}
          </div>
          {metaRows}
        </div>

      </div>
    </div>
  );
}
