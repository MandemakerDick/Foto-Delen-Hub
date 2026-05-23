import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Search, Image as ImageIcon } from "lucide-react";
import { useListThemes } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Themes() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data: themes, isLoading } = useListThemes();

  const filteredThemes = themes?.filter(theme => 
    theme.name.toLowerCase().includes(search.toLowerCase()) || 
    (theme.description && theme.description.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-4">{t("themes.title")}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            {t("themes.subtitle")}
          </p>
        </div>
        
        <div className="w-full md:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("themes.findPlaceholder")}
            className="pl-9 bg-background border-border/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-secondary/50 rounded-lg p-6 border border-border/50 h-40"></div>
          ))}
        </div>
      ) : filteredThemes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredThemes.map((theme) => (
            <Link key={theme.id} href={`/themes/${theme.id}`}>
              <div className="group h-full bg-background rounded-lg p-6 border border-border/50 hover:border-primary/50 hover:bg-secondary/20 transition-all flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                
                <h3 className="font-serif text-2xl font-bold mb-2 group-hover:text-primary transition-colors">{theme.name}</h3>
                
                <p className="text-muted-foreground line-clamp-2 text-sm mb-6 flex-1">
                  {theme.description || t("common.noDescription")}
                </p>

                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mt-auto">
                  <ImageIcon className="w-4 h-4" />
                  <span>{theme.photoCount || 0} {t("common.prints")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-secondary/50 rounded-lg border border-border/50 border-dashed">
          <LayoutDashboard className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-serif text-xl font-medium mb-2">{t("themes.empty")}</h3>
          <p className="text-muted-foreground mb-6">{t("themes.emptyCta")}</p>
          <Link href="/manage">
            <Button>{t("themes.createButton")}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
