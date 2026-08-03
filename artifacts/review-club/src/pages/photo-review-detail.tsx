import { 
  useGetReviewSession, 
  useListSessionPhotos, 
  useListPhotoReviews,
  useListSessionReviewers,
  useGetAdminStatus,
  useCreatePhotoReview,
  useUpdatePhotoReview,
  getListPhotoReviewsQueryKey,
  getListSessionPhotosQueryKey,
  getListSessionReviewersQueryKey,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useDateLocale } from "@/hooks/use-date-locale";
import { ArrowLeft, Send } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PhotoReviewDetail() {
  const { id, sessionPhotoId } = useParams();
  const sessionId = parseInt(id || "0", 10);
  const spId = parseInt(sessionPhotoId || "0", 10);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const { data: session } = useGetReviewSession(sessionId, { query: { enabled: !!sessionId, queryKey: ['reviewSession', sessionId] } });
  const { data: photos } = useListSessionPhotos(sessionId, { query: { enabled: !!sessionId, queryKey: getListSessionPhotosQueryKey(sessionId) } });
  const { data: reviews, isLoading: reviewsLoading } = useListPhotoReviews(sessionId, spId, { query: { enabled: !!sessionId && !!spId, queryKey: getListPhotoReviewsQueryKey(sessionId, spId) } });
  const { data: reviewers } = useListSessionReviewers(sessionId, { query: { enabled: !!sessionId, queryKey: getListSessionReviewersQueryKey(sessionId) } });
  const { data: adminStatus } = useGetAdminStatus();

  const createReview = useCreatePhotoReview();
  const updateReview = useUpdatePhotoReview();

  const photo = photos?.find(p => p.id === spId);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const myPhotographerId = adminStatus?.photographerId;
  const isAdmin = adminStatus?.isAdmin ?? false;
  const isReviewer = !!myPhotographerId && (reviewers?.some(r => r.photographerId === myPhotographerId) ?? false);
  const isReviewing = session?.status === "reviewing";

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: t("review.ratingRequired"), variant: "destructive" });
      return;
    }

    try {
      if (editingId) {
        await updateReview.mutateAsync({
          id: sessionId,
          sessionPhotoId: spId,
          reviewId: editingId,
          data: { rating, comment }
        });
        toast({ title: t("review.reviewUpdated") });
      } else {
        await createReview.mutateAsync({
          id: sessionId,
          sessionPhotoId: spId,
          data: { rating, comment }
        });
        toast({ title: t("review.reviewSubmitted") });
      }
      setRating(0);
      setComment("");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: getListPhotoReviewsQueryKey(sessionId, spId) });
      queryClient.invalidateQueries({ queryKey: getListSessionPhotosQueryKey(sessionId) });
    } catch (e: any) {
      toast({ title: t("review.error"), description: e.message || t("review.submitFailed"), variant: "destructive" });
    }
  };

  if (!photo && photos) return <div>{t("review.photoNotFound")}</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href={`/sessions/${sessionId}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-serif font-bold">{photo?.photoTitle || t("common.untitled")}</h1>
          <p className="text-muted-foreground text-sm">{t("common.by")} {photo?.photographerName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 items-start">
        {/* Main Photo View */}
        <div className="bg-card border border-border/50 rounded-lg overflow-hidden shadow-xl sticky top-24">
          {photo?.photoImageUrl ? (
            <img 
              src={photo.photoImageUrl} 
              alt={photo.photoTitle || t("common.photoAlt")} 
              className="w-full h-auto object-contain max-h-[75vh] bg-black"
            />
          ) : (
            <Skeleton className="w-full aspect-[3/2]" />
          )}
        </div>

        {/* Reviews Sidebar */}
        <div className="space-y-8">
          <div className="border-b border-border/50 pb-4">
            <h2 className="text-xl font-serif font-bold mb-1">{t("review.reviewsTitle")}</h2>
            <div className="flex items-center gap-3">
              <StarRating rating={photo?.averageRating || 0} readonly size="sm" className="text-primary" />
              <span className="text-muted-foreground text-sm font-medium">
                {t("common.avgRating", { rating: photo?.averageRating ? photo.averageRating.toFixed(1) : '0', count: photo?.reviewCount || 0 })}
              </span>
            </div>
          </div>

          {isReviewing && (isReviewer || isAdmin) && (
            <div className="bg-card/50 border border-primary/20 rounded-lg p-5 space-y-4">
              <h3 className="font-serif font-semibold text-primary">{editingId ? t("review.editReview") : t("review.leaveReview")}</h3>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">{t("review.ratingLabel")}</label>
                <StarRating rating={rating} max={5} onChange={setRating} readonly={false} size="lg" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">{t("review.feedbackLabel")}</label>
                <Textarea 
                  value={comment} 
                  onChange={e => setComment(e.target.value)} 
                  placeholder={t("review.feedbackPlaceholder")}
                  className="resize-none h-32 bg-background/50 focus-visible:ring-primary"
                />
              </div>
              <Button onClick={handleSubmit} className="w-full font-medium tracking-wide">
                <Send className="w-4 h-4 mr-2" /> {editingId ? t("review.updateBtn") : t("review.submitBtn")}
              </Button>
            </div>
          )}

          <div className="space-y-6">
            {reviewsLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
              </div>
            ) : reviews?.length === 0 ? (
              <p className="text-muted-foreground italic text-center py-8">{t("review.noReviews")}</p>
            ) : (
              reviews?.map(review => (
                <div key={review.id} className="bg-card/30 border border-border/50 rounded-lg p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={review.reviewerAvatarUrl || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{review.reviewerName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{review.reviewerName}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(review.createdAt), "PP", { locale: dateLocale })}</p>
                      </div>
                    </div>
                    <StarRating rating={review.rating} readonly size="sm" />
                  </div>
                  {review.comment && (
                    <p className="text-sm leading-relaxed text-foreground/90 pl-11">
                      "{review.comment}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
