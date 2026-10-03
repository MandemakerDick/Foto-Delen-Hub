import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSubmitFeedback } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export function ClubProposal({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [details, setDetails] = useState("");
  const [consent, setConsent] = useState(false);
  const submit = useSubmitFeedback();

  if (!open) return <Button type="button" variant="link" className="px-0" disabled={disabled}
    onClick={() => setOpen(true)}>{t("upload.proposeClub")}</Button>;

  return <div className="space-y-3 rounded-md border border-border p-4">
    <p className="text-sm text-muted-foreground">{t("upload.clubProposalIntro")}</p>
    <label className="block text-sm">
      {t("upload.clubName")}
      <Input value={name} maxLength={150} disabled={disabled || submit.isPending}
        onChange={(event) => setName(event.target.value)} className="mt-1" />
    </label>
    <label className="block text-sm">
      {t("upload.clubCity")}
      <Input value={city} maxLength={100} disabled={disabled || submit.isPending}
        onChange={(event) => setCity(event.target.value)} className="mt-1" />
    </label>
    <label className="block text-sm">
      {t("upload.clubDetails")}
      <Textarea value={details} maxLength={3000} disabled={disabled || submit.isPending}
        onChange={(event) => setDetails(event.target.value)} className="mt-1" />
    </label>
    <label className="flex gap-2 items-start text-sm">
      <input type="checkbox" checked={consent} disabled={disabled || submit.isPending}
        onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
      {t("upload.clubConsent")}
    </label>
    <div className="flex gap-2">
      <Button type="button" disabled={!name.trim() || !consent || disabled || submit.isPending}
        onClick={() => submit.mutate({
          data: {
            message: `[Club proposal]\nName: ${name.trim()}\nCity: ${city.trim() || "Not provided"}\nDetails: ${details.trim() || "Not provided"}`,
            consent: true,
          },
        }, {
          onSuccess: () => {
            toast({ title: t("upload.clubProposalSent") });
            setName(""); setCity(""); setDetails(""); setConsent(false); setOpen(false);
          },
          onError: () => toast({ title: t("upload.clubProposalError"), variant: "destructive" }),
        })}>
        {submit.isPending ? t("upload.submitting") : t("upload.submitClubProposal")}
      </Button>
      <Button type="button" variant="outline" disabled={submit.isPending}
        onClick={() => setOpen(false)}>{t("upload.cancel")}</Button>
    </div>
  </div>;
}