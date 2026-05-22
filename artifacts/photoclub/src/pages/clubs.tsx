import { useState } from "react";
import { Link } from "wouter";
import { Users, Search, MapPin, Image as ImageIcon } from "lucide-react";
import { useListClubs } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Clubs() {
  const [search, setSearch] = useState("");
  const { data: clubs, isLoading } = useListClubs();

  const filteredClubs = clubs?.filter(club => 
    club.name.toLowerCase().includes(search.toLowerCase()) || 
    (club.location && club.location.toLowerCase().includes(search.toLowerCase())) ||
    (club.description && club.description.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-4">Communities</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            The heart of PhotoClub. Local groups and collectives sharing their vision.
          </p>
        </div>
        
        <div className="w-full md:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a club..." 
            className="pl-9 bg-background border-border/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-secondary/50 rounded-lg p-6 border border-border/50 h-48"></div>
          ))}
        </div>
      ) : filteredClubs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClubs.map((club) => (
            <Link key={club.id} href={`/clubs/${club.id}`}>
              <div className="group h-full bg-background rounded-lg p-6 border border-border/50 hover:border-primary/50 hover:bg-secondary/20 transition-all flex flex-col">
                <div className="flex items-start justify-between mb-4 gap-4">
                  {club.logoUrl ? (
                    <img
                      src={club.logoUrl}
                      alt={`${club.name} logo`}
                      className="h-12 w-auto max-w-[60%] object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Users className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                    <div className="flex items-center gap-1" title="Members">
                      <Users className="w-3 h-3" />
                      {club.memberCount || 0}
                    </div>
                    <div className="flex items-center gap-1" title="Photographs">
                      <ImageIcon className="w-3 h-3" />
                      {club.photoCount || 0}
                    </div>
                  </div>
                </div>
                
                <h3 className="font-serif text-2xl font-bold mb-2 group-hover:text-primary transition-colors">{club.name}</h3>
                
                {club.location && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{club.location}</span>
                  </div>
                )}
                
                <p className="text-muted-foreground line-clamp-3 text-sm flex-1 mt-auto">
                  {club.description || "No description provided."}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-secondary/50 rounded-lg border border-border/50 border-dashed">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-serif text-xl font-medium mb-2">No communities found</h3>
          <p className="text-muted-foreground mb-6">Start a new club to gather local photographers.</p>
          <Link href="/manage">
            <Button>Create a Club</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
