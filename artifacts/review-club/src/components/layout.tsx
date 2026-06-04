import { Link, useLocation } from "wouter";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { useGetAdminStatus } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: adminStatus } = useGetAdminStatus();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <header className="border-b border-border/50 sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-serif text-xl font-bold tracking-tight text-foreground hover:text-primary transition-colors">
              ReviewClub
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-muted-foreground"}`}>
                Sessions
              </Link>
              <Link href="/archive" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/archive" ? "text-primary" : "text-muted-foreground"}`}>
                Archive
              </Link>
              {adminStatus?.isAdmin && (
                <Link href="/admin" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/admin" ? "text-primary" : "text-muted-foreground"}`}>
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm font-medium px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton 
                appearance={{ 
                  elements: { 
                    userButtonAvatarBox: "w-8 h-8 rounded-sm",
                  }
                }} 
              />
            </SignedIn>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-border/50 py-8 mt-12 text-center text-sm text-muted-foreground">
        <p className="font-serif italic">&copy; {new Date().getFullYear()} ReviewClub. Focus on the frame.</p>
      </footer>
    </div>
  );
}
