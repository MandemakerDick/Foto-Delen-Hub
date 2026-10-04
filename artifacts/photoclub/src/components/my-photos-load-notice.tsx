import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function MyPhotosLoadNotice({
  error, background, fetching, retry,
}: {
  error: unknown;
  background: boolean;
  fetching: boolean;
  retry: () => Promise<void>;
}) {
  const { t } = useTranslation();
  if (!error) return null;
  const authError = typeof error === "object" && error !== null && "status" in error &&
    (error.status === 401 || error.status === 403);
  return (
    <div role="alert" data-testid="my-photos-load-error" className="mb-6 rounded-lg border border-destructive/40 bg-secondary px-6 py-5">
      <h2 className="font-semibold">{t(background ? "myPhotos.refreshErrorTitle" : "myPhotos.loadErrorTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t(background ? "myPhotos.refreshErrorBody" : "myPhotos.loadErrorBody")}
      </p>
      {authError && <p className="mt-2 text-sm text-muted-foreground">{t("myPhotos.authErrorBody")}</p>}
      <Button type="button" className="mt-4" disabled={fetching} onClick={() => void retry()}>
        {t(fetching ? "profileLoad.retrying" : "profileLoad.retry")}
      </Button>
    </div>
  );
}