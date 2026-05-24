import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getGetInviteSessionQueryKey } from "@workspace/api-client-react";

export default function Join() {
  const { t } = useTranslation();
  const { token: tokenParam } = useParams<{ token?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [manualToken, setManualToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [autoAttempted, setAutoAttempted] = useState(false);

  const redeem = async (token: string) => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/invites/redeem", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          res.status === 400 || res.status === 404
            ? t("join.invalidToken")
            : t("join.errorGeneric");
        toast({ title: t("common.error"), description: body.error || msg, variant: "destructive" });
        return;
      }
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: getGetInviteSessionQueryKey() });
    } catch {
      toast({ title: t("common.error"), description: t("join.errorGeneric"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-redeem from URL token on mount
  useEffect(() => {
    if (tokenParam && !autoAttempted) {
      setAutoAttempted(true);
      redeem(tokenParam);
    }
  }, [tokenParam]);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <CheckCircle2 className="w-16 h-16 mx-auto text-primary" />
          <div className="space-y-2">
            <h1 className="font-serif text-3xl font-medium">{t("join.successHeading")}</h1>
            <p className="text-muted-foreground">{t("join.successDesc")}</p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={() => navigate("/upload")}>{t("join.goUpload")}</Button>
            <Button variant="outline" onClick={() => navigate("/manage")}>{t("join.goManage")}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-3">
          <Link2 className="w-12 h-12 mx-auto text-primary" />
          <h1 className="font-serif text-3xl font-medium">{t("join.heading")}</h1>
          <p className="text-muted-foreground">{t("join.desc")}</p>
        </div>

        {tokenParam ? (
          /* URL had a token — show spinner while auto-redeeming */
          <div className="flex justify-center">
            {loading && <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          /* No URL token — show manual entry */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">{t("join.enterToken")}</p>
            <div className="flex gap-2">
              <Input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder={t("join.tokenPlaceholder")}
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && redeem(manualToken)}
              />
              <Button onClick={() => redeem(manualToken)} disabled={!manualToken.trim() || loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("join.joinBtn")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
