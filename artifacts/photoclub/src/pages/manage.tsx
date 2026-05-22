import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateClub,
  useUpdateClub,
  useCreateTheme,
  useUpdateTheme,
  useDeleteTheme,
  useCreatePhotographer,
  useUpdatePhotographer,
  useListClubs,
  useListThemes,
  useListPhotographers,
  getListClubsQueryKey,
  getListThemesQueryKey,
  getListPhotographersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ObjectUploader } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Users, LayoutDashboard, User, Camera, Pencil, Trash2, X } from "lucide-react";

const clubSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

const themeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

const photographerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  bio: z.string().optional(),
  clubId: z.coerce.number().optional(),
});

type ClubFormValues = z.infer<typeof clubSchema>;
type ThemeFormValues = z.infer<typeof themeSchema>;
type PhotographerFormValues = z.infer<typeof photographerSchema>;

export default function Manage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clubs } = useListClubs();
  const { data: themes } = useListThemes();
  const { data: photographers } = useListPhotographers();

  // Mutations
  const createClubMutation = useCreateClub();
  const updateClubMutation = useUpdateClub();
  const createThemeMutation = useCreateTheme();
  const updateThemeMutation = useUpdateTheme();
  const deleteThemeMutation = useDeleteTheme();
  const createPhotographerMutation = useCreatePhotographer();
  const updatePhotographerMutation = useUpdatePhotographer();

  // ── Club state ────────────────────────────────────────────
  const [editingClubId, setEditingClubId] = useState<number | null>(null);
  const clubFormRef = useRef<HTMLDivElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const pendingLogoPathRef = useRef<string | null>(null);

  // ── Theme state ───────────────────────────────────────────
  const [editingThemeId, setEditingThemeId] = useState<number | null>(null);
  const themeFormRef = useRef<HTMLDivElement>(null);

  // ── Photographer state ────────────────────────────────────
  const [editingPhotographerId, setEditingPhotographerId] = useState<number | null>(null);
  const photographerFormRef = useRef<HTMLDivElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const pendingObjectPathRef = useRef<string | null>(null);
  const [theme1, setTheme1] = useState("none");
  const [theme2, setTheme2] = useState("none");
  const theme2Options = themes?.filter((t) => t.id.toString() !== theme1) ?? [];

  // ── Forms ─────────────────────────────────────────────────
  const clubForm = useForm<ClubFormValues>({
    resolver: zodResolver(clubSchema),
    defaultValues: { name: "", description: "", location: "", websiteUrl: "" },
  });

  const themeForm = useForm<ThemeFormValues>({
    resolver: zodResolver(themeSchema),
    defaultValues: { name: "", description: "" },
  });

  const photographerForm = useForm<PhotographerFormValues>({
    resolver: zodResolver(photographerSchema),
    defaultValues: { name: "", bio: "" },
  });

  // ── Club handlers ─────────────────────────────────────────
  const startEditingClub = (clubId: number) => {
    const club = clubs?.find((c) => c.id === clubId);
    if (!club) return;
    setEditingClubId(clubId);
    setLogoUrl(club.logoUrl ?? null);
    clubForm.reset({ name: club.name, description: club.description ?? "", location: club.location ?? "", websiteUrl: club.websiteUrl ?? "" });
    setTimeout(() => clubFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const cancelEditingClub = () => {
    setEditingClubId(null);
    setLogoUrl(null);
    clubForm.reset({ name: "", description: "", location: "", websiteUrl: "" });
  };

  const onClubSubmit = (values: ClubFormValues) => {
    const data: ClubFormValues & { logoUrl?: string } = { ...values };
    if (!data.websiteUrl) delete data.websiteUrl;
    if (logoUrl) data.logoUrl = logoUrl;

    if (editingClubId !== null) {
      updateClubMutation.mutate({ id: editingClubId, data }, {
        onSuccess: () => {
          toast({ title: "Club Updated", description: `${values.name} has been saved.` });
          cancelEditingClub();
          queryClient.invalidateQueries({ queryKey: getListClubsQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to update club", variant: "destructive" }),
      });
    } else {
      createClubMutation.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "Community Established", description: `${values.name} has been created.` });
          clubForm.reset({ name: "", description: "", location: "", websiteUrl: "" });
          setLogoUrl(null);
          queryClient.invalidateQueries({ queryKey: getListClubsQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to create club", variant: "destructive" }),
      });
    }
  };

  // ── Theme handlers ────────────────────────────────────────
  const startEditingTheme = (themeId: number) => {
    const theme = themes?.find((t) => t.id === themeId);
    if (!theme) return;
    setEditingThemeId(themeId);
    themeForm.reset({ name: theme.name, description: theme.description ?? "" });
    setTimeout(() => themeFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const cancelEditingTheme = () => {
    setEditingThemeId(null);
    themeForm.reset({ name: "", description: "" });
  };

  const onThemeSubmit = (values: ThemeFormValues) => {
    if (editingThemeId !== null) {
      updateThemeMutation.mutate({ id: editingThemeId, data: values }, {
        onSuccess: () => {
          toast({ title: "Theme Updated", description: `${values.name} has been saved.` });
          cancelEditingTheme();
          queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to update theme", variant: "destructive" }),
      });
    } else {
      createThemeMutation.mutate({ data: values }, {
        onSuccess: () => {
          toast({ title: "Theme Created", description: `${values.name} is now available.` });
          themeForm.reset();
          queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to create theme", variant: "destructive" }),
      });
    }
  };

  const deleteTheme = (themeId: number, name: string) => {
    if (!confirm(`Delete theme "${name}"? This cannot be undone.`)) return;
    deleteThemeMutation.mutate({ id: themeId }, {
      onSuccess: () => {
        toast({ title: "Theme Deleted", description: `${name} has been removed.` });
        if (editingThemeId === themeId) cancelEditingTheme();
        queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to delete theme", variant: "destructive" }),
    });
  };

  // ── Photographer handlers ─────────────────────────────────
  const startEditingPhotographer = (photographerId: number) => {
    const p = photographers?.find((p) => p.id === photographerId);
    if (!p) return;
    setEditingPhotographerId(photographerId);
    setAvatarUrl(p.avatarUrl ?? null);
    setTheme1(p.themeId1?.toString() ?? "none");
    setTheme2(p.themeId2?.toString() ?? "none");
    photographerForm.reset({ name: p.name, bio: p.bio ?? "", clubId: p.clubId ?? undefined });
    setTimeout(() => photographerFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const cancelEditingPhotographer = () => {
    setEditingPhotographerId(null);
    setAvatarUrl(null);
    setTheme1("none");
    setTheme2("none");
    photographerForm.reset({ name: "", bio: "" });
  };

  const onPhotographerSubmit = (values: PhotographerFormValues) => {
    const themeData = {
      ...(theme1 !== "none" ? { themeId1: Number(theme1) } : { themeId1: null }),
      ...(theme2 !== "none" ? { themeId2: Number(theme2) } : { themeId2: null }),
    };

    if (editingPhotographerId !== null) {
      const data = {
        ...values,
        ...(avatarUrl ? { avatarUrl } : {}),
        ...themeData,
      };
      updatePhotographerMutation.mutate({ id: editingPhotographerId, data }, {
        onSuccess: () => {
          toast({ title: "Profile Updated", description: `${values.name} has been saved.` });
          cancelEditingPhotographer();
          queryClient.invalidateQueries({ queryKey: getListPhotographersQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to update profile", variant: "destructive" }),
      });
    } else {
      const data = {
        ...values,
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(theme1 !== "none" ? { themeId1: Number(theme1) } : {}),
        ...(theme2 !== "none" ? { themeId2: Number(theme2) } : {}),
      };
      createPhotographerMutation.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "Profile Created", description: `${values.name} has joined.` });
          cancelEditingPhotographer();
          queryClient.invalidateQueries({ queryKey: getListPhotographersQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to create profile", variant: "destructive" }),
      });
    }
  };

  const isClubPending = (editingClubId !== null ? updateClubMutation.isPending : createClubMutation.isPending) || logoUploading;
  const isThemePending = editingThemeId !== null ? updateThemeMutation.isPending : createThemeMutation.isPending;
  const isPhotographerPending = (editingPhotographerId !== null ? updatePhotographerMutation.isPending : createPhotographerMutation.isPending) || avatarUploading;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-bold mb-4">Administration</h1>
        <p className="text-muted-foreground text-lg">Manage the gallery's foundational data.</p>
      </div>

      <Tabs defaultValue="club" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-secondary border border-border/50">
          <TabsTrigger value="club" className="data-[state=active]:bg-background">
            <Users className="w-4 h-4 mr-2" />Club
          </TabsTrigger>
          <TabsTrigger value="theme" className="data-[state=active]:bg-background">
            <LayoutDashboard className="w-4 h-4 mr-2" />Theme
          </TabsTrigger>
          <TabsTrigger value="photographer" className="data-[state=active]:bg-background">
            <User className="w-4 h-4 mr-2" />Photographer
          </TabsTrigger>
        </TabsList>

        {/* ── Club tab ─────────────────────────────────────── */}
        <TabsContent value="club" className="space-y-6">
          <div ref={clubFormRef} className="bg-secondary/20 p-6 rounded-lg border border-border/50 scroll-mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl font-medium">
                {editingClubId !== null ? "Edit Community" : "Create Community"}
              </h2>
              {editingClubId !== null && (
                <button type="button" onClick={cancelEditingClub} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />Cancel
                </button>
              )}
            </div>

            <Form {...clubForm}>
              <form onSubmit={clubForm.handleSubmit(onClubSubmit)} className="space-y-4">
                <div className="flex flex-col items-center gap-3 pb-2">
                  <ObjectUploader
                    key={`club-logo-${editingClubId ?? "create"}`}
                    maxNumberOfFiles={1} maxFileSize={5 * 1024 * 1024}
                    onGetUploadParameters={async (file) => {
                      const res = await fetch("/api/storage/uploads/request-url", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) });
                      if (!res.ok) throw new Error("Failed to get upload URL");
                      const data = await res.json() as { uploadURL: string; objectPath: string };
                      pendingLogoPathRef.current = data.objectPath;
                      setLogoUploading(true);
                      return { method: "PUT" as const, url: data.uploadURL, headers: { "Content-Type": file.type ?? "image/jpeg" } };
                    }}
                    onComplete={(result) => {
                      setLogoUploading(false);
                      if ((result.failed?.length ?? 0) > 0) { toast({ title: "Upload failed", description: "Could not upload logo.", variant: "destructive" }); return; }
                      const objectPath = pendingLogoPathRef.current;
                      pendingLogoPathRef.current = null;
                      if (objectPath) setLogoUrl(`/api/storage${objectPath}`);
                    }}
                    buttonClassName="group relative w-24 h-24 rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary/60 overflow-hidden flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  >
                    {logoUploading ? <div className="w-full h-full flex items-center justify-center"><div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
                      : logoUrl ? <><img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="w-5 h-5 text-white" /></div></>
                      : <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors"><Camera className="w-6 h-6" /><span className="text-[10px] uppercase tracking-wider">Logo</span></div>}
                  </ObjectUploader>
                  <p className="text-xs text-muted-foreground">Click to upload a club logo (optional)</p>
                </div>

                <FormField control={clubForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Club Name *</FormLabel><FormControl><Input {...field} className="bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={clubForm.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} className="bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={clubForm.control} name="websiteUrl" render={({ field }) => (
                  <FormItem><FormLabel>Website URL</FormLabel><FormControl><Input {...field} className="bg-background" placeholder="https://..." /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={clubForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="bg-background resize-none h-24 font-serif" /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="flex gap-3 pt-2">
                  {editingClubId !== null && <Button type="button" variant="outline" onClick={cancelEditingClub} className="flex-1">Cancel</Button>}
                  <Button type="submit" disabled={isClubPending} className="flex-1">
                    {editingClubId !== null ? "Save Changes" : "Establish Community"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {clubs && clubs.length > 0 && (
            <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50">
                <h3 className="font-serif text-lg font-medium">Existing Clubs</h3>
              </div>
              <ul className="divide-y divide-border/50">
                {clubs.map((club) => (
                  <li key={club.id} className="flex items-center gap-4 px-6 py-4">
                    {club.logoUrl ? (
                      <img src={club.logoUrl} alt={club.name} className="h-10 w-auto max-w-[120px] object-contain shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 shrink-0 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary/60" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{club.name}</p>
                      {club.location && <p className="text-xs text-muted-foreground truncate">{club.location}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono shrink-0">
                      <span>{club.memberCount} members</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>{club.photoCount} prints</span>
                    </div>
                    <Button type="button" variant={editingClubId === club.id ? "default" : "ghost"} size="sm" className="shrink-0 gap-1.5" onClick={() => startEditingClub(club.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                      {editingClubId === club.id ? "Editing…" : "Edit"}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* ── Theme tab ─────────────────────────────────────── */}
        <TabsContent value="theme" className="space-y-6">
          <div ref={themeFormRef} className="bg-secondary/20 p-6 rounded-lg border border-border/50 scroll-mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl font-medium">
                {editingThemeId !== null ? "Edit Theme" : "Create Theme"}
              </h2>
              {editingThemeId !== null && (
                <button type="button" onClick={cancelEditingTheme} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />Cancel
                </button>
              )}
            </div>

            <Form {...themeForm}>
              <form onSubmit={themeForm.handleSubmit(onThemeSubmit)} className="space-y-4">
                <FormField control={themeForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Theme Name *</FormLabel><FormControl><Input {...field} className="bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={themeForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="bg-background resize-none h-24 font-serif" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="flex gap-3 pt-2">
                  {editingThemeId !== null && <Button type="button" variant="outline" onClick={cancelEditingTheme} className="flex-1">Cancel</Button>}
                  <Button type="submit" disabled={isThemePending} className="flex-1">
                    {editingThemeId !== null ? "Save Changes" : "Define Theme"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {themes && themes.length > 0 && (
            <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50">
                <h3 className="font-serif text-lg font-medium">Existing Themes</h3>
              </div>
              <ul className="divide-y divide-border/50">
                {themes.map((theme) => (
                  <li key={theme.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{theme.name}</p>
                      {theme.description && <p className="text-xs text-muted-foreground truncate">{theme.description}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">{theme.photoCount} photos</span>
                    <Button type="button" variant={editingThemeId === theme.id ? "default" : "ghost"} size="sm" className="shrink-0 gap-1.5" onClick={() => startEditingTheme(theme.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                      {editingThemeId === theme.id ? "Editing…" : "Edit"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTheme(theme.id, theme.name)} disabled={deleteThemeMutation.isPending}>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* ── Photographer tab ──────────────────────────────── */}
        <TabsContent value="photographer" className="space-y-6">
          <div ref={photographerFormRef} className="bg-secondary/20 p-6 rounded-lg border border-border/50 scroll-mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl font-medium">
                {editingPhotographerId !== null ? "Edit Photographer" : "Add Photographer"}
              </h2>
              {editingPhotographerId !== null && (
                <button type="button" onClick={cancelEditingPhotographer} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />Cancel
                </button>
              )}
            </div>

            <Form {...photographerForm}>
              <form onSubmit={photographerForm.handleSubmit(onPhotographerSubmit)} className="space-y-5">

                {/* Avatar upload */}
                <div className="flex flex-col items-center gap-3">
                  <ObjectUploader
                    key={`photographer-avatar-${editingPhotographerId ?? "create"}`}
                    maxNumberOfFiles={1} maxFileSize={5 * 1024 * 1024}
                    onGetUploadParameters={async (file) => {
                      const res = await fetch("/api/storage/uploads/request-url", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) });
                      if (!res.ok) throw new Error("Failed to get upload URL");
                      const data = await res.json() as { uploadURL: string; objectPath: string };
                      pendingObjectPathRef.current = data.objectPath;
                      setAvatarUploading(true);
                      return { method: "PUT" as const, url: data.uploadURL, headers: { "Content-Type": file.type ?? "image/jpeg" } };
                    }}
                    onComplete={(result) => {
                      setAvatarUploading(false);
                      if ((result.failed?.length ?? 0) > 0) { toast({ title: "Upload failed", description: "Could not upload avatar.", variant: "destructive" }); return; }
                      const objectPath = pendingObjectPathRef.current;
                      pendingObjectPathRef.current = null;
                      if (objectPath) setAvatarUrl(`/api/storage${objectPath}`);
                    }}
                    buttonClassName="group relative w-24 h-24 rounded-full bg-secondary border-2 border-dashed border-border hover:border-primary/60 overflow-hidden flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  >
                    {avatarUploading ? <div className="w-full h-full flex items-center justify-center"><div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
                      : avatarUrl ? <><img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="w-5 h-5 text-white" /></div></>
                      : <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors"><Camera className="w-6 h-6" /><span className="text-[10px] uppercase tracking-wider">Photo</span></div>}
                  </ObjectUploader>
                  <p className="text-xs text-muted-foreground">Click to upload a profile picture (optional)</p>
                </div>

                <FormField control={photographerForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} className="bg-background" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={photographerForm.control} name="clubId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Club</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString() ?? ""}>
                      <FormControl>
                        <SelectTrigger className="bg-background"><SelectValue placeholder="Optional" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clubs?.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-medium mb-1.5">Specialty Theme 1</p>
                    <Select value={theme1} onValueChange={(v) => { setTheme1(v); if (v === theme2) setTheme2("none"); }}>
                      <SelectTrigger className="bg-background"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {themes?.map((t) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Specialty Theme 2</p>
                    <Select value={theme2} onValueChange={setTheme2} disabled={theme1 === "none"}>
                      <SelectTrigger className="bg-background disabled:opacity-50"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {theme2Options.map((t) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <FormField control={photographerForm.control} name="bio" render={({ field }) => (
                  <FormItem><FormLabel>Biography</FormLabel><FormControl><Textarea {...field} className="bg-background resize-none h-24 font-serif" /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="flex gap-3 pt-2">
                  {editingPhotographerId !== null && <Button type="button" variant="outline" onClick={cancelEditingPhotographer} className="flex-1">Cancel</Button>}
                  <Button type="submit" disabled={isPhotographerPending} className="flex-1">
                    {editingPhotographerId !== null ? "Save Changes" : "Register Profile"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {photographers && photographers.length > 0 && (
            <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50">
                <h3 className="font-serif text-lg font-medium">Existing Photographers</h3>
              </div>
              <ul className="divide-y divide-border/50">
                {photographers.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-primary/60" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      {p.clubName && <p className="text-xs text-muted-foreground truncate">{p.clubName}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">{p.photoCount} prints</span>
                    <Button type="button" variant={editingPhotographerId === p.id ? "default" : "ghost"} size="sm" className="shrink-0 gap-1.5" onClick={() => startEditingPhotographer(p.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                      {editingPhotographerId === p.id ? "Editing…" : "Edit"}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
