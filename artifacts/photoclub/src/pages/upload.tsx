import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Image as ImageIcon, LogIn, Link2 } from "lucide-react";
import { Show } from "@clerk/react";
import {
  useCreatePhoto,
  useListClubs,
  useListThemes,
} from "@workspace/api-client-react";
import { useMyProfile } from "@/hooks/use-my-profile";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
  imageUrl: z.string().url("Must be a valid URL"),
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", imageUrl: "" },
  });

  const previewUrl = form.watch("imageUrl");

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      { data: values as Parameters<typeof createMutation.mutate>[0]["data"] },
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
        <p className="text-muted-foreground text-lg">
          Add your work to the collective darkroom.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Uploading as <span className="text-foreground font-medium">{profile.name}</span>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
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

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://..."
                        {...field}
                        className="bg-background font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>Link to a high-resolution image</FormDescription>
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

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Developing..." : "Hang Print"}
              </Button>
            </form>
          </Form>
        </div>

        <div className="w-full lg:w-1/2 order-1 lg:order-2">
          <div className="sticky top-24">
            <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-2">Preview</div>
            <div className="aspect-[4/5] bg-secondary/50 rounded-sm border border-border/50 flex flex-col items-center justify-center p-4 overflow-hidden relative">
              {previewUrl && previewUrl.startsWith("http") ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                  }}
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="font-mono text-sm">Image preview will appear here</p>
                </div>
              )}
            </div>
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
