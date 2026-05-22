import { useState } from "react";
import { Link } from "wouter";
import { useUser, useClerk, Show } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, LogOut, Link2, PlusCircle, Trash2, User, ExternalLink, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import {
  useListPhotos,
  getListPhotosQueryKey,
  useDeletePhoto,
  useListPhotographers,
  useListThemes,
  useUpdatePhotographer,
  getGetPhotographerQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type PhotographerProfile = {
  id: number;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  clubId: number | null;
  clubName: string | null;
  themeId1: number | null;
  themeName1: string | null;
  themeId2: number | null;
  themeName2: string | null;
  createdAt: string;
};

function useMyProfile() {
  const [profile, setProfile] = useState<PhotographerProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.status === 404) {
        setProfile(null);
      } else if (res.ok) {
        setProfile(await res.json());
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    fetchProfile();
  });

  return { profile, loading, refetch: fetchProfile };
}

function LinkProfilePanel({ onLinked }: { onLinked: () => void }) {
  const { data: photographers } = useListPhotographers();
  const { data: themes } = useListThemes();
  const { toast } = useToast();
  const [mode, setMode] = useState<"link" | "create">("link");
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [theme1, setTheme1] = useState("none");
  const [theme2, setTheme2] = useState("none");
  const [busy, setBusy] = useState(false);

  const handleLink = async () => {
    if (!selectedId) return;
    setBusy(true);
    const res = await fetch("/api/me/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ photographerId: Number(selectedId) }),
    });
    setBusy(false);
    if (res.ok) {
      toast({ title: "Profile linked", description: "Your account is now linked to your photographer profile." });
      onLinked();
    } else {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const body: Record<string, unknown> = { name: newName.trim() };
    if (theme1 !== "none") body.themeId1 = Number(theme1);
    if (theme2 !== "none") body.themeId2 = Number(theme2);
    const res = await fetch("/api/me/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      toast({ title: "Profile created", description: "Your photographer profile has been created." });
      onLinked();
    } else {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
    }
  };

  // Prevent picking the same theme twice
  const theme2Options = themes?.filter((t) => t.id.toString() !== theme1) ?? [];

  return (
    <div className="max-w-md mx-auto text-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
        <Link2 className="w-7 h-7 text-primary" />
      </div>
      <h2 className="font-serif text-2xl mb-2">Connect your profile</h2>
      <p className="text-muted-foreground text-sm mb-8">
        Link your account to an existing photographer profile, or create a new one.
      </p>

      <div className="flex gap-2 justify-center mb-8">
        <Button variant={mode === "link" ? "default" : "outline"} size="sm" onClick={() => setMode("link")}>
          Link existing
        </Button>
        <Button variant={mode === "create" ? "default" : "outline"} size="sm" onClick={() => setMode("create")}>
          Create new
        </Button>
      </div>

      {mode === "link" ? (
        <div className="space-y-3">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="bg-secondary/20 border-border/50">
              <SelectValue placeholder="Select your photographer profile..." />
            </SelectTrigger>
            <SelectContent>
              {photographers?.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleLink} disabled={!selectedId || busy} className="w-full">
            {busy ? "Linking..." : "Link profile"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-left">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Your photographer name"
            className="bg-secondary/20 border-border/50"
          />

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 pl-0.5">
              Specialty theme 1 <span className="normal-case">(optional)</span>
            </p>
            <Select value={theme1} onValueChange={(v) => { setTheme1(v); if (v === theme2) setTheme2("none"); }}>
              <SelectTrigger className="bg-secondary/20 border-border/50">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {themes?.map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 pl-0.5">
              Specialty theme 2 <span className="normal-case">(optional)</span>
            </p>
            <Select value={theme2} onValueChange={setTheme2} disabled={theme1 === "none"}>
              <SelectTrigger className="bg-secondary/20 border-border/50">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {theme2Options.map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleCreate} disabled={!newName.trim() || busy} className="w-full">
            {busy ? "Creating..." : "Create profile"}
          </Button>
        </div>
      )}
    </div>
  );
}

function EditThemesPanel({
  profile,
  onSaved,
}: {
  profile: PhotographerProfile;
  onSaved: () => void;
}) {
  const { data: themes } = useListThemes();
  const updateMutation = useUpdatePhotographer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [theme1, setTheme1] = useState(profile.themeId1?.toString() ?? "none");
  const [theme2, setTheme2] = useState(profile.themeId2?.toString() ?? "none");
  const [open, setOpen] = useState(false);

  const theme2Options = themes?.filter((t) => t.id.toString() !== theme1) ?? [];

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: profile.id,
        data: {
          themeId1: theme1 !== "none" ? Number(theme1) : null,
          themeId2: theme2 !== "none" ? Number(theme2) : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Themes updated", description: "Your specialty themes have been saved." });
          queryClient.invalidateQueries({ queryKey: getGetPhotographerQueryKey(profile.id) });
          setOpen(false);
          onSaved();
        },
        onError: () => {
          toast({ title: "Error", description: "Could not update themes.", variant: "destructive" });
        },
      },
    );
  };

  if (!open) {
    const themeNames = [profile.themeName1, profile.themeName2].filter(Boolean) as string[];
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {themeNames.length > 0 ? (
          themeNames.map((n) => (
            <Badge key={n} variant="secondary" className="font-mono">
              {n}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No specialty themes set</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <Pencil className="w-3 h-3" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
      <Select
        value={theme1}
        onValueChange={(v) => {
          setTheme1(v);
          if (v === theme2) setTheme2("none");
        }}
      >
        <SelectTrigger className="w-44 bg-background border-border/50 h-8 text-sm">
          <SelectValue placeholder="Theme 1" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {themes?.map((t) => (
            <SelectItem key={t.id} value={t.id.toString()}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={theme2} onValueChange={setTheme2} disabled={theme1 === "none"}>
        <SelectTrigger className="w-44 bg-background border-border/50 h-8 text-sm">
          <SelectValue placeholder="Theme 2" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {theme2Options.map((t) => (
            <SelectItem key={t.id} value={t.id.toString()}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-8 px-3 gap-1"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          <Check className="w-3.5 h-3.5" />
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setOpen(false)}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MyPhotosDashboard({
  profile,
  onProfileUpdated,
}: {
  profile: PhotographerProfile;
  onProfileUpdated: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const { user } = useUser();

  const { data: photos = [], isLoading } = useListPhotos(
    { photographerId: profile.id },
    { query: { queryKey: getListPhotosQueryKey({ photographerId: profile.id }) } },
  );

  const deleteMutation = useDeletePhoto();

  const handleDelete = (photoId: number, title: string) => {
    deleteMutation.mutate(
      { id: photoId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey({ photographerId: profile.id }) });
          toast({ title: "Photograph removed", description: `"${title}" has been deleted.` });
        },
        onError: () =>
          toast({ title: "Error", description: "Could not delete the photograph.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary border border-border overflow-hidden flex items-center justify-center shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="font-serif text-3xl font-bold">{profile.name}</h1>
            {profile.clubName && <p className="text-sm text-muted-foreground">{profile.clubName}</p>}
            {user?.primaryEmailAddress && (
              <p className="text-xs text-muted-foreground font-mono">
                {user.primaryEmailAddress.emailAddress}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/photographers/${profile.id}`}>
            <Button variant="outline" size="sm" className="gap-2 border-border/50">
              <ExternalLink className="w-3.5 h-3.5" />
              Public profile
            </Button>
          </Link>
          <Link href="/upload">
            <Button size="sm" className="gap-2">
              <PlusCircle className="w-4 h-4" />
              Upload photo
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Specialty themes row */}
      <div className="mb-8 pb-6 border-b border-border/40">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Specialty Themes</p>
        <EditThemesPanel profile={profile} onSaved={onProfileUpdated} />
      </div>

      {/* Stats bar */}
      <div className="flex gap-8 mb-10 pb-8 border-b border-border/40">
        <div>
          <div className="text-3xl font-serif font-bold">{photos.length}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest">Photographs</div>
        </div>
        <div>
          <div className="text-3xl font-serif font-bold">
            {photos.reduce((sum, p) => sum + (p.likeCount || 0), 0)}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest">Total likes</div>
        </div>
        <div>
          <div className="text-3xl font-serif font-bold">
            {photos.reduce((sum, p) => sum + (p.commentCount ?? 0), 0)}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest">Comments received</div>
        </div>
      </div>

      {/* Photo grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-muted rounded-sm animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-20">
          <Camera className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-serif text-xl text-muted-foreground mb-2">No photographs yet</p>
          <p className="text-sm text-muted-foreground mb-6">Your darkroom is empty. Start uploading your work.</p>
          <Link href="/upload">
            <Button className="gap-2">
              <PlusCircle className="w-4 h-4" />
              Upload your first photo
            </Button>
          </Link>
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo, i) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="group relative"
              >
                <Link href={`/photos/${photo.id}`} className="block aspect-[4/5] overflow-hidden bg-muted rounded-sm">
                  <img
                    src={photo.imageUrl}
                    alt={photo.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 rounded-sm" />
                </Link>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this photograph?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{photo.title}" will be permanently removed from the gallery.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(photo.id, photo.title)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="mt-2">
                  <p className="font-serif text-sm font-medium leading-tight line-clamp-1">{photo.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {format(new Date(photo.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}

export default function MyPhotos() {
  const { profile, loading, refetch } = useMyProfile();

  return (
    <Show
      when="signed-in"
      fallback={
        <div className="container mx-auto px-4 py-24 text-center">
          <Camera className="w-12 h-12 text-muted-foreground/30 mx-auto mb-6" />
          <h2 className="font-serif text-3xl mb-3">Sign in to manage your photos</h2>
          <p className="text-muted-foreground mb-8">Access your personal darkroom and manage your work.</p>
          <Link href="/sign-in">
            <Button>Sign in</Button>
          </Link>
        </div>
      }
    >
      {loading ? (
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center gap-4 mb-10 animate-pulse">
            <div className="w-14 h-14 rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-40" />
              <div className="h-3 bg-muted rounded w-24" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-muted rounded-sm animate-pulse" />
            ))}
          </div>
        </div>
      ) : profile === null ? (
        <LinkProfilePanel onLinked={refetch} />
      ) : profile ? (
        <MyPhotosDashboard profile={profile} onProfileUpdated={refetch} />
      ) : null}
    </Show>
  );
}
