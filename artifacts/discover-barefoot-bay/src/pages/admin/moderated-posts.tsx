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

type HiddenPost = {
  id: number; title: string; authorName: string | null; visibilityStatus: string;
  hiddenReason: string | null; hiddenAt: string | null; legalHold: boolean;
  activeHold: boolean; activeDmcaCase: boolean; dmcaCaseId: number | null;
};
type HiddenPostsResponse = { posts: HiddenPost[]; total: number; page: number; pageSize: number };

export default function ModeratedPosts() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HiddenPost | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const list = useQuery<HiddenPostsResponse>({
    queryKey: [DMCA_ADMIN_API, "moderated-posts", search, page],
    queryFn: () => dmcaFetch(`/moderated-posts?q=${encodeURIComponent(search)}&page=${page}`),
    placeholderData: undefined,
  });
  const data = !list.isPlaceholderData && list.data && Array.isArray(list.data.posts) ? list.data : undefined;

  async function unhide() {
    if (!selected || !reason.trim()) return;
    setBusy(true);
    try {
      await dmcaFetch(`/content/forum_post/${selected.id}/moderate`, {
        method: "POST", body: { hidden: false, reason: reason.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: [DMCA_ADMIN_API, "moderated-posts"] });
      await queryClient.invalidateQueries({ queryKey: ["dmca-content-status", "forum_post", String(selected.id)] });
      await queryClient.invalidateQueries({ queryKey: ["/api/forum"] });
      setSelected(null);
      setReason("");
      toast({ title: "Post unhidden" });
    } catch (error) {
      toast({ title: "Could not unhide post", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout allowModerator>
      <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Hidden forum posts</h1>
          <p className="text-muted-foreground">Find posts hidden by moderation. DMCA takedowns are managed separately.</p>
        </div>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(input.trim()); }}>
          <Label className="sr-only" htmlFor="hidden-post-search">Post ID or title</Label>
          <Input id="hidden-post-search" data-testid="input-hidden-post-search" className="max-w-md" maxLength={100} placeholder="Search by post ID or title" value={input} onChange={event => setInput(event.target.value)} />
          <Button type="submit" data-testid="button-search-hidden-posts">Search</Button>
        </form>
        {list.isLoading && <p>Loading hidden posts…</p>}
        {list.isError && <p role="alert">Could not load hidden posts. {list.error instanceof Error ? list.error.message : ""}</p>}
        {data && <div className="space-y-3">
          <p data-testid="text-hidden-post-count" className="text-sm text-muted-foreground">{data.total} hidden {data.total === 1 ? "post" : "posts"}</p>
          {data.posts.length === 0 && <p>No moderation-hidden posts match your search.</p>}
          {data.posts.map(post => {
            const blocked = post.legalHold || post.activeHold || post.activeDmcaCase || post.dmcaCaseId != null;
            return <div key={post.id} data-testid={`card-hidden-post-${post.id}`} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{post.title} <span className="text-muted-foreground font-normal">#{post.id}</span></h2>
                  <p className="text-sm text-muted-foreground">By {post.authorName ?? "Unknown"} · {post.hiddenAt ? new Date(post.hiddenAt).toLocaleString() : "Date unavailable"}</p>
                </div>
                <span className="rounded bg-muted px-2 py-1 text-xs" data-testid={`status-hidden-post-${post.id}`}>Moderation hidden</span>
              </div>
              <p className="text-sm">Reason: {post.hiddenReason || "No reason recorded"}</p>
              {blocked && <p className="text-sm text-amber-700 dark:text-amber-400">Restoration blocked: {post.legalHold || post.activeHold ? "legal hold" : "DMCA case"}. Use the legal process instead.</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={blocked} onClick={() => setSelected(post)} data-testid={`button-unhide-post-${post.id}`}>Unhide post</Button>
                {!blocked && <Link href={`/forum/post/${post.id}`}><Button size="sm" variant="outline" data-testid={`link-view-post-${post.id}`}>View post</Button></Link>}
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
            <DialogTitle>Unhide post #{selected?.id}</DialogTitle>
            <DialogDescription>This makes the post public again. Record why you are restoring it; the reason is saved in the audit log.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="unhide-reason">Reason for unhide</Label>
          <Textarea id="unhide-reason" data-testid="input-unhide-reason" value={reason} maxLength={10000} onChange={event => setReason(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => { setSelected(null); setReason(""); }}>Cancel</Button>
            <Button disabled={busy || !reason.trim()} onClick={unhide} data-testid="button-confirm-unhide">{busy ? "Unhiding…" : "Unhide post"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}