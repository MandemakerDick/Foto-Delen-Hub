import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { LogIn, Link2, UploadCloud, X, CheckCircle2 } from "lucide-react";
import { Show } from "@clerk/react";
import {
  useCreatePhoto,
  useListClubs,
  useListThemes,
} from "@workspace/api-client-react";
import { ObjectUploader } from "@workspace/object-storage-web";
import { useMyProfile } from "@/hooks/use-my-profile";
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
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().optional(),
  clubId: z.coerce.number().optional(),
  themeId: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function UploadForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { profile, loading } = useMyProfile();

  const { data: clubs } = useListClubs();
  const { data: themes } = useListThemes();
  const createMutation = useCreatePhoto();

  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedObjectPath, setUploadedObjectPath] = useState<string | null>(null);

  // Hold the objectPath returned from the presign request so it's available in onComplete
  const pendingObjectPathRef = useRef<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "" },
  });

  const onSubmit = (values: FormValues) => {
    if (!uploadedImageUrl) {
      toast({ title: "No image", description: "Please upload a photo first.", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          ...values,
          imageUrl: uploadedImageUrl,
        } as Parameters<typeof createMutation.mutate>[0]["data"],
      },
      {
        onSuccess: (photo) => {
          toast({ title: "Print Added", description: "Your photograph is now in the gallery." });
          setLocation(`/photos/${photo.id}`);
        },
        onError: async (err: unknown) => {
          const msg =
            err instanceof Response
              ? (await err.json().catch(() => ({}))).error
              : (err as { message?: string })?.message;
          toast({
            title: "Upload failed",
            description: msg || "Failed to add photograph. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const clearImage = () => {
    setUploadedImageUrl(null);
    setUploadedObjectPath(null);
    pendingObjectPathRef.current = null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <div className="w-14 h-14 rounded-full bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
          <Link2 className="w-6 h-6 text-primary" />
        </div>
        <h2 className="font-serif text-2xl mb-3">Link your photographer profile first</h2>
        <p className="text-muted-foreground text-sm mb-8">
          You need a photographer profile linked to your account before you can upload photos.
        </p>
        <Link href="/my-photos">
          <Button>Go to My Photos to link a profile</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-bold mb-4">Hang a Print</h1>
        <p className="text-muted-foreground text-lg">Add your work to the collective darkroom.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Uploading as <span className="text-foreground font-medium">{profile.name}</span>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Form */}
        <div className="w-full lg:w-1/2 order-2 lg:order-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Untitled" {...field} className="bg-background" />
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
                      <FormLabel>Community</FormLabel>
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
                  )}
                />
                <FormField
                  control={form.control}
                  name="themeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {themes?.map((t) => (
                            <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artist Statement</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Context about the shot..."
                        className="resize-none h-32 bg-background font-serif"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending || !uploadedImageUrl}
              >
                {createMutation.isPending ? "Developing..." : "Hang Print"}
              </Button>
            </form>
          </Form>
        </div>

        {/* Image uploader / preview */}
        <div className="w-full lg:w-1/2 order-1 lg:order-2">
          <div className="sticky top-24">
            <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-2">
              {uploadedImageUrl ? "Preview" : "Upload Photo"}
            </div>

            {uploadedImageUrl ? (
              <div className="relative group">
                <div className="aspect-[4/5] bg-secondary/50 rounded-sm border border-border/50 overflow-hidden">
                  <img
                    src={uploadedImageUrl}
                    alt="Uploaded"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm flex items-center justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearImage}
                    className="gap-2 bg-background/90"
                  >
                    <X className="w-4 h-4" />
                    Change photo
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-500">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-mono truncate">{uploadedObjectPath}</span>
                </div>
              </div>
            ) : (
              <div className="aspect-[4/5] bg-secondary/50 rounded-sm border-2 border-dashed border-border flex flex-col items-center justify-center p-6">
                <UploadCloud className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm text-center mb-6">
                  Select a file from your device or drag and drop
                </p>
                <ObjectUploader
                  onGetUploadParameters={async (file) => {
                    const res = await fetch("/api/storage/uploads/request-url", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: file.name,
                        size: file.size,
                        contentType: file.type,
                      }),
                    });
                    if (!res.ok) throw new Error("Failed to get upload URL");
                    const data = await res.json() as { uploadURL: string; objectPath: string };
                    pendingObjectPathRef.current = data.objectPath;
                    return {
                      method: "PUT" as const,
                      url: data.uploadURL,
                      headers: { "Content-Type": file.type ?? "application/octet-stream" },
                    };
                  }}
                  onComplete={(result) => {
                    if ((result.failed?.length ?? 0) > 0) {
                      const errMsg = result.failed?.[0]?.error;
                      toast({
                        title: "Upload error",
                        description: typeof errMsg === "string" ? errMsg : "Upload failed",
                        variant: "destructive",
                      });
                      return;
                    }
                    const objectPath = pendingObjectPathRef.current;
                    if (!objectPath) return;
                    const servingUrl = `/api/storage${objectPath}`;
                    setUploadedObjectPath(objectPath);
                    setUploadedImageUrl(servingUrl);
                  }}
                  buttonClassName="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  Choose Photo
                </ObjectUploader>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Upload() {
  return (
    <>
      <Show when="signed-in">
        <UploadForm />
      </Show>
      <Show when="signed-out">
        <div className="container mx-auto px-4 py-24 text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
            <LogIn className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-serif text-3xl mb-3">Sign in to upload</h2>
          <p className="text-muted-foreground mb-8">
            Only registered photographers can add prints to the darkroom.
          </p>
          <Link href="/sign-in">
            <Button size="lg">Sign in</Button>
          </Link>
        </div>
      </Show>
    </>
  );
}
