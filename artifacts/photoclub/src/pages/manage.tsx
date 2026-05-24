import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  useGetAdminStatus,
  useListAdmins,
  useAddAdmin,
  useUpdateAdmin,
  useRemoveAdmin,
  useListInvites,
  useCreateInvite,
  useRevokeInvite,
  getListClubsQueryKey,
  getListThemesQueryKey,
  getListPhotographersQueryKey,
  getListAdminsQueryKey,
  getGetAdminStatusQueryKey,
  getListInvitesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
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
import { Users, LayoutDashboard, User, Camera, Pencil, Trash2, X, ShieldCheck, UserPlus, Link2, Copy, Check } from "lucide-react";

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
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userId, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const { data: clubs } = useListClubs();
  const { data: themes } = useListThemes();
  const { data: photographers } = useListPhotographers();
  const { data: adminStatus } = useGetAdminStatus({ query: { enabled: !!isSignedIn, retry: false, queryKey: getGetAdminStatusQueryKey() } });
  const { data: adminList } = useListAdmins({ query: { enabled: !!adminStatus?.isAdmin, retry: false, queryKey: getListAdminsQueryKey() } });

  // Add admin form state
  const [newAdminClerkId, setNewAdminClerkId] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  // Edit admin state
  const [editingAdminId, setEditingAdminId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Admin mutations
  const addAdminMutation = useAddAdmin();
  const updateAdminMutation = useUpdateAdmin();
  const removeAdminMutation = useRemoveAdmin();

  // Invite state
  const { data: inviteList } = useListInvites({ query: { enabled: !!adminStatus?.isAdmin, queryKey: getListInvitesQueryKey() } });
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteExpiryDays, setInviteExpiryDays] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const createInviteMutation = useCreateInvite();
  const revokeInviteMutation = useRevokeInvite();

  const handleCreateInvite = () => {
    createInviteMutation.mutate(
      {
        data: {
          label: inviteLabel.trim() || "Invite",
          maxUses: inviteMaxUses ? parseInt(inviteMaxUses, 10) : null,
          expiresInDays: inviteExpiryDays ? parseInt(inviteExpiryDays, 10) : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("manage.admins.toastInviteCreatedTitle") });
          setInviteLabel("");
          setInviteMaxUses("");
          setInviteExpiryDays("");
          queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.admins.toastInviteCreateError"), variant: "destructive" }),
      },
    );
  };

  const handleRevokeInvite = (id: number) => {
    revokeInviteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("manage.admins.toastInviteRevokedTitle") });
          queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.admins.toastInviteRevokeError"), variant: "destructive" }),
      },
    );
  };

  const copyInviteLink = (tokenId: number, token: string) => {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(tokenId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBootstrap = async () => {
    try {
      // Send real name/email from Clerk frontend session — no secret key needed
      const displayName =
        [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
        clerkUser?.username ||
        clerkUser?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
        "Admin";
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;

      const res = await fetch("/api/admins/bootstrap", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
      if (!res.ok) throw new Error();
      toast({ title: t("manage.admins.toastBootstrapTitle"), description: t("manage.admins.toastBootstrapDesc") });
      queryClient.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
    } catch {
      toast({ title: t("common.error"), description: t("manage.admins.toastBootstrapError"), variant: "destructive" });
    }
  };

  const handleAddAdmin = () => {
    if (!newAdminClerkId.trim()) return;
    addAdminMutation.mutate(
      { data: { clerkUserId: newAdminClerkId.trim(), displayName: newAdminName.trim() || undefined } },
      {
        onSuccess: (added) => {
          toast({ title: t("manage.admins.toastAddedTitle"), description: t("manage.admins.toastAddedDesc", { name: added.displayName }) });
          setNewAdminClerkId("");
          setNewAdminName("");
          queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.admins.toastAddError"), variant: "destructive" }),
      },
    );
  };

  const startEditAdmin = (admin: { id: number; displayName: string; email?: string | null }) => {
    setEditingAdminId(admin.id);
    setEditName(admin.displayName);
    setEditEmail(admin.email ?? "");
  };

  const cancelEditAdmin = () => {
    setEditingAdminId(null);
    setEditName("");
    setEditEmail("");
  };

  const handleUpdateAdmin = (id: number) => {
    if (!editName.trim()) return;
    updateAdminMutation.mutate(
      { id, data: { displayName: editName.trim(), email: editEmail.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: t("manage.admins.toastUpdatedTitle") });
          cancelEditAdmin();
          queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.admins.toastUpdateError"), variant: "destructive" }),
      },
    );
  };

  const handleRemoveAdmin = (id: number, name: string) => {
    if (!confirm(t("manage.admins.removeConfirm", { name }))) return;
    removeAdminMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("manage.admins.toastRemovedTitle") });
          queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.admins.toastRemoveError"), variant: "destructive" }),
      },
    );
  };

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
  const theme2Options = themes?.filter((th) => th.id.toString() !== theme1) ?? [];

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
          toast({ title: t("manage.club.toastUpdatedTitle"), description: t("manage.club.toastUpdatedDesc", { name: values.name }) });
          cancelEditingClub();
          queryClient.invalidateQueries({ queryKey: getListClubsQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.club.toastUpdateError"), variant: "destructive" }),
      });
    } else {
      createClubMutation.mutate({ data }, {
        onSuccess: () => {
          toast({ title: t("manage.club.toastCreatedTitle"), description: t("manage.club.toastCreatedDesc", { name: values.name }) });
          clubForm.reset({ name: "", description: "", location: "", websiteUrl: "" });
          setLogoUrl(null);
          queryClient.invalidateQueries({ queryKey: getListClubsQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.club.toastCreateError"), variant: "destructive" }),
      });
    }
  };

  // ── Theme handlers ────────────────────────────────────────
  const startEditingTheme = (themeId: number) => {
    const theme = themes?.find((th) => th.id === themeId);
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
          toast({ title: t("manage.theme.toastUpdatedTitle"), description: t("manage.theme.toastUpdatedDesc", { name: values.name }) });
          cancelEditingTheme();
          queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.theme.toastUpdateError"), variant: "destructive" }),
      });
    } else {
      createThemeMutation.mutate({ data: values }, {
        onSuccess: () => {
          toast({ title: t("manage.theme.toastCreatedTitle"), description: t("manage.theme.toastCreatedDesc", { name: values.name }) });
          themeForm.reset();
          queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.theme.toastCreateError"), variant: "destructive" }),
      });
    }
  };

  const deleteTheme = (themeId: number, name: string) => {
    if (!confirm(t("manage.theme.confirmDelete", { name }))) return;
    deleteThemeMutation.mutate({ id: themeId }, {
      onSuccess: () => {
        toast({ title: t("manage.theme.toastDeletedTitle"), description: t("manage.theme.toastDeletedDesc", { name }) });
        if (editingThemeId === themeId) cancelEditingTheme();
        queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });
      },
      onError: () => toast({ title: t("common.error"), description: t("manage.theme.toastDeleteError"), variant: "destructive" }),
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
          toast({ title: t("manage.photographer.toastUpdatedTitle"), description: t("manage.photographer.toastUpdatedDesc", { name: values.name }) });
          cancelEditingPhotographer();
          queryClient.invalidateQueries({ queryKey: getListPhotographersQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.photographer.toastUpdateError"), variant: "destructive" }),
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
          toast({ title: t("manage.photographer.toastCreatedTitle"), description: t("manage.photographer.toastCreatedDesc", { name: values.name }) });
          cancelEditingPhotographer();
          queryClient.invalidateQueries({ queryKey: getListPhotographersQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), description: t("manage.photographer.toastCreateError"), variant: "destructive" }),
      });
    }
  };

  const isClubPending = (editingClubId !== null ? updateClubMutation.isPending : createClubMutation.isPending) || logoUploading;
  const isThemePending = editingThemeId !== null ? updateThemeMutation.isPending : createThemeMutation.isPending;
  const isPhotographerPending = (editingPhotographerId !== null ? updatePhotographerMutation.isPending : createPhotographerMutation.isPending) || avatarUploading;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-bold mb-4">{t("manage.title")}</h1>
        <p className="text-muted-foreground text-lg">{t("manage.subtitle")}</p>
      </div>

      <Tabs defaultValue="club" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8 bg-secondary border border-border/50">
          <TabsTrigger value="club" className="data-[state=active]:bg-background">
            <Users className="w-4 h-4 mr-2" />{t("manage.tabs.club")}
          </TabsTrigger>
          <TabsTrigger value="theme" className="data-[state=active]:bg-background">
            <LayoutDashboard className="w-4 h-4 mr-2" />{t("manage.tabs.theme")}
          </TabsTrigger>
          <TabsTrigger value="photographer" className="data-[state=active]:bg-background">
            <User className="w-4 h-4 mr-2" />{t("manage.tabs.photographer")}
          </TabsTrigger>
          <TabsTrigger value="admins" className="data-[state=active]:bg-background">
            <ShieldCheck className="w-4 h-4 mr-2" />{t("manage.tabs.admins")}
          </TabsTrigger>
        </TabsList>

        {/* ── Club tab ─────────────────────────────────────── */}
        <TabsContent value="club" className="space-y-6">
          <div ref={clubFormRef} className="bg-secondary/20 p-6 rounded-lg border border-border/50 scroll-mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl font-medium">
                {editingClubId !== null ? t("manage.club.editTitle") : t("manage.club.createTitle")}
              </h2>
              {editingClubId !== null && (
                <button type="button" onClick={cancelEditingClub} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />{t("common.cancel")}
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
                      if ((result.failed?.length ?? 0) > 0) { toast({ title: t("manage.uploadFailedTitle"), description: t("manage.club.uploadFailedDesc"), variant: "destructive" }); return; }
                      const objectPath = pendingLogoPathRef.current;
                      pendingLogoPathRef.current = null;
                      if (objectPath) setLogoUrl(`/api/storage${objectPath}`);
                    }}
                    buttonClassName="group relative w-24 h-24 rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary/60 overflow-hidden flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  >
                    {logoUploading ? <div className="w-full h-full flex items-center justify-center"><div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
                      : logoUrl ? <><img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="w-5 h-5 text-white" /></div></>
                      : <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors"><Camera className="w-6 h-6" /><span className="text-[10px] uppercase tracking-wider">{t("manage.club.logoLabel")}</span></div>}
                  </ObjectUploader>
                  <p className="text-xs text-muted-foreground">{t("manage.club.logoHint")}</p>
                </div>

                <FormField control={clubForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>{t("manage.club.nameLabel")}</FormLabel><FormControl><Input {...field} className="bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={clubForm.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>{t("manage.club.locationLabel")}</FormLabel><FormControl><Input {...field} className="bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={clubForm.control} name="websiteUrl" render={({ field }) => (
                  <FormItem><FormLabel>{t("manage.club.websiteLabel")}</FormLabel><FormControl><Input {...field} className="bg-background" placeholder="https://..." /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={clubForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>{t("manage.club.descriptionLabel")}</FormLabel><FormControl><Textarea {...field} className="bg-background resize-none h-24 font-serif" /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="flex gap-3 pt-2">
                  {editingClubId !== null && <Button type="button" variant="outline" onClick={cancelEditingClub} className="flex-1">{t("common.cancel")}</Button>}
                  <Button type="submit" disabled={isClubPending} className="flex-1">
                    {editingClubId !== null ? t("common.saveChanges") : t("manage.club.submitCreate")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {clubs && clubs.length > 0 && (
            <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50">
                <h3 className="font-serif text-lg font-medium">{t("manage.club.existingHeading")}</h3>
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
                      <span>{club.memberCount} {t("manage.club.membersSuffix")}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>{club.photoCount} {t("manage.club.printsSuffix")}</span>
                    </div>
                    <Button type="button" variant={editingClubId === club.id ? "default" : "ghost"} size="sm" className="shrink-0 gap-1.5" onClick={() => startEditingClub(club.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                      {editingClubId === club.id ? t("common.editing") : t("common.edit")}
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
                {editingThemeId !== null ? t("manage.theme.editTitle") : t("manage.theme.createTitle")}
              </h2>
              {editingThemeId !== null && (
                <button type="button" onClick={cancelEditingTheme} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />{t("common.cancel")}
                </button>
              )}
            </div>

            <Form {...themeForm}>
              <form onSubmit={themeForm.handleSubmit(onThemeSubmit)} className="space-y-4">
                <FormField control={themeForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>{t("manage.theme.nameLabel")}</FormLabel><FormControl><Input {...field} className="bg-background" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={themeForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>{t("manage.theme.descriptionLabel")}</FormLabel><FormControl><Textarea {...field} className="bg-background resize-none h-24 font-serif" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="flex gap-3 pt-2">
                  {editingThemeId !== null && <Button type="button" variant="outline" onClick={cancelEditingTheme} className="flex-1">{t("common.cancel")}</Button>}
                  <Button type="submit" disabled={isThemePending} className="flex-1">
                    {editingThemeId !== null ? t("common.saveChanges") : t("manage.theme.submitCreate")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {themes && themes.length > 0 && (
            <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50">
                <h3 className="font-serif text-lg font-medium">{t("manage.theme.existingHeading")}</h3>
              </div>
              <ul className="divide-y divide-border/50">
                {themes.map((theme) => (
                  <li key={theme.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{theme.name}</p>
                      {theme.description && <p className="text-xs text-muted-foreground truncate">{theme.description}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">{theme.photoCount} {t("manage.theme.photosSuffix")}</span>
                    <Button type="button" variant={editingThemeId === theme.id ? "default" : "ghost"} size="sm" className="shrink-0 gap-1.5" onClick={() => startEditingTheme(theme.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                      {editingThemeId === theme.id ? t("common.editing") : t("common.edit")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTheme(theme.id, theme.name)} disabled={deleteThemeMutation.isPending}>
                      <Trash2 className="w-3.5 h-3.5" />
                      {t("common.delete")}
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
                {editingPhotographerId !== null ? t("manage.photographer.editTitle") : t("manage.photographer.createTitle")}
              </h2>
              {editingPhotographerId !== null && (
                <button type="button" onClick={cancelEditingPhotographer} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />{t("common.cancel")}
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
                      if ((result.failed?.length ?? 0) > 0) { toast({ title: t("manage.uploadFailedTitle"), description: t("manage.photographer.uploadFailedDesc"), variant: "destructive" }); return; }
                      const objectPath = pendingObjectPathRef.current;
                      pendingObjectPathRef.current = null;
                      if (objectPath) setAvatarUrl(`/api/storage${objectPath}`);
                    }}
                    buttonClassName="group relative w-24 h-24 rounded-full bg-secondary border-2 border-dashed border-border hover:border-primary/60 overflow-hidden flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  >
                    {avatarUploading ? <div className="w-full h-full flex items-center justify-center"><div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
                      : avatarUrl ? <><img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera className="w-5 h-5 text-white" /></div></>
                      : <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors"><Camera className="w-6 h-6" /><span className="text-[10px] uppercase tracking-wider">{t("manage.photographer.photoLabel")}</span></div>}
                  </ObjectUploader>
                  <p className="text-xs text-muted-foreground">{t("manage.photographer.avatarHint")}</p>
                </div>

                <FormField control={photographerForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>{t("manage.photographer.nameLabel")}</FormLabel><FormControl><Input {...field} className="bg-background" /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={photographerForm.control} name="clubId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("manage.photographer.primaryClubLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString() ?? ""}>
                      <FormControl>
                        <SelectTrigger className="bg-background"><SelectValue placeholder={t("manage.photographer.primaryClubPlaceholder")} /></SelectTrigger>
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
                    <p className="text-sm font-medium mb-1.5">{t("manage.photographer.specialty1")}</p>
                    <Select value={theme1} onValueChange={(v) => { setTheme1(v); if (v === theme2) setTheme2("none"); }}>
                      <SelectTrigger className="bg-background"><SelectValue placeholder={t("common.none")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("common.none")}</SelectItem>
                        {themes?.map((th) => <SelectItem key={th.id} value={th.id.toString()}>{th.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">{t("manage.photographer.specialty2")}</p>
                    <Select value={theme2} onValueChange={setTheme2} disabled={theme1 === "none"}>
                      <SelectTrigger className="bg-background disabled:opacity-50"><SelectValue placeholder={t("common.none")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("common.none")}</SelectItem>
                        {theme2Options.map((th) => <SelectItem key={th.id} value={th.id.toString()}>{th.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <FormField control={photographerForm.control} name="bio" render={({ field }) => (
                  <FormItem><FormLabel>{t("manage.photographer.biographyLabel")}</FormLabel><FormControl><Textarea {...field} className="bg-background resize-none h-24 font-serif" /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="flex gap-3 pt-2">
                  {editingPhotographerId !== null && <Button type="button" variant="outline" onClick={cancelEditingPhotographer} className="flex-1">{t("common.cancel")}</Button>}
                  <Button type="submit" disabled={isPhotographerPending} className="flex-1">
                    {editingPhotographerId !== null ? t("common.saveChanges") : t("manage.photographer.submitCreate")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {photographers && photographers.length > 0 && (
            <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50">
                <h3 className="font-serif text-lg font-medium">{t("manage.photographer.existingHeading")}</h3>
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
                    <span className="text-xs text-muted-foreground font-mono shrink-0">{p.photoCount} {t("manage.photographer.printsSuffix")}</span>
                    <Button type="button" variant={editingPhotographerId === p.id ? "default" : "ghost"} size="sm" className="shrink-0 gap-1.5" onClick={() => startEditingPhotographer(p.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                      {editingPhotographerId === p.id ? t("common.editing") : t("common.edit")}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* ── Admins tab ────────────────────────────────────── */}
        <TabsContent value="admins" className="space-y-6">
          {/* Not signed in */}
          {!isSignedIn && (
            <div className="bg-secondary/20 p-8 rounded-lg border border-border/50 text-center">
              <ShieldCheck className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("manage.admins.signInRequired")}</p>
            </div>
          )}

          {/* Bootstrap — no admins yet */}
          {isSignedIn && adminStatus && adminStatus.totalAdmins === 0 && (
            <div className="bg-secondary/20 p-8 rounded-lg border border-border/50 text-center space-y-4">
              <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
              <h2 className="font-serif text-2xl font-medium">{t("manage.admins.bootstrapHeading")}</h2>
              <p className="text-muted-foreground max-w-sm mx-auto">{t("manage.admins.bootstrapDesc")}</p>
              <Button onClick={handleBootstrap}>{t("manage.admins.bootstrapBtn")}</Button>
            </div>
          )}

          {/* Not an admin, but admins exist */}
          {isSignedIn && adminStatus && adminStatus.totalAdmins > 0 && !adminStatus.isAdmin && (
            <div className="bg-secondary/20 p-8 rounded-lg border border-border/50 text-center space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground" />
              <h2 className="font-serif text-xl font-medium">{t("manage.admins.notAdminHeading")}</h2>
              <p className="text-muted-foreground">{t("manage.admins.notAdminDesc")}</p>
            </div>
          )}

          {/* Admin panel */}
          {isSignedIn && adminStatus?.isAdmin && (
            <>
              {/* Add admin form */}
              <div className="bg-secondary/20 p-6 rounded-lg border border-border/50 space-y-4">
                <h2 className="font-serif text-2xl font-medium flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />{t("manage.admins.addTitle")}
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">{t("manage.admins.clerkUserIdLabel")}</label>
                    <Input
                      value={newAdminClerkId}
                      onChange={(e) => setNewAdminClerkId(e.target.value)}
                      placeholder={t("manage.admins.clerkUserIdPlaceholder")}
                      className="bg-background font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t("manage.admins.clerkUserIdHint")}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">{t("manage.admins.displayNameLabel")}</label>
                    <Input
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder={t("manage.admins.displayNamePlaceholder")}
                      className="bg-background"
                    />
                  </div>
                  <Button
                    onClick={handleAddAdmin}
                    disabled={!newAdminClerkId.trim() || !newAdminName.trim() || addAdminMutation.isPending}
                    className="w-full"
                  >
                    {t("manage.admins.addBtn")}
                  </Button>
                </div>
              </div>

              {/* Current admins list */}
              {adminList && adminList.length > 0 && (
                <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden">
                  <div className="px-6 py-4 border-b border-border/50">
                    <h3 className="font-serif text-lg font-medium">{t("manage.admins.existingHeading")}</h3>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {adminList.map((admin) => (
                      <li key={admin.id} className="px-6 py-4">
                        {editingAdminId === admin.id ? (
                          /* ── Inline edit form ── */
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ShieldCheck className="w-4 h-4 text-primary/60 shrink-0" />
                              <span className="text-xs text-muted-foreground font-mono truncate">{admin.clerkUserId}</span>
                            </div>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder={t("manage.admins.displayNamePlaceholder")}
                              className="bg-background"
                            />
                            <Input
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="email@example.com"
                              className="bg-background"
                              type="email"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleUpdateAdmin(admin.id)}
                                disabled={!editName.trim() || updateAdminMutation.isPending}
                              >
                                {t("manage.admins.saveBtn")}
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEditAdmin}>
                                <X className="w-3.5 h-3.5 mr-1" />{t("common.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ── Normal row ── */
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <ShieldCheck className="w-4 h-4 text-primary/60" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {admin.displayName}
                                {admin.clerkUserId === userId && (
                                  <span className="ml-2 text-xs text-muted-foreground">{t("manage.admins.youSuffix")}</span>
                                )}
                              </p>
                              {admin.email && <p className="text-xs text-muted-foreground truncate">{admin.email}</p>}
                            </div>
                            <Button
                              type="button"
                              variant={editingAdminId === admin.id ? "default" : "ghost"}
                              size="sm"
                              className="shrink-0 gap-1.5"
                              onClick={() => startEditAdmin(admin)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              {t("manage.admins.editBtn")}
                            </Button>
                            {admin.clerkUserId !== userId && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="shrink-0 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveAdmin(admin.id, admin.displayName)}
                                disabled={removeAdminMutation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t("manage.admins.removeBtn")}
                              </Button>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Invite links section ── */}
              <Separator />
              <div className="bg-secondary/20 p-6 rounded-lg border border-border/50 space-y-4">
                <h2 className="font-serif text-2xl font-medium flex items-center gap-2">
                  <Link2 className="w-5 h-5" />{t("manage.admins.invitesTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("manage.admins.invitesDesc")}</p>

                {/* Create invite form */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">{t("manage.admins.inviteLabelLabel")}</label>
                    <Input
                      value={inviteLabel}
                      onChange={(e) => setInviteLabel(e.target.value)}
                      placeholder={t("manage.admins.inviteLabelPlaceholder")}
                      className="bg-background"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">{t("manage.admins.inviteMaxUsesLabel")}</label>
                      <Input
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(e.target.value.replace(/\D/g, ""))}
                        placeholder="∞"
                        className="bg-background"
                        type="number"
                        min={1}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">{t("manage.admins.inviteExpiryLabel")}</label>
                      <Input
                        value={inviteExpiryDays}
                        onChange={(e) => setInviteExpiryDays(e.target.value.replace(/\D/g, ""))}
                        placeholder="∞"
                        className="bg-background"
                        type="number"
                        min={1}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateInvite}
                    disabled={createInviteMutation.isPending}
                    className="w-full"
                  >
                    <Link2 className="w-4 h-4 mr-2" />{t("manage.admins.inviteCreateBtn")}
                  </Button>
                </div>
              </div>

              {/* Invite list */}
              {inviteList && inviteList.length > 0 && (
                <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden">
                  <ul className="divide-y divide-border/50">
                    {inviteList.map((inv) => {
                      const isExpired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
                      const isExhausted = inv.maxUses != null && inv.useCount >= inv.maxUses;
                      const inactive = inv.revoked || isExpired || isExhausted;
                      return (
                        <li key={inv.id} className="flex items-start gap-4 px-6 py-4">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className={`font-medium ${inactive ? "text-muted-foreground line-through" : ""}`}>
                              {inv.label}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{inv.token}</p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                              <span>
                                {t("manage.admins.inviteUsed", { count: inv.useCount })}
                                {inv.maxUses !== null ? ` / ${inv.maxUses}` : ` / ${t("manage.admins.inviteUnlimited")}`}
                              </span>
                              {inv.expiresAt && !isExpired && (
                                <span>{t("manage.admins.inviteExpires", { date: new Date(inv.expiresAt).toLocaleDateString() })}</span>
                              )}
                              {isExpired && <span className="text-destructive">{t("manage.admins.inviteExpired")}</span>}
                              {inv.revoked && <span className="text-destructive">{t("manage.admins.inviteRevokedBadge")}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                            {!inactive && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => copyInviteLink(inv.id, inv.token)}
                              >
                                {copiedId === inv.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedId === inv.id ? t("manage.admins.inviteCopiedBtn") : t("manage.admins.inviteCopyBtn")}
                              </Button>
                            )}
                            {!inv.revoked && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRevokeInvite(inv.id)}
                                disabled={revokeInviteMutation.isPending}
                              >
                                <X className="w-3.5 h-3.5" />{t("manage.admins.inviteRevokeBtn")}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {inviteList?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">{t("manage.admins.inviteNoTokens")}</p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
