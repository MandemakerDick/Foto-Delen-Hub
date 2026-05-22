import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Calendar, ArrowLeft, MoreHorizontal, User, Users, Tag, MessageCircle, Send, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Show } from "@clerk/react";
import {
  useGetPhoto,
  getGetPhotoQueryKey,
  useLikePhoto,
  useDeletePhoto,
  useUpdatePhoto,
  useListPhotographers,
  useListClubs,
  useListThemes,
  useListComments,
  getListCommentsQueryKey,
  useCreateComment,
  useDeleteComment,
} from "@workspace/api-client-react";
import { useMyProfile } from "@/hooks/use-my-profile";
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
  AlertDialogTrigger,
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
  const { id } = useParams();
  const photoId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: photo, isLoading, error } = useGetPhoto(photoId, {
    query: { enabled: !!photoId, queryKey: getGetPhotoQueryKey(photoId) },
  });

  const { data: comments = [], isLoading: commentsLoading } = useListComments(photoId, {
    query: { enabled: !!photoId, queryKey: getListCommentsQueryKey(photoId) },
  });

  const likeMutation = useLikePhoto();
  const deleteMutation = useDeletePhoto();
  const updateMutation = useUpdatePhoto();
  const createCommentMutation = useCreateComment();
  const deleteCommentMutation = useDeleteComment();

  const { profile: myProfile } = useMyProfile();

  const { data: clubs } = useListClubs();
  const { data: themes } = useListThemes();
  const { data: photographers } = useListPhotographers();

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editClubId, setEditClubId] = useState<string>("");
  const [editThemeId, setEditThemeId] = useState<string>("");

  const [selectedLiker, setSelectedLiker] = useState<string>("");
  const [selectedCommenter, setSelectedCommenter] = useState<string>("");
  const [commentBody, setCommentBody] = useState("");

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

  if (error || !photo) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-serif text-3xl mb-4">Photograph not found</h2>
        <p className="text-muted-foreground mb-8">This print may have been removed from the darkroom.</p>
        <Link href="/photos">
          <Button variant="outline">Return to Gallery</Button>
        </Link>
      </div>
    );
  }

  const handleLike = () => {
    if (!selectedLiker) {
      toast({ title: "Who are you?", description: "Select a photographer profile to like this photo.", variant: "destructive" });
      return;
    }
    likeMutation.mutate(
      { id: photoId, data: { photographerId: Number(selectedLiker) } },
      {
        onSuccess: (updatedPhoto) => {
          queryClient.setQueryData(getGetPhotoQueryKey(photoId), updatedPhoto);
          toast({ title: "Photograph liked", description: "Your appreciation has been recorded." });
        },
        onError: () => toast({ title: "Error", description: "Could not like the photograph.", variant: "destructive" }),
      },
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: photoId },
      {
        onSuccess: () => {
          toast({ title: "Photograph removed", description: "The print has been taken down." });
          window.location.href = "/photos";
        },
        onError: () => toast({ title: "Error", description: "Could not remove the photograph.", variant: "destructive" }),
      },
    );
  };

  const openEdit = () => {
    setEditTitle(photo?.title ?? "");
    setEditDescription(photo?.description ?? "");
    setEditClubId(photo?.clubId?.toString() ?? "");
    setEditThemeId(photo?.themeId?.toString() ?? "");
    setEditOpen(true);
  };

  const handleEdit = () => {
    updateMutation.mutate(
      {
        id: photoId,
        data: {
          title: editTitle || undefined,
          description: editDescription || undefined,
          clubId: editClubId ? Number(editClubId) : null,
          themeId: editThemeId ? Number(editThemeId) : null,
        },
      },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetPhotoQueryKey(photoId), updated);
          setEditOpen(false);
          toast({ title: "Changes saved", description: "Your photograph details have been updated." });
        },
        onError: () => toast({ title: "Error", description: "Could not save changes.", variant: "destructive" }),
      },
    );
  };

  const handleComment = () => {
    if (!commentBody.trim()) {
      toast({ title: "Empty comment", description: "Write something before posting.", variant: "destructive" });
      return;
    }
    createCommentMutation.mutate(
      {
        id: photoId,
        data: {
          body: commentBody.trim(),
          ...(selectedCommenter ? { photographerId: Number(selectedCommenter) } : {}),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(photoId) });
          setCommentBody("");
          toast({ title: "Comment posted", description: "Your note has been added to this photograph." });
        },
        onError: () => toast({ title: "Error", description: "Could not post comment.", variant: "destructive" }),
      },
    );
  };

  const handleDeleteComment = (commentId: number) => {
    deleteCommentMutation.mutate(
      { id: photoId, commentId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(photoId) });
          toast({ title: "Comment removed" });
        },
        onError: () => toast({ title: "Error", description: "Could not delete comment.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/photos" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Gallery
      </Link>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Main Image */}
        <div className="w-full lg:w-2/3 flex flex-col gap-8">
          <div className="flex items-start justify-center bg-secondary/20 rounded-sm p-4 border border-border/50">
            <img
              src={photo.imageUrl}
              alt={photo.title}
              className="max-h-[80vh] w-auto object-contain shadow-2xl"
            />
          </div>

          {/* Comments Section */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h2 className="font-serif text-2xl">
                {comments.length === 0
                  ? "No notes yet"
                  : `${comments.length} ${comments.length === 1 ? "Note" : "Notes"}`}
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
                            {comment.photographerName || "Anonymous"}
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
            <div className="border border-border/50 rounded-lg p-4 bg-secondary/10 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Leave a note</p>
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write your thoughts on this photograph..."
                className="resize-none bg-background border-border/50 min-h-[80px] text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleComment();
                }}
              />
              <div className="flex items-center gap-3">
                <Select value={selectedCommenter} onValueChange={setSelectedCommenter}>
                  <SelectTrigger className="flex-1 bg-background border-border/50 text-sm">
                    <SelectValue placeholder="Posting as... (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {photographers?.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleComment}
                  disabled={createCommentMutation.isPending || !commentBody.trim()}
                  className="gap-2 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Post
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Tip: Cmd+Enter to post quickly</p>
            </div>
          </div>
        </div>

        {/* Metadata Sidebar */}
        <div className="w-full lg:w-1/3 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h1 className="font-serif text-4xl font-bold leading-tight">{photo.title}</h1>

            {myProfile?.id === photo.photographerId && (
              <>
                {/* Edit dialog */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-serif text-xl">Edit Photograph</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-title">Title</Label>
                        <Input
                          id="edit-title"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-desc">Description</Label>
                        <Textarea
                          id="edit-desc"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="resize-none h-24 bg-background font-serif"
                          placeholder="Artist statement or caption..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Community</Label>
                          <Select value={editClubId} onValueChange={setEditClubId}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {clubs?.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Theme</Label>
                          <Select value={editThemeId} onValueChange={setEditThemeId}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {themes?.map((t) => (
                                <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                      <Button onClick={handleEdit} disabled={updateMutation.isPending || !editTitle.trim()}>
                        {updateMutation.isPending ? "Saving..." : "Save changes"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Owner dropdown */}
                <AlertDialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={openEdit} className="cursor-pointer gap-2">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer gap-2">
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove photograph
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{photo.title}" from the gallery. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground font-mono">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(photo.createdAt), "MMMM d, yyyy")}</span>
          </div>

          {/* Like Action */}
          <div className="flex items-center gap-4 mb-8 bg-secondary/30 p-4 rounded-lg border border-border/50">
            <div className="flex-1">
              <Select value={selectedLiker} onValueChange={setSelectedLiker}>
                <SelectTrigger className="bg-background border-border/50">
                  <SelectValue placeholder="Select profile to like as..." />
                </SelectTrigger>
                <SelectContent>
                  {photographers?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleLike}
              disabled={likeMutation.isPending}
              variant="outline"
              className="gap-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <Heart className={`w-4 h-4 ${likeMutation.isPending ? "animate-pulse" : ""}`} />
              <span className="font-mono">{photo.likeCount || 0}</span>
            </Button>
          </div>

          {photo.description && (
            <div className="mb-8 text-lg leading-relaxed text-foreground/90 font-serif">
              {photo.description}
            </div>
          )}

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
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Photographer</div>
                <Link href={`/photographers/${photo.photographerId}`} className="font-medium text-lg hover:text-primary transition-colors inline-block">
                  {photo.photographerName || "Unknown"}
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
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Community</div>
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
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Theme</div>
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
      </div>
    </div>
  );
}
