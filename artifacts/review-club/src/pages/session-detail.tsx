import { 
  useGetReviewSession, 
  useListSessionPhotos, 
  useListSessionReviewers, 
  useGetAdminStatus,
  useAddSessionReviewer,
  useRemoveSessionReviewer,
  useSubmitSessionPhoto,
  getListSessionReviewersQueryKey,
  getListSessionPhotosQueryKey,
  useListPhotographers,
  useListPhotos
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useDateLocale } from "@/hooks/use-date-locale";
import { StarRating } from "@/components/star-rating";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Users, Image as ImageIcon, MessageSquare, Trash2, Plus, Trophy, UploadCloud, CheckCircle2 } from "lucide-react";
import { PaginationBar } from "@/components/pagination-bar";
import { usePageParam } from "@/hooks/use-page-param";
import { useTranslation } from "react-i18next";

const PHOTOS_PAGE_SIZE = 24;

export function SessionDetail() {
  const { id } = useParams();
  const sessionId = parseInt(id || "0", 10);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const { data: session, isLoading: sessionLoading } = useGetReviewSession(sessionId, { query: { enabled: !!sessionId, queryKey: ['reviewSession', sessionId] } });
  const { data: photos, isLoading: photosLoading } = useListSessionPhotos(sessionId, { query: { enabled: !!sessionId, queryKey: getListSessionPhotosQueryKey(sessionId) } });
  const { data: reviewers, isLoading: reviewersLoading } = useListSessionReviewers(sessionId, { query: { enabled: !!sessionId, queryKey: getListSessionReviewersQueryKey(sessionId) } });
  const { data: adminStatus } = useGetAdminStatus();
  
  const { data: photographers } = useListPhotographers({}, { query: { enabled: !!adminStatus?.isAdmin, queryKey: ['photographers'] } });
  const myPhotographerId = adminStatus?.photographerId ?? undefined;
  const { data: allPhotos } = useListPhotos(
    adminStatus?.isAdmin ? {} : (myPhotographerId ? { photographerId: myPhotographerId } : {}),
    { query: { enabled: session?.status === 'open' && adminStatus !== undefined, queryKey: ['photos', adminStatus?.isAdmin ? 'all' : myPhotographerId] } }
  );

  const addReviewer = useAddSessionReviewer();
  const removeReviewer = useRemoveSessionReviewer();
  const submitPhoto = useSubmitSessionPhoto();

  const [isAddReviewerOpen, setIsAddReviewerOpen] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");

  const [isAddPhotoOpen, setIsAddPhotoOpen] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>("");
  const [submitTab, setSubmitTab] = useState<"gallery" | "upload">("gallery");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadImageUrl, setUploadImageUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [photosPage, setPhotosPage] = usePageParam();
  const totalPhotosPages = Math.ceil((photos?.length ?? 0) / PHOTOS_PAGE_SIZE);
  // Clamp out-of-bounds ?page= values to the last valid page
  useEffect(() => {
    if (totalPhotosPages > 0 && photosPage > totalPhotosPages) {
      setPhotosPage(totalPhotosPages);
    }
  }, [photosPage, totalPhotosPages, setPhotosPage]);

  if (sessionLoading) return <div className="space-y-6"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!session) return <div>{t("session.notFound")}</div>;

  const deadlinePassed = session.submissionDeadline
    ? new Date() > new Date(session.submissionDeadline)
    : false;

  const handleAddReviewer = async () => {
    if (!selectedReviewerId) return;
    try {
      await addReviewer.mutateAsync({ 
        id: sessionId, 
        data: { photographerId: parseInt(selectedReviewerId, 10) } 
      });
      toast({ title: t("session.reviewerAdded") });
      setIsAddReviewerOpen(false);
      setSelectedReviewerId("");
      queryClient.invalidateQueries({ queryKey: getListSessionReviewersQueryKey(sessionId) });
    } catch (e: any) {
      toast({ title: t("session.error"), description: e.message, variant: "destructive" });
    }
  };

  const handleRemoveReviewer = async (reviewerId: number) => {
    try {
      await removeReviewer.mutateAsync({ 
        id: sessionId, 
        reviewerId,
      });
      toast({ title: t("session.reviewerRemoved") });
      queryClient.invalidateQueries({ queryKey: getListSessionReviewersQueryKey(sessionId) });
    } catch (e: any) {
      toast({ title: t("session.error"), description: e.message, variant: "destructive" });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("uploading");
    setUploadImageUrl("");
    try {
      const urlRes = await fetch(`${basePath}/api/storage/uploads/request-url`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type ?? "image/jpeg" },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");
      setUploadImageUrl(`${basePath}/api/storage${objectPath}`);
      setUploadStatus("done");
    } catch {
      setUploadStatus("error");
      toast({ title: t("session.uploadError"), variant: "destructive" });
    }
  };

  const handleSubmitPhoto = async () => {
    if (submitTab === "gallery") {
      if (!selectedPhotoId) return;
      try {
        await submitPhoto.mutateAsync({
          id: sessionId,
          data: { photoId: parseInt(selectedPhotoId, 10) }
        });
        toast({ title: t("session.photoSubmitted") });
        setIsAddPhotoOpen(false);
        setSelectedPhotoId("");
        queryClient.invalidateQueries({ queryKey: getListSessionPhotosQueryKey(sessionId) });
      } catch (e: any) {
        toast({ title: t("session.error"), description: e.message, variant: "destructive" });
      }
    } else {
      if (!uploadTitle.trim()) {
        toast({ title: t("session.titleRequired"), variant: "destructive" });
        return;
      }
      if (!uploadImageUrl) {
        toast({ title: t("session.imageRequired"), variant: "destructive" });
        return;
      }
      try {
        await submitPhoto.mutateAsync({
          id: sessionId,
          data: { title: uploadTitle.trim(), imageUrl: uploadImageUrl }
        });
        toast({ title: t("session.photoSubmitted") });
        setIsAddPhotoOpen(false);
        setUploadTitle("");
        setUploadImageUrl("");
        setUploadStatus("idle");
        queryClient.invalidateQueries({ queryKey: getListSessionPhotosQueryKey(sessionId) });
      } catch (e: any) {
        toast({ title: t("session.error"), description: e.message, variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-12">
      {/* Header Section */}
      <section className="bg-card border border-border/50 rounded-lg p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="space-y-4 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={session.status === 'open' ? 'default' : session.status === 'reviewing' ? 'secondary' : 'outline'} className="uppercase tracking-wider">
                {t(`status.${session.status}`)}
              </Badge>
              {session.scheduledFor && (
                <span className="text-sm text-muted-foreground font-medium">
                  {format(new Date(session.scheduledFor), "PP", { locale: dateLocale })}
                </span>
              )}
              {session.submissionDeadline && (
                <span className="text-sm text-muted-foreground font-medium">
                  {t("session.deadlinePrefix")} {format(new Date(session.submissionDeadline), "PP", { locale: dateLocale })}
                </span>
              )}
            </div>
            <h1 className="text-4xl font-serif font-bold tracking-tight">{session.title}</h1>
            {session.description && (
              <p className="text-lg text-muted-foreground leading-relaxed">{session.description}</p>
            )}
          </div>

          {/* Reviewers List */}
          <div className="min-w-[250px] bg-background/50 p-4 rounded-md border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> {t("session.reviewPanel")}
              </h3>
              {adminStatus?.isAdmin && (
                <Dialog open={isAddReviewerOpen} onOpenChange={setIsAddReviewerOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("session.assignReviewer")}</DialogTitle>
                    </DialogHeader>
                    <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("session.selectPhotographer")} />
                      </SelectTrigger>
                      <SelectContent>
                        {photographers?.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <DialogFooter>
                      <Button onClick={handleAddReviewer}>{t("session.addReviewer")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="space-y-3">
              {reviewersLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : reviewers?.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">{t("session.noReviewers")}</p>
              ) : (
                reviewers?.map(r => (
                  <div key={r.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8 border border-border/50">
                        <AvatarImage src={r.photographerAvatarUrl || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{r.photographerName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{r.photographerName}</span>
                    </div>
                    {adminStatus?.isAdmin && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleRemoveReviewer(r.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Photos Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-serif font-bold flex items-center gap-3">
            <Camera className="w-6 h-6 text-primary" /> {t("session.submittedPhotos")}
          </h2>
          {(photos?.length ?? 0) > 0 && (
            <Link href={`/sessions/${sessionId}/results`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Trophy className="w-4 h-4" />
                {t("results.viewResults")}
              </Button>
            </Link>
          )}
          {session.status === 'open' && (!deadlinePassed || adminStatus?.isAdmin) && (
            <Dialog open={isAddPhotoOpen} onOpenChange={(open) => {
              setIsAddPhotoOpen(open);
              if (!open) { setSubmitTab("gallery"); setUploadTitle(""); setUploadImageUrl(""); setUploadStatus("idle"); }
            }}>
              <DialogTrigger asChild>
                <Button>{t("session.submitPhoto")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("session.submitPhotoTitle")}</DialogTitle>
                </DialogHeader>
                <Tabs value={submitTab} onValueChange={(v) => setSubmitTab(v as "gallery" | "upload")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="gallery" className="flex-1">{t("session.tabGallery")}</TabsTrigger>
                    <TabsTrigger value="upload" className="flex-1">{t("session.tabUpload")}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="gallery" className="pt-3">
                    <Select value={selectedPhotoId} onValueChange={setSelectedPhotoId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("session.selectPhoto")} />
                      </SelectTrigger>
                      <SelectContent>
                        {allPhotos?.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                  <TabsContent value="upload" className="pt-3 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="upload-title">{t("session.photoTitleLabel")}</Label>
                      <Input
                        id="upload-title"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder={t("session.photoTitlePlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        disabled={uploadStatus === "uploading"}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadStatus === "uploading" ? (
                          <>{t("session.uploading")}</>
                        ) : uploadStatus === "done" ? (
                          <><CheckCircle2 className="w-4 h-4 text-green-500" /> {t("session.uploadDone")}</>
                        ) : (
                          <><UploadCloud className="w-4 h-4" /> {t("session.chooseImage")}</>
                        )}
                      </Button>
                      {uploadImageUrl && (
                        <img src={uploadImageUrl} alt="" className="w-full aspect-[4/3] object-cover rounded-md border border-border/50" />
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
                <DialogFooter>
                  <Button onClick={handleSubmitPhoto} disabled={submitPhoto.isPending || uploadStatus === "uploading"}>
                    {t("session.submit")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {session.status === 'open' && deadlinePassed && !adminStatus?.isAdmin && (
            <span className="text-sm text-muted-foreground italic">
              {t("session.deadlinePassed")}
            </span>
          )}
          {session.status === 'open' && deadlinePassed && adminStatus?.isAdmin && (
            <span className="text-sm text-amber-600 dark:text-amber-500 italic">
              {t("session.deadlinePassedAdmin")}
            </span>
          )}
        </div>

        {photosLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />)}
          </div>
        ) : photos?.length === 0 ? (
          <div className="text-center py-20 bg-card/30 border border-dashed border-border/50 rounded-lg">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-serif mb-2">{t("session.noPhotosTitle")}</h3>
            <p className="text-muted-foreground">{t("session.noPhotosBody")}</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {photos?.slice((photosPage - 1) * PHOTOS_PAGE_SIZE, photosPage * PHOTOS_PAGE_SIZE).map((photo) => (
              <Link key={photo.id} href={`/sessions/${sessionId}/photos/${photo.id}`}>
                <Card className="overflow-hidden border-border/50 bg-card/50 hover:bg-card transition-colors cursor-pointer group flex flex-col h-full">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted relative">
                    {photo.photoImageUrl ? (
                      <img 
                        src={photo.photoImageUrl} 
                        alt={photo.photoTitle || t("common.photoAlt")} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardContent className="p-5 flex-1 flex flex-col">
                    <h3 className="font-serif text-lg font-semibold mb-1 line-clamp-1">{photo.photoTitle || t("session.untitled")}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{t("common.by")} {photo.photographerName ?? t("common.unknownPhotographer")}</p>
                    
                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <StarRating rating={photo.averageRating || 0} max={5} size="sm" className="text-primary" />
                        <span className="text-sm font-medium">{photo.averageRating ? photo.averageRating.toFixed(1) : t("session.noRatings")}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MessageSquare className="w-4 h-4" />
                        <span>{t("session.reviewCount", { count: photo.reviewCount || 0 })}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <PaginationBar
            page={photosPage}
            totalPages={totalPhotosPages}
            onPageChange={setPhotosPage}
          />
          </>
        )}
      </section>
    </div>
  );
}
