import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Unlock } from "lucide-react";
import { DmcaAccessDenied, DmcaError, DmcaLoading, DmcaPage } from "@/components/admin/dmca/support-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DmcaPerm, dmcaFetch, useDmcaMe } from "@/lib/dmca-admin";

type Hold = { id: string; caseType?: string; caseId?: string; caseNumber?: string; contentType?: string; contentId?: string; userId?: string; username?: string; reason: string; placedBy?: number; placedByName?: string; placedAt: string; releasedAt?: string; releasedByName?: string; releaseReason?: string };
type UserResult = { id: string; username: string; fullName?: string };

export default function LegalHoldsPage() {
  const me = useDmcaMe();
  const qc = useQueryClient();
  const [active, setActive] = useState(true);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [confirmPlace, setConfirmPlace] = useState(false);
  const [release, setRelease] = useState<Hold | null>(null);
  const [target, setTarget] = useState("case");
  const [reason, setReason] = useState("");
  const [caseId, setCaseId] = useState("");
  const [contentType, setContentType] = useState("forum_post");
  const [contentId, setContentId] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [releaseReason, setReleaseReason] = useState("");
  const holds = useQuery<Hold[]>({ queryKey: ["/api/admin/dmca/holds", active], queryFn: () => dmcaFetch(`/holds?active=${active}`), enabled: me.can(DmcaPerm.MANAGE_HOLDS), placeholderData: undefined });
  const users = useQuery<UserResult[]>({ queryKey: ["/api/users/search", userQuery], queryFn: async () => {
    const response = await fetch(`/api/users/search?term=${encodeURIComponent(userQuery)}`, { credentials: "include" });
    if (!response.ok) throw new Error("User search failed");
    const value = await response.json();
    return Array.isArray(value) ? value : Array.isArray(value?.users) ? value.users : [];
  }, enabled: target === "user" && userQuery.trim().length >= 2, placeholderData: undefined });
  const refresh = () => qc.invalidateQueries({ queryKey: ["/api/admin/dmca/holds"] });
  const placeMutation = useMutation({ mutationFn: () => dmcaFetch("/holds", { method: "POST", body: { target, reason, ...(target === "user" ? { userId: selectedUser?.id } : target === "content" ? { contentType, contentId } : { caseId }) } }), onSuccess: () => { setPlaceOpen(false); setConfirmPlace(false); setReason(""); refresh(); } });
  const releaseMutation = useMutation({ mutationFn: () => dmcaFetch(`/holds/${release!.id}/release`, { method: "POST", body: { reason: releaseReason } }), onSuccess: () => { setRelease(null); setReleaseReason(""); refresh(); } });
  useEffect(() => { setConfirmPlace(false); }, [target, reason, caseId, contentId, selectedUser]);
  if (me.isLoading) return <DmcaPage title="Legal holds" description="Preserve accounts, content, and case evidence."><DmcaLoading /></DmcaPage>;
  if (!me.can(DmcaPerm.MANAGE_HOLDS)) return <DmcaAccessDenied />;
  const rows = !holds.isPlaceholderData && Array.isArray(holds.data) ? holds.data : [];
  const targetReady = target === "user" ? !!selectedUser : target === "content" ? !!contentType && !!contentId.trim() : !!caseId.trim();
  return <DmcaPage title="Legal holds" description="Place and release evidence-preservation holds. Every action is audited server-side.">
    <div className="flex items-center justify-between"><Tabs value={String(active)} onValueChange={(v) => setActive(v === "true")}><TabsList><TabsTrigger value="true" data-testid="tab-active-holds">Active</TabsTrigger><TabsTrigger value="false" data-testid="tab-released-holds">Released</TabsTrigger></TabsList></Tabs><Button onClick={() => setPlaceOpen(true)} data-testid="button-place-hold"><Plus className="mr-2 h-4 w-4" />Place hold</Button></div>
    {holds.isLoading ? <DmcaLoading /> : holds.error ? <DmcaError error={holds.error} /> : <Card><CardContent className="pt-6"><Table><TableHeader><TableRow><TableHead>Target</TableHead><TableHead>Reason</TableHead><TableHead>Placed</TableHead><TableHead>Release</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((h) => <TableRow key={h.id} data-testid={`row-hold-${h.id}`}><TableCell>{h.caseNumber ? `Case ${h.caseNumber}` : h.username ? `User ${h.username}` : `${h.contentType}: ${h.contentId}`}</TableCell><TableCell className="max-w-md">{h.reason}</TableCell><TableCell>{new Date(h.placedAt).toLocaleString()} by {h.placedByName || h.placedBy}</TableCell><TableCell>{h.releasedAt ? `${new Date(h.releasedAt).toLocaleString()} — ${h.releaseReason}` : "Active"}</TableCell><TableCell>{active && <Button variant="outline" size="sm" onClick={() => setRelease(h)} data-testid={`button-release-hold-${h.id}`}><Unlock className="mr-2 h-4 w-4" />Release</Button>}</TableCell></TableRow>)}</TableBody></Table>{!rows.length && <p className="py-8 text-center text-muted-foreground">No {active ? "active" : "released"} holds.</p>}</CardContent></Card>}
    <Dialog open={placeOpen} onOpenChange={setPlaceOpen}><DialogContent><DialogHeader><DialogTitle>Place legal hold</DialogTitle><DialogDescription>This prevents deletion and preserves the selected evidence. Confirm carefully.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Target type</Label><Select value={target} onValueChange={setTarget}><SelectTrigger data-testid="select-hold-target"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="case">Case</SelectItem><SelectItem value="content">Content</SelectItem><SelectItem value="user">User</SelectItem></SelectContent></Select></div>
      {target === "case" && <div><Label>Case ID or case number</Label><Input value={caseId} onChange={(e) => setCaseId(e.target.value)} data-testid="input-hold-case" /></div>}
      {target === "content" && <div className="grid grid-cols-2 gap-3"><div><Label>Content type</Label><Select value={contentType} onValueChange={setContentType}><SelectTrigger data-testid="select-hold-content-type"><SelectValue /></SelectTrigger><SelectContent>{["forum_post","forum_comment","listing","event","event_comment","page","vendor_comment"].map((x) => <SelectItem value={x} key={x}>{x}</SelectItem>)}</SelectContent></Select></div><div><Label>Content ID</Label><Input value={contentId} onChange={(e) => setContentId(e.target.value)} data-testid="input-hold-content-id" /></div></div>}
      {target === "user" && <div><Label>User search</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={userQuery} onChange={(e) => { setUserQuery(e.target.value); setSelectedUser(null); }} data-testid="input-hold-user-search" /></div>{selectedUser && <p className="mt-2 text-sm">Selected: {selectedUser.fullName || selectedUser.username} (@{selectedUser.username})</p>}{Array.isArray(users.data) && !selectedUser && users.data.map((u) => <Button key={u.id} variant="ghost" className="w-full justify-start" onClick={() => setSelectedUser(u)} data-testid={`button-select-user-${u.id}`}>{u.fullName || u.username} (@{u.username})</Button>)}</div>}
      <div><Label>Reason (required)</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-hold-reason" /></div>
      {confirmPlace && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Confirm placing this legal hold. The target will be preserved until an authorized person releases it.</p>}
      {(placeMutation.error) && <DmcaError error={placeMutation.error} />}</div><DialogFooter><Button variant="outline" onClick={() => setPlaceOpen(false)} data-testid="button-cancel-place-hold">Cancel</Button>{confirmPlace ? <Button onClick={() => placeMutation.mutate()} disabled={placeMutation.isPending} data-testid="button-confirm-place-hold">Confirm place hold</Button> : <Button onClick={() => setConfirmPlace(true)} disabled={!targetReady || !reason.trim()} data-testid="button-review-place-hold">Review & confirm</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={!!release} onOpenChange={(o) => !o && setRelease(null)}><DialogContent><DialogHeader><DialogTitle>Release legal hold?</DialogTitle><DialogDescription>Releasing removes evidence-preservation protection. This action is audited and requires a reason.</DialogDescription></DialogHeader><div><Label>Release reason (required)</Label><Textarea value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} data-testid="input-release-reason" /></div>{releaseMutation.error && <DmcaError error={releaseMutation.error} />}<DialogFooter><Button variant="outline" onClick={() => setRelease(null)} data-testid="button-cancel-release">Cancel</Button><Button variant="destructive" disabled={!releaseReason.trim() || releaseMutation.isPending} onClick={() => releaseMutation.mutate()} data-testid="button-confirm-release">Confirm release</Button></DialogFooter></DialogContent></Dialog>
  </DmcaPage>;
}