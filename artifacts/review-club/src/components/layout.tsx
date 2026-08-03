import { Link, useLocation } from "wouter";
import { Show, useClerk, useUser, SignInButton } from "@clerk/react";
import { useGetAdminStatus, getGetAdminStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { KeyRound, ScanEye, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "react-i18next";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: adminStatus } = useGetAdminStatus();
  const queryClient = useQueryClient();
  const [bootstrapping, setBootstrapping] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      const res = await fetch(`/api/admins/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayName: "Admin" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || "Failed to claim admin.", variant: "destructive" });
      } else {
        queryClient.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() });
      }
    } finally {
      setBootstrapping(false);
    }
  };

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState("");
  const [recoveryName, setRecoveryName] = useState("");
  const [recovering, setRecovering] = useState(false);

  const handleRecover = async () => {
    if (!recoveryToken.trim()) return;
    setRecovering(true);
    try {
      const res = await fetch("/api/admins/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recoveryToken: recoveryToken.trim(), displayName: recoveryName.trim() || "Admin" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || "Recovery failed.", variant: "destructive" });
      } else {
        setShowRecovery(false);
        setRecoveryToken("");
        queryClient.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() });
      }
    } finally {
      setRecovering(false);
    }
  };

  const showBootstrapBanner = adminStatus?.totalAdmins === 0 && !adminStatus?.isAdmin;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <header className="border-b border-border/50 sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ScanEye className="w-6 h-6" />
              <span className="font-serif font-bold text-xl tracking-wider uppercase">PhotoReviewHub</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-muted-foreground"}`}>
                {t("nav.sessions")}
              </Link>
              <Link href="/archive" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/archive" ? "text-primary" : "text-muted-foreground"}`}>
                {t("nav.archive")}
              </Link>
              {adminStatus?.isAdmin && (
                <Link href="/admin" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/admin" ? "text-primary" : "text-muted-foreground"}`}>
                  {t("nav.admin")}
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="outline" size="sm" className="gap-2 border-border/50">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("nav.signIn")}</span>
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-3">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user.fullName || "User"} className="w-8 h-8 rounded-sm object-cover border border-border/50" />
                ) : (
                  <div className="w-8 h-8 rounded-sm bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                    {user?.firstName?.[0] ?? "U"}
                  </div>
                )}
                <button
                  onClick={() => signOut({ redirectUrl: basePath || "/" })}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("nav.signOut")}
                </button>
              </div>
            </Show>
          </div>
        </div>
      </header>

      {showBootstrapBanner && (
        <div className="bg-primary/10 border-b border-primary/20 py-3 px-4">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{t("admin.noAdmins")}</span> {t("admin.bootstrapDesc")}
            </p>
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="shrink-0 text-sm font-medium px-4 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                {t("admin.signInToClaim")}
              </Link>
            </Show>
            <Show when="signed-in">
              <button
                onClick={handleBootstrap}
                disabled={bootstrapping}
                className="shrink-0 text-sm font-medium px-4 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {bootstrapping ? t("admin.claiming") : t("admin.claimAdmin")}
              </button>
            </Show>
          </div>
        </div>
      )}

      {/* Admin recovery — shown to signed-in non-admins when admins already exist */}
      <Show when="signed-in">
        {!adminStatus?.isAdmin && adminStatus !== undefined && adminStatus.totalAdmins > 0 && (
          <div className="bg-muted/40 border-b border-border/50 py-2 px-4">
            <div className="container mx-auto flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {t("admin.notAdmin")}
              </p>
              <button
                onClick={() => setShowRecovery(!showRecovery)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <KeyRound className="w-3 h-3" />
                {t("admin.recoveryMode")}
              </button>
            </div>
            {showRecovery && (
              <div className="container mx-auto mt-3 pb-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <input
                  type="text"
                  placeholder={t("admin.namePlaceholder")}
                  value={recoveryName}
                  onChange={e => setRecoveryName(e.target.value)}
                  className="text-sm border border-border rounded px-3 py-1.5 bg-background w-36 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="password"
                  placeholder={t("admin.recoveryTokenPlaceholder")}
                  value={recoveryToken}
                  onChange={e => setRecoveryToken(e.target.value)}
                  className="text-sm border border-border rounded px-3 py-1.5 bg-background w-56 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleRecover}
                  disabled={recovering || !recoveryToken.trim()}
                  className="shrink-0 text-sm font-medium px-4 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {recovering ? t("admin.recovering") : t("admin.claimAdminBtn")}
                </button>
              </div>
            )}
          </div>
        )}
      </Show>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-border/50 py-8 mt-12 text-center text-sm text-muted-foreground">
        <p className="font-serif italic">&copy; {new Date().getFullYear()} PhotoReviewHub. {t("footer.tagline")}</p>
      </footer>
    </div>
  );
}
