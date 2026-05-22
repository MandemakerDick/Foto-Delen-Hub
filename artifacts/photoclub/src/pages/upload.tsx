import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, Image as ImageIcon } from "lucide-react";
import { 
  useCreatePhoto, 
  useListClubs, 
  useListThemes, 
  useListPhotographers 
} from "@workspace/api-client-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().optional(),
  imageUrl: z.string().url("Must be a valid URL"),
  photographerId: z.coerce.number({ invalid_type_error: "Required" }).positive("Required"),
  clubId: z.coerce.number().optional(),
  themeId: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Upload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: clubs } = useListClubs();
  const { data: themes } = useListThemes();
  const { data: photographers } = useListPhotographers();
  
  const createMutation = useCreatePhoto();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      imageUrl: "",
    },
  });

  const previewUrl = form.watch("imageUrl");

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(
      { data: values },
      {
        onSuccess: (photo) => {
          toast({
            title: "Print Added",
            description: "Your photograph is now in the gallery.",
          });
          setLocation(`/photos/${photo.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to add photograph. Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-bold mb-4">Hang a Print</h1>
        <p className="text-muted-foreground text-lg">
          Add your work to the collective darkroom.
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
                      <Input placeholder="https://..." {...field} className="bg-background font-mono text-sm" />
                    </FormControl>
                    <FormDescription>Link to a high-resolution image</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="photographerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Photographer *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select artist" />
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
              </div>

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

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artist Statement / Description</FormLabel>
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
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Developing..." : "Hang Print"}
              </Button>
            </form>
          </Form>
        </div>

        <div className="w-full lg:w-1/2 order-1 lg:order-2">
          <div className="sticky top-24">
            <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-2">Preview</div>
            <div className="aspect-[4/5] bg-secondary/50 rounded-sm border border-border/50 flex flex-col items-center justify-center p-4 overflow-hidden relative">
              {previewUrl && previewUrl.startsWith('http') ? (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).alt = "Invalid URL";
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
