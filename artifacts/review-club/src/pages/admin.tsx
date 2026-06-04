import { useGetAdminStatus, useListReviewSessions, useCreateReviewSession, useUpdateReviewSession, getListReviewSessionsQueryKey, useListClubs } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Play, CheckCircle, Search } from "lucide-react";
import { Link } from "wouter";

export function AdminPanel() {
  const { data: adminStatus, isLoading: adminLoading } = useGetAdminStatus();
  const { data: sessions, isLoading: sessionsLoading } = useListReviewSessions();
  const { data: clubs } = useListClubs();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createSession = useCreateReviewSession();
  const updateSession = useUpdateReviewSession();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSession, setNewSession] = useState({ title: "", description: "", clubId: "", scheduledFor: "" });

  if (adminLoading) return <div>Loading...</div>;
  if (!adminStatus?.isAdmin) return <div className="text-center py-12">Access denied. Admin only.</div>;

  const handleCreate = async () => {
    if (!newSession.title || !newSession.clubId) {
      toast({ title: "Validation Error", description: "Title and Club are required.", variant: "destructive" });
      return;
    }
    
    try {
      await createSession.mutateAsync({
        data: {
          title: newSession.title,
          description: newSession.description,
          clubId: parseInt(newSession.clubId, 10),
          scheduledFor: newSession.scheduledFor ? new Date(newSession.scheduledFor).toISOString() : undefined,
        }
      });
      toast({ title: "Success", description: "Session created." });
      setIsCreateOpen(false);
      setNewSession({ title: "", description: "", clubId: "", scheduledFor: "" });
      queryClient.invalidateQueries({ queryKey: getListReviewSessionsQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to create session.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateSession.mutateAsync({ id, data: { status: newStatus } });
      toast({ title: "Status Updated", description: `Session is now ${newStatus}.` });
      queryClient.invalidateQueries({ queryKey: getListReviewSessionsQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update status.", variant: "destructive" });
    }
  };

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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif">Create Review Session</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={newSession.title} onChange={(e) => setNewSession(s => ({ ...s, title: e.target.value }))} placeholder="e.g. Winter Landscapes Critique" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="club">Club</Label>
                <Select value={newSession.clubId} onValueChange={(val) => setNewSession(s => ({ ...s, clubId: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a club" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={newSession.description} onChange={(e) => setNewSession(s => ({ ...s, description: e.target.value }))} placeholder="Goals and rules for this session..." rows={3} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Scheduled For (Optional)</Label>
                <Input id="date" type="datetime-local" value={newSession.scheduledFor} onChange={(e) => setNewSession(s => ({ ...s, scheduledFor: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createSession.isPending}>
                {createSession.isPending ? "Creating..." : "Create Session"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-serif font-medium tracking-tight">All Sessions</h2>
        {sessionsLoading ? (
          <div>Loading sessions...</div>
        ) : (
          <div className="space-y-4">
            {sessions?.map(session => (
              <Card key={session.id} className="bg-card/30 border-border/50">
                <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <Link href={`/sessions/${session.id}`} className="text-xl font-serif font-semibold hover:text-primary transition-colors">
                        {session.title}
                      </Link>
                      <Badge variant={session.status === 'open' ? 'default' : session.status === 'reviewing' ? 'secondary' : 'outline'} className="uppercase text-[10px] tracking-wider">
                        {session.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex gap-4">
                      <span>{clubs?.find(c => c.id === session.clubId)?.name || 'Unknown Club'}</span>
                      {session.scheduledFor && <span>Scheduled: {format(new Date(session.scheduledFor), "MMM d, yyyy")}</span>}
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
