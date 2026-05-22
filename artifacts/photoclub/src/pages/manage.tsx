import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateClub,
  useCreateTheme,
  useCreatePhotographer,
  useListClubs,
  useListThemes,
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
import { useToast } from "@/hooks/use-toast";
import { Users, LayoutDashboard, User, Camera } from "lucide-react";

const clubSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  location: z.string().optional(),
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

export default function Manage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clubs } = useListClubs();
  const { data: themes } = useListThemes();

  const createClubMutation = useCreateClub();
  const createThemeMutation = useCreateTheme();
  const createPhotographerMutation = useCreatePhotographer();

  // Avatar upload state (managed outside react-hook-form)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const pendingObjectPathRef = useRef<string | null>(null);

  // Theme pickers state
  const [theme1, setTheme1] = useState("none");
  const [theme2, setTheme2] = useState("none");
  const theme2Options = themes?.filter((t) => t.id.toString() !== theme1) ?? [];

  const clubForm = useForm<z.infer<typeof clubSchema>>({
    resolver: zodResolver(clubSchema),
    defaultValues: { name: "", description: "", location: "" },
  });

  const themeForm = useForm<z.infer<typeof themeSchema>>({
    resolver: zodResolver(themeSchema),
    defaultValues: { name: "", description: "" },
  });

  const photographerForm = useForm<z.infer<typeof photographerSchema>>({
    resolver: zodResolver(photographerSchema),
    defaultValues: { name: "", bio: "" },
  });

  const onClubSubmit = (values: z.infer<typeof clubSchema>) => {
    createClubMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Community Established", description: `${values.name} has been created.` });
          clubForm.reset();
          queryClient.invalidateQueries({ queryKey: getListClubsQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to create club", variant: "destructive" }),
      },
    );
  };

  const onThemeSubmit = (values: z.infer<typeof themeSchema>) => {
    createThemeMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Theme Created", description: `${values.name} is now available.` });
          themeForm.reset();
          queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to create theme", variant: "destructive" }),
      },
    );
  };

  const onPhotographerSubmit = (values: z.infer<typeof photographerSchema>) => {
    const data = {
      ...values,
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(theme1 !== "none" ? { themeId1: Number(theme1) } : {}),
      ...(theme2 !== "none" ? { themeId2: Number(theme2) } : {}),
    };

    createPhotographerMutation.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Profile Created", description: `${values.name} has joined.` });
          photographerForm.reset();
          setAvatarUrl(null);
          setTheme1("none");
          setTheme2("none");
          queryClient.invalidateQueries({ queryKey: getListPhotographersQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to create profile", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-bold mb-4">Administration</h1>
        <p className="text-muted-foreground text-lg">
          Manage the gallery's foundational data.
        </p>
      </div>

      <Tabs defaultValue="club" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-secondary border border-border/50">
          <TabsTrigger value="club" className="data-[state=active]:bg-background">
            <Users className="w-4 h-4 mr-2" />
            Club
          </TabsTrigger>
          <TabsTrigger value="theme" className="data-[state=active]:bg-background">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Theme
          </TabsTrigger>
          <TabsTrigger value="photographer" className="data-[state=active]:bg-background">
            <User className="w-4 h-4 mr-2" />
            Photographer
          </TabsTrigger>
        </TabsList>

        {/* Club tab */}
        <TabsContent value="club" className="bg-secondary/20 p-6 rounded-lg border border-border/50">
          <h2 className="font-serif text-2xl font-medium mb-6">Create Community</h2>
          <Form {...clubForm}>
            <form onSubmit={clubForm.handleSubmit(onClubSubmit)} className="space-y-4">
              <FormField control={clubForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Club Name *</FormLabel>
                  <FormControl><Input {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={clubForm.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl><Input {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={clubForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea {...field} className="bg-background resize-none h-24 font-serif" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={createClubMutation.isPending} className="w-full mt-2">
                Establish Community
              </Button>
            </form>
          </Form>
        </TabsContent>

        {/* Theme tab */}
        <TabsContent value="theme" className="bg-secondary/20 p-6 rounded-lg border border-border/50">
          <h2 className="font-serif text-2xl font-medium mb-6">Create Theme</h2>
          <Form {...themeForm}>
            <form onSubmit={themeForm.handleSubmit(onThemeSubmit)} className="space-y-4">
              <FormField control={themeForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme Name *</FormLabel>
                  <FormControl><Input {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={themeForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea {...field} className="bg-background resize-none h-24 font-serif" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={createThemeMutation.isPending} className="w-full mt-2">
                Define Theme
              </Button>
            </form>
          </Form>
        </TabsContent>

        {/* Photographer tab */}
        <TabsContent value="photographer" className="bg-secondary/20 p-6 rounded-lg border border-border/50">
          <h2 className="font-serif text-2xl font-medium mb-6">Add Photographer</h2>
          <Form {...photographerForm}>
            <form onSubmit={photographerForm.handleSubmit(onPhotographerSubmit)} className="space-y-5">

              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-3">
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={5 * 1024 * 1024}
                  onGetUploadParameters={async (file) => {
                    const res = await fetch("/api/storage/uploads/request-url", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                    });
                    if (!res.ok) throw new Error("Failed to get upload URL");
                    const data = await res.json() as { uploadURL: string; objectPath: string };
                    pendingObjectPathRef.current = data.objectPath;
                    setAvatarUploading(true);
                    return { method: "PUT" as const, url: data.uploadURL, headers: { "Content-Type": file.type ?? "image/jpeg" } };
                  }}
                  onComplete={(result) => {
                    setAvatarUploading(false);
                    if ((result.failed?.length ?? 0) > 0) {
                      toast({ title: "Upload failed", description: "Could not upload avatar.", variant: "destructive" });
                      return;
                    }
                    const objectPath = pendingObjectPathRef.current;
                    if (objectPath) setAvatarUrl(`/api/storage${objectPath}`);
                  }}
                  buttonClassName="group relative w-24 h-24 rounded-full bg-secondary border-2 border-dashed border-border hover:border-primary/60 overflow-hidden flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                >
                  {avatarUploading ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : avatarUrl ? (
                    <>
                      <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
                      <Camera className="w-6 h-6" />
                      <span className="text-[10px] uppercase tracking-wider">Photo</span>
                    </div>
                  )}
                </ObjectUploader>
                <p className="text-xs text-muted-foreground">Click to upload a profile picture (optional)</p>
              </div>

              {/* Name */}
              <FormField control={photographerForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Primary Club */}
              <FormField control={photographerForm.control} name="clubId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Club</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clubs?.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Specialty themes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm font-medium mb-1.5">Specialty Theme 1</p>
                  <Select
                    value={theme1}
                    onValueChange={(v) => { setTheme1(v); if (v === theme2) setTheme2("none"); }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {themes?.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1.5">Specialty Theme 2</p>
                  <Select
                    value={theme2}
                    onValueChange={setTheme2}
                    disabled={theme1 === "none"}
                  >
                    <SelectTrigger className="bg-background disabled:opacity-50">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {theme2Options.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bio */}
              <FormField control={photographerForm.control} name="bio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Biography</FormLabel>
                  <FormControl><Textarea {...field} className="bg-background resize-none h-24 font-serif" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" disabled={createPhotographerMutation.isPending} className="w-full mt-2">
                Register Profile
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
