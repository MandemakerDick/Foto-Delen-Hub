import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useCreateClub, 
  useCreateTheme, 
  useCreatePhotographer,
  useListClubs,
  getListClubsQueryKey,
  getListThemesQueryKey,
  getListPhotographersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Users, LayoutDashboard, User } from "lucide-react";

// Schemas
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
  avatarUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  clubId: z.coerce.number().optional(),
});

export default function Manage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clubs } = useListClubs();

  const createClubMutation = useCreateClub();
  const createThemeMutation = useCreateTheme();
  const createPhotographerMutation = useCreatePhotographer();

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
    defaultValues: { name: "", bio: "", avatarUrl: "" },
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
        onError: () => toast({ title: "Error", description: "Failed to create club", variant: "destructive" })
      }
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
        onError: () => toast({ title: "Error", description: "Failed to create theme", variant: "destructive" })
      }
    );
  };

  const onPhotographerSubmit = (values: z.infer<typeof photographerSchema>) => {
    const data = { ...values };
    if (!data.avatarUrl) delete data.avatarUrl;
    
    createPhotographerMutation.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Profile Created", description: `${values.name} has joined.` });
          photographerForm.reset();
          queryClient.invalidateQueries({ queryKey: getListPhotographersQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to create profile", variant: "destructive" })
      }
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

        <TabsContent value="photographer" className="bg-secondary/20 p-6 rounded-lg border border-border/50">
          <h2 className="font-serif text-2xl font-medium mb-6">Add Photographer</h2>
          <Form {...photographerForm}>
            <form onSubmit={photographerForm.handleSubmit(onPhotographerSubmit)} className="space-y-4">
              <FormField control={photographerForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={photographerForm.control} name="avatarUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL</FormLabel>
                  <FormControl><Input {...field} className="bg-background" placeholder="https://..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
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
