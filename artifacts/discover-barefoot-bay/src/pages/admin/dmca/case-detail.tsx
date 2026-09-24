import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole, ShieldAlert } from "lucide-react";
import AdminLayout from "@/components/layouts/admin-layout";
import { CaseActionBar, ReleaseHoldButton } from "@/components/admin/dmca/case/action-bar";
import { NoticeAndClaim, Targets, Timeline, Uploaders } from "@/components/admin/dmca/case/case-sections";
import type { CaseDetail } from "@/components/admin/dmca/case/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DMCA_ADMIN_API, DmcaPerm, dmcaFetch, useDmcaMe } from "@/lib/dmca-admin";

export default function DmcaCaseDetail() {
  const [, params] = useRoute("/admin/dmca/cases/:id");
  const id = params?.id ?? "";
  const me = useDmcaMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const caseQuery = useQuery<CaseDetail>({
    queryKey: [DMCA_ADMIN_API, "case", id],
    queryFn: () => dmcaFetch(`/cases/${id}`),
    enabled: Boolean(id) && me.can(DmcaPerm.VIEW),
    placeholderData: undefined,
  });
  const addNote = useMutation({
    mutationFn: () => dmcaFetch(`/cases/${id}/notes`, { method: "POST", body: { body: note } }),
    onSuccess: () => { setNote(""); queryClient.invalidateQueries({ queryKey: [DMCA_ADMIN_API, "case", id] }); queryClient.invalidateQueries({ queryKey: [DMCA_ADMIN_API, "cases"] }); toast({ title: "Internal note added" }); },
    onError: (error: Error) => toast({ title: "Could not add note", description: error.message, variant: "destructive" }),
  });

  if (!me.isLoading && !me.can(DmcaPerm.VIEW)) return <AdminLayout><div className="p-8 text-center"><ShieldAlert className="mx-auto h-12 w-12 text-destructive" /><h1 className="mt-3 text-2xl font-bold">Access denied</h1><p className="text-muted-foreground">The dmca.view permission is required.</p></div></AdminLayout>;
  if (caseQuery.isLoading || me.isLoading) return <AdminLayout><div className="p-8">Loading case…</div></AdminLayout>;
  if (caseQuery.error || !caseQuery.data || caseQuery.isPlaceholderData) return <AdminLayout><div className="p-8 text-destructive">{(caseQuery.error as Error | null)?.message ?? "Case data is unavailable."}</div></AdminLayout>;
  const detail = caseQuery.data;

  return <AdminLayout><div className="space-y-6 p-4 md:p-6">
    <div><Link href="/admin/dmca"><span className="mb-3 inline-flex cursor-pointer items-center text-sm text-primary hover:underline"><ArrowLeft className="mr-1 h-4 w-4" />Back to cases</span></Link><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold">{detail.case.caseNumber}</h1><Badge>{detail.case.statusLabel}</Badge>{detail.case.legalHold && <Badge className="bg-amber-700"><LockKeyhole className="mr-1 h-3 w-3" />Legal hold</Badge>}</div><p className="text-muted-foreground">{detail.case.claimantName || "Claimant"} · received {detail.case.receivedAt ? new Date(detail.case.receivedAt).toLocaleString() : "—"}</p></div></div></div>
    <CaseActionBar detail={detail} />
    <div className="grid gap-6 xl:grid-cols-2"><div className="space-y-6"><NoticeAndClaim detail={detail} /><Targets detail={detail} /><Uploaders detail={detail} /></div><div className="space-y-6">
      <Card><CardHeader><CardTitle>Legal holds</CardTitle></CardHeader><CardContent className="space-y-3">{detail.holds.length === 0 && <p className="text-sm text-muted-foreground">No legal holds.</p>}{detail.holds.map((hold, index) => <div key={String(hold.id ?? index)} className="rounded-md border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{hold.reason}</p><p className="text-xs text-muted-foreground">Placed {hold.placedAt ? new Date(hold.placedAt).toLocaleString() : "—"} by {hold.placedByName || hold.placedBy || "unknown"}</p>{hold.releasedAt && <p className="mt-1 text-xs">Released {new Date(hold.releasedAt).toLocaleString()} by {hold.releasedByName}: {hold.releaseReason}</p>}</div><Badge variant={hold.releasedAt ? "outline" : "default"}>{hold.releasedAt ? "Released" : "Active"}</Badge></div><div className="mt-2"><ReleaseHoldButton detail={detail} hold={hold} /></div></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Internal notes</CardTitle><p className="text-sm font-semibold text-destructive">Internal — never shown to users or claimants</p></CardHeader><CardContent className="space-y-4">{detail.availableActions.includes("note") && <div className="space-y-2"><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add an internal case note…" data-testid="input-internal-note" /><Button onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending} data-testid="button-add-internal-note">Add internal note</Button></div>}{detail.notes.map(item => <div key={item.id} className="border-t pt-3"><p className="whitespace-pre-wrap text-sm">{item.body}</p><p className="mt-1 text-xs text-muted-foreground">{item.authorName} · {new Date(item.createdAt).toLocaleString()}</p></div>)}</CardContent></Card>
      <Timeline detail={detail} />
    </div></div>
  </div></AdminLayout>;
}