import {
  useGetAdminStatus,
  useListReviewSessions,
  useCreateReviewSession,
  useUpdateReviewSession,
  useDeleteReviewSession,
  useListPhotographers,
  getListReviewSessionsQueryKey,
  useListClubs,
} from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { useDateLocale } from "@/hooks/use-date-locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Plus, Play, CheckCircle, Search, Users, Trash2, KeyRound } from "lucide-react";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const EMPTY_FORM = {
  title: "",
  description: "",
  clubId: "",
  scheduledFor: "",
  submissionDeadline: "",
  maxPhotosPerMember: "",
  deadlineDays: "",
};

export function AdminPanel() {
  const { data: adminStatus, isLoading: adminLoading } = useGetAdminStatus();
  const { data: sessions, isLoading: sessionsLoading } = useListReviewSessions();
  const { data: clubs } = useListClubs();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const createSession = useCreateReviewSession();
  const updateSession = useUpdateReviewSession();
  const deleteSession = useDeleteReviewSession();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<Set<number>>(new Set());
  const [deadlineMode, setDeadlineMode] = useState<"date" | "days">("date");

  const clubIdNum = form.clubId ? parseInt(form.clubId, 10) : undefined;

  const { data: clubPhotographers } = useListPhotographers(
    clubIdNum ? { clubId: clubIdNum } : undefined,
    { query: { enabled: !!clubIdNum, queryKey: ['photographers', { clubId: clubIdNum }] } }
  );

  const setField = (key: keyof typeof EMPTY_FORM) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const toggleReviewer = (id: number) => {
    setSelectedReviewerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const computedDeadline = (): string | null => {
    if (deadlineMode === "date") return form.submissionDeadline || null;
    if (deadlineMode === "days" && form.scheduledFor && form.deadlineDays) {
      const days = parseInt(form.deadlineDays, 10);
      if (!isNaN(days) && days > 0) {
        const d = new Date(form.scheduledFor);
        d.setDate(d.getDate() - days);
        return d.toISOString();
      }
    }
    return null;
  };

  const handleClubChange = (val: string) => {
    setForm((f) => ({ ...f, clubId: val }));
    setSelectedReviewerIds(new Set());
  };

  const handleCreate = async () => {
    if (!form.title || !form.clubId) {
      toast({ title: t("admin.toastRequiredTitle"), description: t("admin.toastRequiredDesc"), variant: "destructive" });
      return;
    }

    const deadline = computedDeadline();

    try {
      await createSession.mutateAsync({
        data: {
          title: form.title,
          description: form.description || undefined,
          clubId: parseInt(form.clubId, 10),
          scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : undefined,
          submissionDeadline: deadline ?? undefined,
          maxPhotosPerMember: form.maxPhotosPerMember ? parseInt(form.maxPhotosPerMember, 10) : undefined,
          reviewerIds: selectedReviewerIds.size > 0 ? Array.from(selectedReviewerIds) : undefined,
        },
      });
      toast({ title: t("admin.toastSessionCreatedTitle"), description: t("admin.toastSessionCreatedDesc", { title: form.title }) });
      setIsCreateOpen(false);
      setForm(EMPTY_FORM);
      setSelectedReviewerIds(new Set());
      queryClient.invalidateQueries({ queryKey: getListReviewSessionsQueryKey() });
    } catch (e: any) {
      toast({ title: t("admin.toastError"), description: e.message || t("admin.toastCreateFailed"), variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateSession.mutateAsync({ id, data: { status: newStatus } });
      toast({ title: t("admin.toastStatusUpdatedTitle"), description: t("admin.toastStatusUpdatedDesc", { status: newStatus }) });
      queryClient.invalidateQueries({ queryKey: getListReviewSessionsQueryKey() });
    } catch (e: any) {
      toast({ title: t("admin.toastError"), description: e.message || t("admin.toastUpdateFailed"), variant: "destructive" });
    }
  };

  const handleDelete = async (id: number, title: string) => {
    try {
      await deleteSession.mutateAsync({ id });
      toast({ title: t("admin.toastSessionDeletedTitle"), description: t("admin.toastSessionDeletedDesc", { title }) });
      queryClient.invalidateQueries({ queryKey: getListReviewSessionsQueryKey() });
    } catch (e: any) {
      toast({ title: t("admin.toastError"), description: e.message || t("admin.toastDeleteFailed"), variant: "destructive" });
    }
  };

  if (adminLoading) return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-border/50 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
      </div>
    </div>
  );
  if (!adminStatus?.isAdmin) return <div className="text-center py-12 text-muted-foreground">{t("admin.accessDenied")}</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8 text-primary" />
            {t("admin.title")}
          </h1>
          <p className="text-muted-foreground text-lg">{t("admin.subtitle")}</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="font-medium tracking-wide">
              <Plus className="w-4 h-4 mr-2" />
              {t("admin.newSession")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif">{t("admin.createSession")}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-5 py-4">
              {/* Title */}
              <div className="grid gap-2">
                <Label htmlFor="title">{t("admin.titleLabel")} <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setField("title")(e.target.value)}
                  placeholder={t("admin.titlePlaceholder")}
                />
              </div>

              {/* Club */}
              <div className="grid gap-2">
                <Label>{t("admin.clubLabel")} <span className="text-destructive">*</span></Label>
                <Select value={form.clubId} onValueChange={handleClubChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.clubPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs?.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reviewers */}
              {clubIdNum && (
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> {t("admin.reviewersLabel")}
                  </Label>
                  {!clubPhotographers || clubPhotographers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("admin.noClubMembers")}</p>
                  ) : (
                    <div className="border border-border rounded-md p-3 grid gap-2 max-h-48 overflow-y-auto">
                      {clubPhotographers.map((p) => (
                        <label key={p.id} className="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors">
                          <Checkbox
                            checked={selectedReviewerIds.has(p.id)}
                            onCheckedChange={() => toggleReviewer(p.id)}
                          />
                          <span className="text-sm font-medium">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedReviewerIds.size > 0 && (
                    <p className="text-xs text-muted-foreground">{t("admin.reviewersSelected", { count: selectedReviewerIds.size })}</p>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="grid gap-2">
                <Label htmlFor="desc">{t("admin.descriptionLabel")}</Label>
                <Textarea
                  id="desc"
                  value={form.description}
                  onChange={(e) => setField("description")(e.target.value)}
                  placeholder={t("admin.descriptionPlaceholder")}
                  rows={3}
                />
              </div>

              {/* Max photos per member */}
              <div className="grid gap-2">
                <Label htmlFor="maxPhotos">{t("admin.maxPhotosLabel")}</Label>
                <Input
                  id="maxPhotos"
                  type="number"
                  min={1}
                  value={form.maxPhotosPerMember}
                  onChange={(e) => setField("maxPhotosPerMember")(e.target.value)}
                  placeholder={t("admin.maxPhotosPlaceholder")}
                />
              </div>

              {/* Review date */}
              <div className="grid gap-2">
                <Label htmlFor="scheduledFor">{t("admin.reviewDateLabel")}</Label>
                <Input
                  id="scheduledFor"
                  type="datetime-local"
                  value={form.scheduledFor}
                  onChange={(e) => setField("scheduledFor")(e.target.value)}
                />
              </div>

              {/* Submission deadline */}
              <div className="grid gap-2">
                <Label>{t("admin.submissionDeadlineLabel")}</Label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={deadlineMode === "date" ? "default" : "outline"}
                    onClick={() => setDeadlineMode("date")}
                    className="text-xs"
                  >
                    {t("admin.specificDate")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={deadlineMode === "days" ? "default" : "outline"}
                    onClick={() => setDeadlineMode("days")}
                    className="text-xs"
                    disabled={!form.scheduledFor}
                    title={!form.scheduledFor ? t("admin.setReviewDateFirst") : undefined}
                  >
                    {t("admin.daysBeforeReview")}
                  </Button>
                </div>

                {deadlineMode === "date" ? (
                  <Input
                    type="datetime-local"
                    value={form.submissionDeadline}
                    onChange={(e) => setField("submissionDeadline")(e.target.value)}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={form.deadlineDays}
                      onChange={(e) => setField("deadlineDays")(e.target.value)}
                      placeholder="e.g. 3"
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">{t("admin.daysBeforeReviewDate")}</span>
                  </div>
                )}

                {deadlineMode === "days" && computedDeadline() && (
                  <p className="text-xs text-muted-foreground">
                    {t("admin.deadlineDisplay", { deadline: format(new Date(computedDeadline()!), "Pp", { locale: dateLocale }) })}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t("admin.cancel")}</Button>
              <Button onClick={handleCreate} disabled={createSession.isPending}>
                {createSession.isPending ? t("admin.creating") : t("admin.createSessionBtn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sessions list */}
      <div className="space-y-4">
        <h2 className="text-xl font-serif font-medium tracking-tight">{t("admin.allSessions")}</h2>
        {sessionsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
          </div>
        ) : !sessions?.length ? (
          <p className="text-muted-foreground text-sm">{t("admin.noSessions")}</p>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Card key={session.id} className="bg-card/30 border-border/50">
                <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link href={`/sessions/${session.id}`} className="text-xl font-serif font-semibold hover:text-primary transition-colors">
                        {session.title}
                      </Link>
                      <Badge
                        variant={session.status === "open" ? "default" : session.status === "reviewing" ? "secondary" : "outline"}
                        className="uppercase text-[10px] tracking-wider"
                      >
                        {session.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-4">
                      <span>{clubs?.find((c) => c.id === session.clubId)?.name ?? t("admin.unknownClub")}</span>
                      {session.scheduledFor && (
                        <span>{t("admin.reviewDatePrefix")} {format(new Date(session.scheduledFor), "PP", { locale: dateLocale })}</span>
                      )}
                      {session.submissionDeadline && (
                        <span>{t("admin.deadlinePrefix")} {format(new Date(session.submissionDeadline), "PP", { locale: dateLocale })}</span>
                      )}
                      {session.maxPhotosPerMember && (
                        <span>{t("admin.maxPhotosPerMember", { count: session.maxPhotosPerMember })}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                    <div className="flex gap-2 w-full sm:w-auto justify-end flex-wrap">
                      {session.status === "open" && (
                        <Button size="sm" variant="secondary" onClick={() => handleStatusChange(session.id, "reviewing")} className="w-full sm:w-auto">
                          <Play className="w-4 h-4 mr-2" /> {t("admin.startReviewing")}
                        </Button>
                      )}
                      {session.status === "reviewing" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(session.id, "closed")} className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10">
                          <CheckCircle className="w-4 h-4 mr-2" /> {t("admin.closeSession")}
                        </Button>
                      )}
                      {session.status === "closed" && (
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(session.id, "open")} className="w-full sm:w-auto">
                          {t("admin.reopen")}
                        </Button>
                      )}
                      <Button size="sm" variant="default" asChild className="w-full sm:w-auto">
                        <Link href={`/sessions/${session.id}`}>
                          {t("admin.manage")} <Search className="w-4 h-4 ml-2" />
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="w-full sm:w-auto text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("admin.deleteConfirmTitle", { title: session.title })}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("admin.deleteConfirmBody")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(session.id, session.title)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("admin.deleteSession")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Admin credentials — set email+password for password-based login */}
      <AdminCredentials adminId={adminStatus?.adminId ?? null} />
    </div>
  );
}

function AdminCredentials({ adminId }: { adminId: number | null | undefined }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (!adminId) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (email.trim()) {
        await fetch(`${basePath}/api/admins/${adminId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
      }
      if (password.trim()) {
        const res = await fetch(`${basePath}/api/admins/${adminId}/set-password`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) throw new Error();
      }
      toast({ title: t("adminCredentials.successTitle"), description: t("adminCredentials.successDesc") });
      setEmail("");
      setPassword("");
      setOpen(false);
    } catch {
      toast({ title: t("adminCredentials.errorTitle"), description: t("adminCredentials.errorDesc"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-border/50 pt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <KeyRound className="w-4 h-4" />
        {t("adminCredentials.heading")}
      </button>
      {open && (
        <form onSubmit={handleSave} className="mt-4 max-w-sm space-y-4 bg-card/30 border border-border/50 rounded-lg p-5">
          <p className="text-sm text-muted-foreground">{t("adminCredentials.description")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="cred-email">{t("adminCredentials.emailLabel")}</Label>
            <Input id="cred-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder={t("adminCredentials.emailPlaceholder")} className="bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-password">{t("adminCredentials.passwordLabel")}</Label>
            <Input id="cred-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={t("adminCredentials.passwordPlaceholder")} className="bg-background" />
          </div>
          <Button type="submit" size="sm" disabled={saving || (!email.trim() && !password.trim())}>
            {saving ? t("adminCredentials.saving") : t("adminCredentials.saveBtn")}
          </Button>
        </form>
      )}
    </div>
  );
}
