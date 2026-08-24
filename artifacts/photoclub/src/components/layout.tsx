import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Camera, Users, LayoutDashboard, User, Settings, LogIn, ImageIcon, ShieldCheck, LogOut, Menu, X, Heart, UserPlus, KeyRound } from "lucide-react";
import { Button } from "./ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { Show, useAuth, useClerk, SignInButton, UserButton } from "@clerk/react";
import { useGetAdminStatus, getGetAdminStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const homePath = `${basePath}/`;

// Clerk reuses cardBox for sign-in forms and the avatar's account profile.
// The profile needs room for its navigation column plus page content, while
// sign-in should remain compact, so scope the wider card to UserButton only.
const accountProfileAppearance = {
  elements: {
    cardBox: "!w-[min(760px,calc(100vw-1rem))] sm:!w-[min(760px,calc(100vw-3rem))]",
  },
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: adminStatus } = useGetAdminStatus({
    query: { retry: false, queryKey: getGetAdminStatusQueryKey() },
  });

  // When Clerk signs out, force-refetch adminStatus so a stale isAdmin:true
  // from the cache doesn't leave the admin badge showing after sign-out.
  const prevIsSignedIn = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (prevIsSignedIn.current === true && !isSignedIn) {
      queryClient.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() });
    }
    prevIsSignedIn.current = !!isSignedIn;
  }, [isSignedIn, queryClient]);

  // True when the session admin cookie is the active auth method.
  // This includes the case where a Clerk member also signed in via the admin
  // login form — in that situation isSignedIn is true but the admin badge and
  // logout button should still appear.
  const isSessionAdmin = !!adminStatus?.isAdmin && (!isSignedIn || !!adminStatus?.sessionAdminActive);

  const handleSessionSignOut = async () => {
    try {
      await fetch(`${basePath}/api/admins/logout`, { method: "POST", credentials: "include" });
    } finally {
      window.location.assign(homePath);
    }
  };

  const handleClerkSignOut = async () => {
    await signOut();
    window.location.assign(homePath);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/photos", label: t("nav.gallery"), icon: LayoutDashboard },
    { href: "/clubs", label: t("nav.clubs"), icon: Users },
    { href: "/themes", label: t("nav.themes"), icon: Camera },
    { href: "/photographers", label: t("nav.photographers"), icon: User },
  ];
  const personalItems = [
    { href: "/liked-photos", label: t("nav.likedPhotos"), icon: Heart },
    { href: "/following", label: t("nav.following"), icon: UserPlus },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md relative">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <Camera className="w-6 h-6" />
            <span className="font-serif font-bold text-xl tracking-wider uppercase">PhotoMatrix</span>
          </Link>

          {/* Full desktop nav — show inline from lg (1024 px) upward; the
              hamburger covers phones, the Fold, and small tablets below that. */}
          <nav className="hidden lg:flex items-center gap-6">
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

          <div className="flex items-center gap-2">
            {/* Labeled navigation menu — visible until the full desktop layout fits. */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden h-9 gap-1.5 px-2 text-muted-foreground"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              <span className="hidden sm:inline">{t("nav.menu")}</span>
            </Button>
            {/* Clerk signed-in user — keep the narrow header focused on menu + avatar. */}
            <Show when="signed-in">
              <Link href="/my-photos" className="hidden lg:inline-block" data-testid="desktop-my-photos">
                <Button
                  variant={location.startsWith("/my-photos") ? "default" : "ghost"}
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  title={t("nav.myPhotos")}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{t("nav.myPhotos")}</span>
                </Button>
              </Link>
              {personalItems.map((item) => (
                <Link key={item.href} href={item.href} className="hidden lg:block">
                  <Button
                    variant={location.startsWith(item.href) ? "default" : "ghost"}
                    size="sm"
                    className="gap-1.5 px-2 text-muted-foreground"
                    title={item.label}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden xl:inline">{item.label}</span>
                  </Button>
                </Link>
              ))}
              <UserButton userProfileProps={{ appearance: accountProfileAppearance }}>
                <UserButton.MenuItems>
                  <UserButton.Link
                    label={t("nav.myPhotos")}
                    labelIcon={<ImageIcon className="w-4 h-4" />}
                    href={basePath + "/my-photos"}
                  />
                  <UserButton.Action
                    label={t("nav.securityPasskeys")}
                    labelIcon={<KeyRound className="w-4 h-4" />}
                    open="security"
                  />
                </UserButton.MenuItems>
              </UserButton>
            </Show>

            {/* Session-based admin indicator */}
            {isSessionAdmin && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">{adminStatus?.displayName ?? "Admin"}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={handleSessionSignOut}
                  title={t("nav.signOut")}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Photographer sign-in (Clerk) — only when not already authenticated any way */}
            {!isSessionAdmin && (
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <Button variant="outline" size="sm" className="gap-2 border-border/50">
                    <LogIn className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("nav.signIn")}</span>
                  </Button>
                </SignInButton>
                <Link href="/admin/login" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground/60 hover:text-muted-foreground px-2">
                    {t("nav.adminLogin")}
                  </Button>
                </Link>
              </Show>
            )}

            <div className="shrink-0">
              <LanguageSwitcher />
            </div>

            {(adminStatus?.isAdmin || (isSignedIn && adminStatus?.totalAdmins === 0)) && (
              <Link href="/manage">
                <Button
                  variant={location.startsWith("/manage") ? "default" : "ghost"}
                  size="sm"
                  className="gap-1 text-muted-foreground"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Compact nav dropdown — anchored to the right side of the header. */}
        {mobileMenuOpen && (
          <div
            data-testid="mobile-nav"
            className="lg:hidden absolute right-4 top-full z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-b-lg border-x border-b border-border/50 bg-background/95 shadow-xl backdrop-blur-md"
          >
            <nav className="px-4 py-3 flex flex-col gap-1">
              <p className="px-3 pb-1 pt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {t("nav.explore")}
              </p>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium tracking-wide transition-colors ${
                    location.startsWith(item.href)
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
              {isSignedIn && (
                <>
                  <div className="my-2 border-t border-border/50" />
                  <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    {t("nav.myPhotoMatrix")}
                  </p>
                  <Link
                    href="/my-photos"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium tracking-wide transition-colors ${
                      location.startsWith("/my-photos")
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 shrink-0" />
                    {t("nav.myPhotos")}
                  </Link>
                  {personalItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium tracking-wide transition-colors ${
                        location.startsWith(item.href)
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  ))}
                  <div className="my-2 border-t border-border/50" />
                  <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    {t("nav.account")}
                  </p>
                  <p className="px-3 pb-2 text-xs leading-relaxed text-muted-foreground">
                    {t("nav.accountSettingsHint")}
                  </p>
                  <button
                    type="button"
                    onClick={handleClerkSignOut}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium tracking-wide text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    {t("nav.signOut")}
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/50 py-12 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <Camera className="w-8 h-8 mx-auto mb-6 opacity-20" />
          <p className="font-serif text-sm">&copy; {new Date().getFullYear()} PhotoMatrix. {t("footer.tagline")}</p>
        </div>
      </footer>
    </div>
  );
}
