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
import { StarRating } from "@/components/star-rating";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Camera, Users, Image as ImageIcon, MessageSquare, Trash2, Plus } from "lucide-react";

export function SessionDetail() {
  const { id } = useParams();
  const sessionId = parseInt(id || "0", 10);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: session, isLoading: sessionLoading } = useGetReviewSession(sessionId, { query: { enabled: !!sessionId, queryKey: ['reviewSession', sessionId] } });
  const { data: photos, isLoading: photosLoading } = useListSessionPhotos(sessionId, { query: { enabled: !!sessionId, queryKey: getListSessionPhotosQueryKey(sessionId) } });
  const { data: reviewers, isLoading: reviewersLoading } = useListSessionReviewers(sessionId, { query: { enabled: !!sessionId, queryKey: getListSessionReviewersQueryKey(sessionId) } });
  const { data: adminStatus } = useGetAdminStatus();
  
  const { data: photographers } = useListPhotographers({}, { query: { enabled: !!adminStatus?.isAdmin, queryKey: ['photographers'] } });
  const { data: allPhotos } = useListPhotos({}, { query: { enabled: session?.status === 'open', queryKey: ['photos'] } });

  const addReviewer = useAddSessionReviewer();
  const removeReviewer = useRemoveSessionReviewer();
  const submitPhoto = useSubmitSessionPhoto();

  const [isAddReviewerOpen, setIsAddReviewerOpen] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");

  const [isAddPhotoOpen, setIsAddPhotoOpen] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>("");

  if (sessionLoading) return <div className="space-y-6"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!session) return <div>Session not found</div>;

  const handleAddReviewer = async () => {
    if (!selectedReviewerId) return;
    try {
      await addReviewer.mutateAsync({ 
        id: sessionId, 
        data: { photographerId: parseInt(selectedReviewerId, 10) } 
      });
      toast({ title: "Reviewer Added" });
      setIsAddReviewerOpen(false);
      setSelectedReviewerId("");
      queryClient.invalidateQueries({ queryKey: getListSessionReviewersQueryKey(sessionId) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRemoveReviewer = async (reviewerId: number) => {
    try {
      await removeReviewer.mutateAsync({ 
        id: sessionId, 
        reviewerId,
      });
      toast({ title: "Reviewer Removed" });
      queryClient.invalidateQueries({ queryKey: getListSessionReviewersQueryKey(sessionId) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSubmitPhoto = async () => {
    if (!selectedPhotoId) return;
    try {
      await submitPhoto.mutateAsync({
        id: sessionId,
        data: { photoId: parseInt(selectedPhotoId, 10) }
      });
      toast({ title: "Photo Submitted" });
      setIsAddPhotoOpen(false);
      setSelectedPhotoId("");
      queryClient.invalidateQueries({ queryKey: getListSessionPhotosQueryKey(sessionId) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-12">
      {/* Header Section */}
      <section className="bg-card border border-border/50 rounded-lg p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="space-y-4 max-w-3xl">
            <div className="flex items-center gap-3">
              <Badge variant={session.status === 'open' ? 'default' : session.status === 'reviewing' ? 'secondary' : 'outline'} className="uppercase tracking-wider">
                {session.status}
              </Badge>
              {session.scheduledFor && (
                <span className="text-sm text-muted-foreground font-medium">
                  {format(new Date(session.scheduledFor), "MMM d, yyyy")}
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
                <Users className="w-4 h-4 text-primary" /> Review Panel
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
                      <DialogTitle>Assign Reviewer</DialogTitle>
                    </DialogHeader>
                    <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select photographer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {photographers?.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <DialogFooter>
                      <Button onClick={handleAddReviewer}>Add Reviewer</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="space-y-3">
              {reviewersLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : reviewers?.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No reviewers assigned.</p>
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
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-serif font-bold flex items-center gap-3">
            <Camera className="w-6 h-6 text-primary" /> Submitted Photos
          </h2>
          {session.status === 'open' && (
            <Dialog open={isAddPhotoOpen} onOpenChange={setIsAddPhotoOpen}>
              <DialogTrigger asChild>
                <Button>Submit Photo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Photo to Session</DialogTitle>
                </DialogHeader>
                <Select value={selectedPhotoId} onValueChange={setSelectedPhotoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select one of your photos..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allPhotos?.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <Button onClick={handleSubmitPhoto}>Submit</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {photosLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />)}
          </div>
        ) : photos?.length === 0 ? (
          <div className="text-center py-20 bg-card/30 border border-dashed border-border/50 rounded-lg">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-serif mb-2">No photos submitted yet</h3>
            <p className="text-muted-foreground">Photos submitted to this session will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {photos?.map((photo) => (
              <Link key={photo.id} href={`/sessions/${sessionId}/photos/${photo.id}`}>
                <Card className="overflow-hidden border-border/50 bg-card/50 hover:bg-card transition-colors cursor-pointer group flex flex-col h-full">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted relative">
                    {photo.photoImageUrl ? (
                      <img 
                        src={photo.photoImageUrl} 
                        alt={photo.photoTitle || 'Photo'} 
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
                    <h3 className="font-serif text-lg font-semibold mb-1 line-clamp-1">{photo.photoTitle || 'Untitled'}</h3>
                    <p className="text-sm text-muted-foreground mb-4">by {photo.photographerName}</p>
                    
                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <StarRating rating={photo.averageRating || 0} max={1} size="sm" className="text-primary" />
                        <span className="text-sm font-medium">{photo.averageRating ? photo.averageRating.toFixed(1) : 'No ratings'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MessageSquare className="w-4 h-4" />
                        <span>{photo.reviewCount || 0} reviews</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
