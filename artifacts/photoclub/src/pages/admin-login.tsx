import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAdminStatusQueryKey, getListAdminsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminLogin() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/admins/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.status === 401) {
        setError(t("adminLogin.invalidCredentials"));
        return;
      }
      if (!res.ok) {
        setError(t("adminLogin.errorGeneric"));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
      setLocation("/manage");
    } catch {
      setError(t("adminLogin.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-serif text-3xl font-medium">{t("adminLogin.heading")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-secondary/20 p-6 rounded-xl border border-border/50 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="admin-email">
              {t("adminLogin.emailLabel")}
            </label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("adminLogin.emailPlaceholder")}
              required
              disabled={loading}
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="admin-password">
              {t("adminLogin.passwordLabel")}
            </label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("adminLogin.passwordPlaceholder")}
              required
              disabled={loading}
              className="bg-background"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading || !email || !password}>
            {loading ? t("adminLogin.signingIn") : t("adminLogin.signInBtn")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <a href={`${basePath}/sign-in`} className="underline underline-offset-4 hover:text-foreground transition-colors">
            {t("adminLogin.ownerLink")}
          </a>
        </p>
      </div>
    </div>
  );
}
