import {
  useGetAdminStatus,
  useListReviewSessions,
  useCreateReviewSession,
  useUpdateReviewSession,
  useListPhotographers,
  getListReviewSessionsQueryKey,
  useListClubs,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Play, CheckCircle, Search, Users } from "lucide-react";
import { Link } from "wouter";

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

  const createSession = useCreateReviewSession();
  const updateSession = useUpdateReviewSession();

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
      toast({ title: "Required fields missing", description: "Title and Club are required.", variant: "destructive" });
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
      toast({ title: "Session created", description: `"${form.title}" is now open.` });
      setIsCreateOpen(false);
      setForm(EMPTY_FORM);
      setSelectedReviewerIds(new Set());
      queryClient.invalidateQueries({ queryKey: getListReviewSessionsQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to create session.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateSession.mutateAsync({ id, data: { status: newStatus } });
      toast({ title: "Status updated", description: `Session is now ${newStatus}.` });
      queryClient.invalidateQueries({ queryKey: getListReviewSessionsQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update status.", variant: "destructive" });
    }
  };

  if (adminLoading) return <div>Loading…</div>;
  if (!adminStatus?.isAdmin) return <div className="text-center py-12 text-muted-foreground">Access denied. Admin only.</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground text-lg">Manage review sessions and platform settings.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="font-medium tracking-wide">
              <Plus className="w-4 h-4 mr-2" />
              New Session
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif">Create Review Session</DialogTitle>
            </DialogHeader>

            <div className="grid gap-5 py-4">
              {/* Title */}
              <div className="grid gap-2">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setField("title")(e.target.value)}
                  placeholder="e.g. Winter Landscapes Critique"
                />
              </div>

              {/* Club */}
              <div className="grid gap-2">
                <Label>Club <span className="text-destructive">*</span></Label>
                <Select value={form.clubId} onValueChange={handleClubChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a club" />
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
                    <Users className="w-4 h-4" /> Reviewers (from club members)
                  </Label>
                  {!clubPhotographers || clubPhotographers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members found in this club.</p>
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
                    <p className="text-xs text-muted-foreground">{selectedReviewerIds.size} reviewer{selectedReviewerIds.size !== 1 ? "s" : ""} selected</p>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="grid gap-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  value={form.description}
                  onChange={(e) => setField("description")(e.target.value)}
                  placeholder="Goals and rules for this session…"
                  rows={3}
                />
              </div>

              {/* Max photos per member */}
              <div className="grid gap-2">
                <Label htmlFor="maxPhotos">Max photos per member</Label>
                <Input
                  id="maxPhotos"
                  type="number"
                  min={1}
                  value={form.maxPhotosPerMember}
                  onChange={(e) => setField("maxPhotosPerMember")(e.target.value)}
                  placeholder="Leave blank for no limit"
                />
              </div>

              {/* Review date */}
              <div className="grid gap-2">
                <Label htmlFor="scheduledFor">Review date</Label>
                <Input
                  id="scheduledFor"
                  type="datetime-local"
                  value={form.scheduledFor}
                  onChange={(e) => setField("scheduledFor")(e.target.value)}
                />
              </div>

              {/* Submission deadline */}
              <div className="grid gap-2">
                <Label>Submission deadline</Label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={deadlineMode === "date" ? "default" : "outline"}
                    onClick={() => setDeadlineMode("date")}
                    className="text-xs"
                  >
                    Specific date
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={deadlineMode === "days" ? "default" : "outline"}
                    onClick={() => setDeadlineMode("days")}
                    className="text-xs"
                    disabled={!form.scheduledFor}
                    title={!form.scheduledFor ? "Set a review date first" : undefined}
                  >
                    Days before review
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
                    <span className="text-sm text-muted-foreground">days before review date</span>
                  </div>
                )}

                {deadlineMode === "days" && computedDeadline() && (
                  <p className="text-xs text-muted-foreground">
                    Deadline: {format(new Date(computedDeadline()!), "MMM d, yyyy HH:mm")}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createSession.isPending}>
                {createSession.isPending ? "Creating…" : "Create Session"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sessions list */}
      <div className="space-y-4">
        <h2 className="text-xl font-serif font-medium tracking-tight">All Sessions</h2>
        {sessionsLoading ? (
          <div className="text-muted-foreground">Loading sessions…</div>
        ) : !sessions?.length ? (
          <p className="text-muted-foreground text-sm">No sessions yet. Create your first one above.</p>
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
                      <span>{clubs?.find((c) => c.id === session.clubId)?.name ?? "Unknown Club"}</span>
                      {session.scheduledFor && (
                        <span>Review: {format(new Date(session.scheduledFor), "MMM d, yyyy")}</span>
                      )}
                      {session.submissionDeadline && (
                        <span>Deadline: {format(new Date(session.submissionDeadline), "MMM d, yyyy")}</span>
                      )}
                      {session.maxPhotosPerMember && (
                        <span>Max {session.maxPhotosPerMember} photo{session.maxPhotosPerMember !== 1 ? "s" : ""}/member</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      {session.status === "open" && (
                        <Button size="sm" variant="secondary" onClick={() => handleStatusChange(session.id, "reviewing")} className="w-full sm:w-auto">
                          <Play className="w-4 h-4 mr-2" /> Start Reviewing
                        </Button>
                      )}
                      {session.status === "reviewing" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(session.id, "closed")} className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10">
                          <CheckCircle className="w-4 h-4 mr-2" /> Close Session
                        </Button>
                      )}
                      {session.status === "closed" && (
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(session.id, "open")} className="w-full sm:w-auto">
                          Re-open
                        </Button>
                      )}
                      <Button size="sm" variant="default" asChild className="w-full sm:w-auto">
                        <Link href={`/sessions/${session.id}`}>
                          Manage <Search className="w-4 h-4 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
