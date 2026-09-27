import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import AdminLayout from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { DMCA_ADMIN_API, dmcaFetch } from "@/lib/dmca-admin";

const types = {
  all: "All types", forum_post: "Forum posts", forum_comment: "Forum comments",
  event: "Events", event_comment: "Event comments", listing: "Listings",
  page: "Pages", vendor_comment: "Vendor comments",
} as const;
type ContentType = Exclude<keyof typeof types, "all">;
type HiddenItem = {
  id: number; contentType: ContentType; title: string; publicPath: string | null;
  authorName: string | null; visibilityStatus: string;
  hiddenReason: string | null; hiddenAt: string | null; legalHold: boolean;
  activeHold: boolean; activeDmcaCase: boolean; dmcaCaseId: number | null;
};
type HiddenContentResponse = { items: HiddenItem[]; total: number; page: number; pageSize: number };

export default function ModeratedPosts() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<keyof typeof types>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HiddenItem | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const list = useQuery<HiddenContentResponse>({
    queryKey: [DMCA_ADMIN_API, "moderated-content", search, type, page],
    queryFn: () => dmcaFetch(`/moderated-content?q=${encodeURIComponent(search)}&type=${type}&page=${page}`),
    placeholderData: undefined,
  });
  const data = !list.isPlaceholderData && list.data && Array.isArray(list.data.items) ? list.data : undefined;

  async function unhide() {
    if (!selected || !reason.trim()) return;
    setBusy(true);
    try {
      await dmcaFetch(`/content/${selected.contentType}/${selected.id}/moderate`, {
        method: "POST", body: { hidden: false, reason: reason.trim() },
      });
      // Content pages use different cache keys; restoration is rare, so refresh all views.
      await queryClient.invalidateQueries();
      setSelected(null);
      setReason("");
      toast({ title: "Content unhidden" });
    } catch (error) {
      toast({ title: "Could not unhide content", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout allowModerator>
      <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Hidden content</h1>
          <p className="text-muted-foreground">Find content hidden by moderation. Items under DMCA cases or legal holds cannot be restored here; use the legal process instead.</p>
        </div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(input.trim()); }}>
          <div>
            <Label htmlFor="hidden-content-type">Content type</Label>
            <select id="hidden-content-type" className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={type} onChange={event => { setType(event.target.value as keyof typeof types); setPage(1); }}>
              {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <Label htmlFor="hidden-post-search">ID, title, or text</Label>
            <Input id="hidden-post-search" data-testid="input-hidden-post-search" maxLength={100} placeholder="Search by ID, title, or text" value={input} onChange={event => setInput(event.target.value)} />
          </div>
          <Button type="submit" data-testid="button-search-hidden-posts">Search</Button>
        </form>
        {list.isLoading && <p>Loading hidden content…</p>}
        {list.isError && <p role="alert">Could not load hidden content. {list.error instanceof Error ? list.error.message : ""}</p>}
        {data && <div className="space-y-3">
          <p data-testid="text-hidden-post-count" className="text-sm text-muted-foreground">{data.total} hidden {data.total === 1 ? "item" : "items"}</p>
          {data.items.length === 0 && <p>No moderation-hidden content matches your search.</p>}
          {data.items.map(item => {
            const blocked = item.legalHold || item.activeHold || item.activeDmcaCase || item.dmcaCaseId != null;
            return <div key={`${item.contentType}-${item.id}`} data-testid={`card-hidden-${item.contentType}-${item.id}`} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{types[item.contentType]}</p>
                  <h2 className="font-semibold break-words">{item.title} <span className="text-muted-foreground font-normal">#{item.id}</span></h2>
                  <p className="text-sm text-muted-foreground">By {item.authorName ?? "Unknown"} · {item.hiddenAt ? new Date(item.hiddenAt).toLocaleString() : "Date unavailable"}</p>
                </div>
                <span className="rounded bg-muted px-2 py-1 text-xs">Moderation hidden</span>
              </div>
              <p className="text-sm">Reason: {item.hiddenReason || "No reason recorded"}</p>
              {blocked && <p className="text-sm text-amber-700 dark:text-amber-400">Restoration blocked: {item.legalHold || item.activeHold ? "legal hold" : "DMCA case"}. Use the legal process instead.</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={blocked} onClick={() => setSelected(item)} data-testid={`button-unhide-${item.contentType}-${item.id}`}>Unhide</Button>
                {item.publicPath && <Link href={item.publicPath}><Button size="sm" variant="outline">View content</Button></Link>}
              </div>
            </div>;
          })}
          {data.total > data.pageSize && <div className="flex items-center gap-3">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="button-previous-hidden-posts">Previous</Button>
            <span>Page {page} of {Math.ceil(data.total / data.pageSize)}</span>
            <Button variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)} data-testid="button-next-hidden-posts">Next</Button>
          </div>}
        </div>}
      </div>
      <Dialog open={!!selected} onOpenChange={open => { if (!open && !busy) { setSelected(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unhide {selected ? types[selected.contentType].toLowerCase().replace(/s$/, "") : "content"} #{selected?.id}</DialogTitle>
            <DialogDescription>This removes the moderation restriction. Other publication settings may still apply. Record why you are restoring it; the reason is saved in the audit log.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="unhide-reason">Reason for unhide</Label>
          <Textarea id="unhide-reason" data-testid="input-unhide-reason" value={reason} maxLength={10000} onChange={event => setReason(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => { setSelected(null); setReason(""); }}>Cancel</Button>
            <Button disabled={busy || !reason.trim()} onClick={unhide} data-testid="button-confirm-unhide">{busy ? "Unhiding…" : "Unhide"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}