import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Flag, Plus, Search, ShieldAlert } from "lucide-react";
import AdminLayout from "@/components/layouts/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CONTENT_TYPE_LABELS, DMCA_ADMIN_API, DMCA_FILTERS, DmcaPerm, dmcaFetch, useDmcaMe } from "@/lib/dmca-admin";

type CaseRow = {
  id: string; caseNumber: string; statusLabel: string; receivedAt: string; claimantName: string;
  itemCount: number; itemTypes: string[]; uploaders: { id: string; username: string }[];
  nextDeadline: { label: string; at: string } | null; assignedAdmin: { id: string; username: string } | null;
  legalHold: boolean;
};
type CasesResponse = { cases: CaseRow[]; total: number; counts: Record<string, number> };
type DmcaFlag = { id: string; contentType: string; contentId: string; reason: string; flaggedAt: string; flaggedByName?: string };

function deadlineClass(at: string) {
  const hours = (new Date(at).getTime() - Date.now()) / 3_600_000;
  return hours < 0 ? "text-destructive font-semibold" : hours < 48 ? "text-amber-700 dark:text-amber-400 font-semibold" : "";
}

export default function DmcaDashboard() {
  const me = useDmcaMe();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("new");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [assigned, setAssigned] = useState("all");
  const casesQuery = useQuery<CasesResponse>({
    queryKey: [DMCA_ADMIN_API, "cases", filter, search, assigned],
    queryFn: () => dmcaFetch(`/cases?filter=${filter}&q=${encodeURIComponent(search)}${assigned === "all" ? "" : `&assigned=${assigned}`}`),
    enabled: me.can(DmcaPerm.VIEW),
    placeholderData: undefined,
  });
  const flagsQuery = useQuery<DmcaFlag[]>({
    queryKey: [DMCA_ADMIN_API, "flags"],
    queryFn: () => dmcaFetch("/flags?open=true"),
    enabled: me.can(DmcaPerm.VIEW),
    placeholderData: undefined,
  });
  const resolveFlag = useMutation({
    mutationFn: ({ id, resolution, caseId }: { id: string; resolution: "dismissed" | "added_to_case"; caseId?: string }) =>
      dmcaFetch(`/flags/${id}/resolve`, { method: "POST", body: { resolution, caseId: caseId ? Number(caseId) : undefined } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DMCA_ADMIN_API, "flags"] });
      queryClient.invalidateQueries({ queryKey: [DMCA_ADMIN_API, "cases"] });
      toast({ title: "Flag resolved" });
    },
    onError: (error: Error) => toast({ title: "Could not resolve flag", description: error.message, variant: "destructive" }),
  });
  const data = !casesQuery.isPlaceholderData && casesQuery.data && Array.isArray(casesQuery.data.cases) ? casesQuery.data : undefined;
  const flags = !flagsQuery.isPlaceholderData && Array.isArray(flagsQuery.data) ? flagsQuery.data : [];

  if (!me.isLoading && !me.can(DmcaPerm.VIEW)) {
    return <AdminLayout><div className="p-8 text-center"><ShieldAlert className="mx-auto h-12 w-12 text-destructive" /><h1 className="mt-3 text-2xl font-bold">Access denied</h1><p className="text-muted-foreground">The dmca.view permission is required.</p></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-3xl font-bold">DMCA cases</h1><p className="text-muted-foreground">Legal / Compliance case queue and statutory deadlines</p></div>
          {me.can(DmcaPerm.CREATE) && <Link href="/admin/dmca/new"><Button data-testid="button-new-manual-case"><Plus className="mr-2 h-4 w-4" />New manual case</Button></Link>}
        </div>

        <div className="flex flex-wrap gap-2" data-testid="filters-dmca-cases">
          {DMCA_FILTERS.map(item => <Button key={item.key} size="sm" variant={filter === item.key ? "default" : "outline"} onClick={() => setFilter(item.key)} data-testid={`filter-${item.key}`}>{item.label} <Badge variant="secondary" className="ml-2">{data?.counts?.[item.key] ?? 0}</Badge></Button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <form className="flex w-full min-w-0 flex-1 gap-2 sm:min-w-64" onSubmit={event => { event.preventDefault(); setSearch(query); }}>
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search case number, claimant, uploader…" data-testid="input-case-search" />
            <Button type="submit" variant="outline" data-testid="button-case-search"><Search className="h-4 w-4" /></Button>
          </form>
          <Select value={assigned} onValueChange={setAssigned}><SelectTrigger className="w-full sm:w-48" data-testid="select-assignment-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All assignments</SelectItem><SelectItem value="me">Assigned to me</SelectItem><SelectItem value="unassigned">Unassigned</SelectItem></SelectContent></Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Case</TableHead><TableHead>Status</TableHead><TableHead>Received</TableHead><TableHead>Items</TableHead><TableHead>Uploader</TableHead><TableHead>Next deadline</TableHead><TableHead>Assigned admin</TableHead></TableRow></TableHeader>
              <TableBody>
                {casesQuery.isLoading && <TableRow><TableCell colSpan={7}>Loading cases…</TableCell></TableRow>}
                {casesQuery.error && <TableRow><TableCell colSpan={7} className="text-destructive">{(casesQuery.error as Error).message}</TableCell></TableRow>}
                {data?.cases.map(row => (
                  <TableRow key={row.id} data-testid={`row-case-${row.id}`}>
                    <TableCell><Link href={`/admin/dmca/cases/${row.id}`}><span className="font-medium text-primary hover:underline">{row.caseNumber}</span></Link><div className="text-xs text-muted-foreground">{row.claimantName}</div></TableCell>
                    <TableCell><Badge className={row.legalHold ? "bg-amber-700" : ""}>{row.statusLabel}</Badge></TableCell>
                    <TableCell>{new Date(row.receivedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{row.itemCount} · {row.itemTypes.map(t => CONTENT_TYPE_LABELS[t] ?? t).join(", ")}</TableCell>
                    <TableCell>{row.uploaders.map(u => u.username).join(", ") || "—"}</TableCell>
                    <TableCell className={row.nextDeadline ? deadlineClass(row.nextDeadline.at) : ""}>{row.nextDeadline ? <><div>{row.nextDeadline.label}</div><div>{new Date(row.nextDeadline.at).toLocaleString()}</div></> : "—"}</TableCell>
                    <TableCell>{row.assignedAdmin?.username ?? "Unassigned"}</TableCell>
                  </TableRow>
                ))}
                {data && data.cases.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No cases in this queue.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5" />Open content flags <Badge>{flags.length}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {flagsQuery.error && <p className="text-destructive">{(flagsQuery.error as Error).message}</p>}
            {flags.map(flag => (
              <div key={flag.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3" data-testid={`flag-${flag.id}`}>
                <div><p className="font-medium">{CONTENT_TYPE_LABELS[flag.contentType] ?? flag.contentType} · {flag.contentId}</p><p className="text-sm">{flag.reason}</p><p className="text-xs text-muted-foreground">Flagged {new Date(flag.flaggedAt).toLocaleString()} {flag.flaggedByName ? `by ${flag.flaggedByName}` : ""}</p></div>
                {me.can(DmcaPerm.REVIEW) && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => resolveFlag.mutate({ id: flag.id, resolution: "dismissed" })}>Dismiss</Button><Button size="sm" onClick={() => { const caseId = prompt("Case ID to add this content to"); if (caseId) resolveFlag.mutate({ id: flag.id, resolution: "added_to_case", caseId }); }}>Add to case</Button></div>}
              </div>
            ))}
            {!flagsQuery.isLoading && flags.length === 0 && <p className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4" />No open flags.</p>}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}