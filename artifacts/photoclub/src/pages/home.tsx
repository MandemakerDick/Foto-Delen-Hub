import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Image, TrendingUp, Users, Heart } from "lucide-react";
import { useListRecentPhotos, useGetStats } from "@workspace/api-client-react";
import { PhotoCard } from "@/components/photo-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { data: photos, isLoading: photosLoading } = useListRecentPhotos({ limit: 12 });
  const { data: stats, isLoading: statsLoading } = useGetStats();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      setLocation(`/photos?search=${encodeURIComponent(search)}`);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 md:py-32 bg-secondary border-b border-border/50">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/50 via-background to-background"></div>
        <div className="container relative z-10 mx-auto px-4 max-w-4xl text-center flex flex-col items-center gap-8">
          <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight">
            Curated. Deliberate. <span className="text-primary italic">Proud.</span>
          </h1>
          <p className="text-xl text-muted-foreground font-sans max-w-2xl">
            A digital darkroom for serious photographers. Share your craft within tight-knit communities.
          </p>
          
          <form onSubmit={handleSearch} className="w-full max-w-md relative mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search photographs by title or description..." 
              className="w-full pl-12 h-14 bg-background border-border/50 text-base focus-visible:ring-primary rounded-full shadow-lg"
            />
            <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-6">
              Find
            </Button>
          </form>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-b border-border/50 bg-background/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard icon={<Image className="w-5 h-5" />} label="Photographs" value={stats?.totalPhotos} loading={statsLoading} />
            <StatCard icon={<Users className="w-5 h-5" />} label="Clubs" value={stats?.totalClubs} loading={statsLoading} />
            <StatCard icon={<User className="w-5 h-5" />} label="Photographers" value={stats?.totalPhotographers} loading={statsLoading} />
            <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Themes" value={stats?.totalThemes} loading={statsLoading} />
          </div>
        </div>
      </section>

      {/* Recent Gallery */}
      <section className="py-20 container mx-auto px-4">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="font-serif text-3xl font-bold mb-2">Recent Additions</h2>
            <p className="text-muted-foreground">The latest prints from the darkroom.</p>
          </div>
          <Link href="/photos">
            <Button variant="outline" className="hidden sm:flex border-border/50 hover:bg-secondary">
              View Entire Gallery
            </Button>
          </Link>
        </div>

        {photosLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col gap-3">
                <div className="aspect-[4/5] bg-muted rounded-sm"></div>
                <div className="h-5 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : photos && photos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {photos.map((photo, i) => (
              <PhotoCard key={photo.id} photo={photo} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-secondary/50 rounded-lg border border-border/50 border-dashed">
            <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-serif text-xl font-medium mb-2">The gallery is empty</h3>
            <p className="text-muted-foreground mb-6">Be the first to hang a print.</p>
            <Link href="/upload">
              <Button>Upload Photograph</Button>
            </Link>
          </div>
        )}

        <div className="mt-12 text-center sm:hidden">
          <Link href="/photos">
            <Button variant="outline" className="w-full border-border/50">
              View Entire Gallery
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode, label: string, value?: number, loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center border border-border/50 rounded-lg bg-background hover:border-primary/50 transition-colors group">
      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-4 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1"></div>
      ) : (
        <div className="text-3xl font-mono font-medium tracking-tight mb-1">{value || 0}</div>
      )}
      <div className="text-xs text-muted-foreground uppercase tracking-widest">{label}</div>
    </div>
  );
}

function User(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}