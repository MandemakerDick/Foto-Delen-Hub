import { useState } from "react";
import { Link } from "wouter";
import { User, Search, Users, Image as ImageIcon } from "lucide-react";
import { useListPhotographers, useListClubs } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Photographers() {
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState("all");
  
  const { data: clubs } = useListClubs();
  const { data: photographers, isLoading } = useListPhotographers(
    clubFilter !== "all" ? { clubId: Number(clubFilter) } : undefined
  );

  const filteredPhotographers = photographers?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.bio && p.bio.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-4">Photographers</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            The eyes behind the lens. Discover artists and their portfolios.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search names..." 
              className="pl-9 bg-background border-border/50"
            />
          </div>
          
          <Select value={clubFilter} onValueChange={setClubFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background border-border/50">
              <SelectValue placeholder="All Clubs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clubs</SelectItem>
              {clubs?.map((club) => (
                <SelectItem key={club.id} value={club.id.toString()}>{club.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-secondary/50 rounded-lg p-6 border border-border/50 h-56"></div>
          ))}
        </div>
      ) : filteredPhotographers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredPhotographers.map((photographer) => (
            <Link key={photographer.id} href={`/photographers/${photographer.id}`}>
              <div className="group h-full bg-background rounded-lg p-6 border border-border/50 hover:border-primary/50 hover:bg-secondary/20 transition-all flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-secondary mb-4 overflow-hidden border-2 border-border/50 group-hover:border-primary/50 transition-colors flex items-center justify-center shrink-0">
                  {photographer.avatarUrl ? (
                    <img src={photographer.avatarUrl} alt={photographer.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                
                <h3 className="font-serif text-xl font-bold mb-1 group-hover:text-primary transition-colors">{photographer.name}</h3>
                
                {photographer.clubName && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest mb-4">
                    <Users className="w-3 h-3 shrink-0" />
                    <span className="truncate">{photographer.clubName}</span>
                  </div>
                )}
                
                <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-1">
                  {photographer.bio}
                </p>

                <div className="flex items-center gap-1.5 text-sm font-mono text-foreground mt-auto bg-secondary/50 px-3 py-1 rounded-full">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <span>{photographer.photoCount || 0} prints</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-secondary/50 rounded-lg border border-border/50 border-dashed">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-serif text-xl font-medium mb-2">No photographers found</h3>
          <p className="text-muted-foreground mb-6">There are no photographers matching your search.</p>
        </div>
      )}
    </div>
  );
}
