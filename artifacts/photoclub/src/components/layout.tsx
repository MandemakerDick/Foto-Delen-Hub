import { Link, useLocation } from "wouter";
import { Camera, Search, User, Users, Compass, LayoutDashboard, PlusSquare, Settings } from "lucide-react";
import { Button } from "./ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/photos", label: "Gallery", icon: Compass },
    { href: "/clubs", label: "Clubs", icon: Users },
    { href: "/themes", label: "Themes", icon: LayoutDashboard },
    { href: "/photographers", label: "Photographers", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <Camera className="w-6 h-6" />
            <span className="font-serif font-bold text-xl tracking-wider uppercase">PhotoClub</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={`text-sm font-medium tracking-wide transition-colors ${
                  location.startsWith(item.href) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/upload">
              <Button variant="ghost" size="sm" className="hidden sm:flex gap-2">
                <PlusSquare className="w-4 h-4" />
                <span>Upload</span>
              </Button>
            </Link>
            <Link href="/manage">
              <Button variant="outline" size="sm" className="gap-2 border-border/50">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Manage</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border/50 py-12 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <Camera className="w-8 h-8 mx-auto mb-6 opacity-20" />
          <p className="font-serif text-sm">&copy; {new Date().getFullYear()} PhotoClub. Curated with intention.</p>
        </div>
      </footer>
    </div>
  );
}
