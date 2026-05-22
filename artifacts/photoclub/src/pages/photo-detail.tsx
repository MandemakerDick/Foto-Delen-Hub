import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Calendar, ArrowLeft, MoreHorizontal, User, Users, Tag } from "lucide-react";
import { format } from "date-fns";
import { 
  useGetPhoto, 
  getGetPhotoQueryKey,
  useLikePhoto,
  useDeletePhoto,
  useListPhotographers
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function PhotoDetail() {
  const { id } = useParams();
  const photoId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: photo, isLoading, error } = useGetPhoto(photoId, { 
    query: { enabled: !!photoId, queryKey: getGetPhotoQueryKey(photoId) } 
  });
  
  const likeMutation = useLikePhoto();
  const deleteMutation = useDeletePhoto();
  
  const { data: photographers } = useListPhotographers();
  const [selectedLiker, setSelectedLiker] = useState<string>("");

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex flex-col md:flex-row gap-12 animate-pulse">
        <div className="w-full md:w-2/3 aspect-[4/3] bg-muted rounded-sm"></div>
        <div className="w-full md:w-1/3 flex flex-col gap-6">
          <div className="h-10 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <Separator />
          <div className="h-24 bg-muted rounded w-full"></div>
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
      toast({
        title: "Who are you?",
        description: "Please select a photographer profile to like this photo.",
        variant: "destructive"
      });
      return;
    }

    likeMutation.mutate(
      { id: photoId, data: { photographerId: Number(selectedLiker) } },
      {
        onSuccess: (updatedPhoto) => {
          queryClient.setQueryData(getGetPhotoQueryKey(photoId), updatedPhoto);
          toast({
            title: "Photograph liked",
            description: "Your appreciation has been recorded.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Could not like the photograph.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: photoId },
      {
        onSuccess: () => {
          toast({
            title: "Photograph removed",
            description: "The print has been taken down.",
          });
          window.location.href = "/photos";
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Could not remove the photograph.",
            variant: "destructive"
          });
        }
      }
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
        <div className="w-full lg:w-2/3 flex items-start justify-center bg-secondary/20 rounded-sm p-4 border border-border/50">
          <img 
            src={photo.imageUrl} 
            alt={photo.title} 
            className="max-h-[80vh] w-auto object-contain shadow-2xl"
          />
        </div>

        {/* Metadata Sidebar */}
        <div className="w-full lg:w-1/3 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h1 className="font-serif text-4xl font-bold leading-tight">{photo.title}</h1>
            
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer">
                      Remove Photograph
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the photograph "{photo.title}" from the gallery. This action cannot be undone.
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
          </div>

          <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground font-mono">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(photo.createdAt), 'MMMM d, yyyy')}</span>
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
              <Heart className={`w-4 h-4 ${likeMutation.isPending ? 'animate-pulse' : ''}`} />
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
