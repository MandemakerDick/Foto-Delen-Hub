import { useState } from "react";
import { useClerk } from "@clerk/react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ProfileLoadError } from "@/hooks/my-profile-store";

export function ProfileLoadNotice({
  error, retry, background = false, publicView = false,
}: {
  error: Error | null;
  retry: () => Promise<void>;
  background?: boolean;
  publicView?: boolean;
}) {
  const { t } = useTranslation();
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  if (!error) return null;
  const expiredAuth = error instanceof ProfileLoadError && error.status === 401;
  const onRetry = async () => {
    setPending(true);
    try { await retry(); } finally { setPending(false); }
  };
  const onSignOut = async () => {
    setPending(true);
    setSignOutFailed(false);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      await signOut({ redirectUrl: `${base}/sign-in` });
    } catch {
      setSignOutFailed(true);
    } finally {
      setPending(false);
    }
  };
  return (
    <div role="alert" data-testid="profile-load-error" className="mx-auto my-6 max-w-3xl rounded-lg border border-destructive/40 bg-secondary px-6 py-5">
      <h2 className="font-semibold">{t(background ? "profileLoad.refreshTitle" : "profileLoad.title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t(expiredAuth ? "profileLoad.authBody" : publicView ? "profileLoad.publicBody" : background ? "profileLoad.refreshBody" : "profileLoad.body")}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={() => void onRetry()} disabled={pending}>
          {t(pending ? "profileLoad.retrying" : "profileLoad.retry")}
        </Button>
        {expiredAuth && (
          <Button type="button" variant="outline" onClick={() => void onSignOut()} disabled={pending}>
            {t("profileLoad.signInAgain")}
          </Button>
        )}
      </div>
      {signOutFailed && <p className="mt-3 text-sm text-destructive">{t("profileLoad.signOutError")}</p>}
    </div>
  );
}