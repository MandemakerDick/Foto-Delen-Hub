import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { LogIn, Link2, X } from "lucide-react";
import { Show, SignInButton } from "@clerk/react";
import {
  useCreatePhoto,
  useListClubs,
  useListThemes,
  useListPhotographers,
  getListPhotographersQueryKey,
  useGetAdminStatus,
  getGetAdminStatusQueryKey,
  useProposeTheme,
  getListPhotosQueryKey,
  getListGalleryPhotosQueryKey,
  getListRecentPhotosQueryKey,
} from "@workspace/api-client-react";
import { PhotoDraftPicker } from "@/components/photo-draft-picker";
import { ClubProposal } from "@/components/club-proposal";
import { storePhoto, UploadTimeoutError } from "@/lib/photo-upload";
import { useMyProfile } from "@/hooks/use-my-profile";
import { ProfileLoadNotice } from "@/components/profile-load-notice";
import { useAuth } from "@clerk/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().optional(),
  clubId: z.coerce.number().optional(),
  themeId: z.coerce.number().optional(),
  photographerId: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function UploadForm({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, loading, error, refetch } = useMyProfile();

  const allClubs = useListClubs();
  // A photographer sees only their memberships; No club is always available.
  const clubs = isAdmin ? allClubs.data : profile?.clubs;
  const themes = useListThemes();
  const { data: photographers } = useListPhotographers(
    {},
    { query: { enabled: isAdmin, queryKey: getListPhotographersQueryKey() } },
  );
  const createMutation = useCreatePhoto();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<"idle" | "transferring" | "saving">("idle");
  const uploadController = useRef<AbortController | null>(null);
  const savingUpload = useRef(false);
  useEffect(() => () => { if (!savingUpload.current) uploadController.current?.abort(); }, []);

  const [showPropose, setShowPropose] = useState(false);
  const [proposedName, setProposedName] = useState("");
  const proposeThemeMutation = useProposeTheme();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "" },
  });

  const selectedPhotographerId = form.watch("photographerId");
  const selectedPhotographer = photographers?.find((p) => p.id === selectedPhotographerId);

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

  const onSubmit = async (values: FormValues) => {
    if (uploadController.current || savingUpload.current) return;
    if (!selectedFile) {
      toast({ title: t("toasts.noImageTitle"), description: t("toasts.noImageDesc"), variant: "destructive" });
      return;
    }
    if (isAdmin && !values.photographerId) {
      toast({ title: "Select a photographer", description: "Choose which photographer this photo belongs to.", variant: "destructive" });
      return;
    }
    if (!isAdmin && values.clubId !== undefined && !profile?.clubs.some(club => club.id === values.clubId)) {
      toast({ title: t("upload.failed"), description: t("upload.clubMembershipRequired"), variant: "destructive" });
      return;
    }
    const controller = new AbortController();
    uploadController.current = controller;
    setUploadStage("transferring");
    try {
      const imageUrl = await storePhoto(selectedFile, controller);
      if (controller.signal.aborted) return;
      savingUpload.current = true;
      setUploadStage("saving");
      const photo = await createMutation.mutateAsync({
        data: {
          ...values,
          title: values.title.trim(),
          description: values.description?.trim() || undefined,
          imageUrl,
          ...(!isAdmin && profile ? { photographerId: profile.id } : {}),
        } as Parameters<typeof createMutation.mutate>[0]["data"],
      });
      setSelectedFile(null);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getListGalleryPhotosQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getListRecentPhotosQueryKey() });
      toast({ title: t("upload.successTitle"), description: t("upload.successBody") });
      setLocation(isAdmin ? `/photos/${photo.id}` : "/my-photos");
    } catch (error) {
      if (!controller.signal.aborted || error instanceof UploadTimeoutError) {
        toast({
          title: t("upload.failed"),
          description: error instanceof UploadTimeoutError
            ? t("upload.timedOut")
            : error instanceof Error ? error.message : t("upload.tryAgain"),
          variant: "destructive",
        });
      }
    } finally {
      if (uploadController.current === controller) {
        uploadController.current = null;
        savingUpload.current = false;
        setUploadStage("idle");
      }
    }
  };

  const cancelUpload = () => {
    if (savingUpload.current) return;
    uploadController.current?.abort();
    uploadController.current = null;
    setUploadStage("idle");
    setSelectedFile(null);
    form.reset();
    setLocation(isAdmin ? "/manage" : "/my-photos");
  };

  // Clerk user: wait for profile to load
  if (!isAdmin && loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAdmin && error && profile === undefined) {
    return <ProfileLoadNotice error={error} retry={refetch} />;
  }

  // Clerk user: must link a photographer profile first
  if (!isAdmin && !profile) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <ProfileLoadNotice error={error} retry={refetch} background />
        <div className="w-14 h-14 rounded-full bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
          <Link2 className="w-6 h-6 text-primary" />
        </div>
        <h2 className="font-serif text-2xl mb-3">{t("upload.linkFirstTitle")}</h2>
        <p className="text-muted-foreground text-sm mb-8">
          {t("upload.linkFirstBody")}
        </p>
        <Link href="/my-photos">
          <Button>{t("upload.goToMyPhotos")}</Button>
        </Link>
      </div>
    );
  }

  const uploadingAsName = isAdmin
    ? (selectedPhotographer?.name ?? null)
    : profile?.name ?? null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      {!isAdmin && <ProfileLoadNotice error={error} retry={refetch} background />}
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-bold mb-4">{t("upload.title")}</h1>
        <p className="text-muted-foreground text-lg">{t("upload.subtitle")}</p>
        {uploadingAsName && (
          <p className="text-sm text-muted-foreground mt-2">
            {t("upload.uploadingAs")} <span className="text-foreground font-medium">{uploadingAsName}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Form */}
        <div className="w-full lg:w-1/2 order-2 lg:order-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <fieldset disabled={uploadStage !== "idle"} className="space-y-6">
              {/* Photographer picker — admins only */}
              {isAdmin && (
                <FormField
                  control={form.control}
                  name="photographerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Photographer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select photographer…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {photographers?.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("upload.labelTitle")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("upload.titlePlaceholder")} {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="clubId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("upload.labelCommunity")}</FormLabel>
                      <Select value={field.value?.toString() ?? "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder={t("upload.selectOptional")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t("myPhotos.noClub")}</SelectItem>
                          {clubs?.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {!isAdmin && <ClubProposal disabled={uploadStage !== "idle"} />}
                      {!isAdmin && !clubs?.length && <p className="text-sm text-muted-foreground">{t("upload.noMemberClubs")}</p>}
                      {isAdmin && allClubs.isLoading && <p className="text-sm text-muted-foreground">{t("upload.loadingOptions")}</p>}
                      {isAdmin && allClubs.isError && <Button type="button" variant="link" className="px-0" onClick={() => void allClubs.refetch()}>{t("upload.retryOptions")}</Button>}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="themeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("upload.labelTheme")}</FormLabel>
                      <Select value={field.value?.toString() ?? "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder={t("upload.selectOptional")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t("upload.noTheme")}</SelectItem>
                          {themes.data?.map((theme) => (
                            <SelectItem key={theme.id} value={theme.id.toString()}>{theme.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {themes.isLoading && <p className="text-sm text-muted-foreground">{t("upload.loadingOptions")}</p>}
                      {themes.isError && <Button type="button" variant="link" className="px-0" onClick={() => void themes.refetch()}>{t("upload.retryOptions")}</Button>}
                      {themes.isSuccess && !themes.data?.length && <p className="text-sm text-muted-foreground">{t("upload.noThemes")}</p>}
                      {!isAdmin && (
                        <div className="pt-2">
                          {!showPropose ? (
                            <button
                              type="button"
                              onClick={() => setShowPropose(true)}
                              className="w-full text-sm font-medium text-primary border border-primary/40 rounded-md py-1.5 px-3 hover:bg-primary/10 transition-colors text-left"
                            >
                              + {t("upload.proposeTheme")}
                            </button>
                          ) : (
                            <div className="space-y-2 p-3 border border-primary/40 rounded-md bg-primary/5">
                              <Input
                                value={proposedName}
                                onChange={(e) => setProposedName(e.target.value)}
                                placeholder={t("upload.proposeThemePlaceholder")}
                                className="bg-background h-10"
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleProposeTheme(); } if (e.key === "Escape") { setShowPropose(false); setProposedName(""); } }}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  className="flex-1 h-9"
                                  disabled={!proposedName.trim() || proposeThemeMutation.isPending}
                                  onClick={handleProposeTheme}
                                >
                                  {proposeThemeMutation.isPending ? t("upload.proposeThemeSubmitting") : t("upload.proposeThemeBtn")}
                                </Button>
                                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => { setShowPropose(false); setProposedName(""); }}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("upload.labelStatement")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("upload.statementPlaceholder")}
                        className="resize-none h-32 bg-background font-serif"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </fieldset>

              <Button
                type="submit"
                className="w-full"
                disabled={uploadStage !== "idle" || !selectedFile}
              >
                {uploadStage === "transferring" ? t("upload.transferring")
                  : uploadStage === "saving" ? t("upload.finishing") : t("upload.submit")}
              </Button>
              <Button type="button" variant="outline" className="w-full"
                disabled={uploadStage === "saving"} onClick={cancelUpload}>
                {uploadStage === "saving" ? t("upload.finishing") : t("upload.cancel")}
              </Button>
            </form>
          </Form>
        </div>

        {/* Selection is only a draft; bytes transfer after Upload is pressed. */}
        <div className="w-full lg:w-1/2 order-1 lg:order-2">
          <PhotoDraftPicker file={selectedFile} onChange={setSelectedFile} disabled={uploadStage !== "idle"} />
        </div>
      </div>
    </div>
  );
}

function SignedOutUpload() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-24 text-center max-w-md">
      <div className="w-14 h-14 rounded-full bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
        <LogIn className="w-6 h-6 text-primary" />
      </div>
      <h2 className="font-serif text-3xl mb-3">{t("upload.signInTitle")}</h2>
      <p className="text-muted-foreground mb-8">{t("upload.signInBody")}</p>
      <SignInButton mode="modal">
        <Button size="lg">{t("upload.signInButton")}</Button>
      </SignInButton>
    </div>
  );
}

export default function Upload() {
  const { isSignedIn } = useAuth();
  const { data: adminStatus } = useGetAdminStatus({
    query: { retry: false, queryKey: getGetAdminStatusQueryKey() },
  });

  const isSessionAdmin = !!adminStatus?.isAdmin && !isSignedIn;

  // Session admin — show upload form with photographer picker
  if (isSessionAdmin) {
    return <UploadForm isAdmin={true} />;
  }

  return (
    <>
      <Show when="signed-in">
        <UploadForm isAdmin={false} />
      </Show>
      <Show when="signed-out">
        <SignedOutUpload />
      </Show>
    </>
  );
}
