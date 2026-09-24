import { ExternalLink, FileLock2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONTENT_TYPE_LABELS, DmcaPerm, TARGET_STATE_LABELS, dmcaFetch, useDmcaMe } from "@/lib/dmca-admin";
import type { CaseDetail } from "./types";

const stateClass: Record<string, string> = {
  published: "bg-emerald-700", dmca_hidden: "bg-destructive", moderation_hidden: "bg-slate-600",
  deleted: "bg-black", legal_hold: "bg-amber-700",
};

async function openPrivate(path: string) {
  const result = await dmcaFetch<{ url: string }>(`/files?path=${encodeURIComponent(path)}`);
  window.open(result.url, "_blank", "noopener,noreferrer");
}
async function openEvidence(id: string) {
  const result = await dmcaFetch<{ url: string }>(`/api/dmca/evidence/${id}/link`, { method: "POST" });
  window.open(result.url, "_blank", "noopener,noreferrer");
}

export function NoticeAndClaim({ detail }: { detail: CaseDetail }) {
  const me = useDmcaMe();
  return <Card><CardHeader><CardTitle>Notice(s), claimant, claim & statements</CardTitle></CardHeader><CardContent className="space-y-4">
    {detail.submissions.map(submission => <div key={submission.id} className="rounded-md border p-4" data-testid={`submission-${submission.id}`}>
      <div className="flex flex-wrap justify-between gap-2"><div><Badge variant="outline">{submission.submissionType}</Badge><p className="mt-1 font-medium">{submission.submittedByName}</p><p className="text-xs text-muted-foreground">Received {new Date(submission.receivedAt).toLocaleString()}</p></div>
      {submission.hasDocument && submission.originalDocumentPath && me.can(DmcaPerm.VIEW_PRIVATE_FILES) && <Button variant="outline" size="sm" onClick={() => openPrivate(submission.originalDocumentPath!)}><FileLock2 className="mr-2 h-4 w-4" />Open original document</Button>}</div>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">{Object.entries(submission.formPayload ?? {}).map(([key, value]) => <div key={key}><dt className="font-medium capitalize">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="whitespace-pre-wrap break-words text-muted-foreground [overflow-wrap:anywhere]"><PayloadValue value={value} /></dd></div>)}</dl>
      <div className="mt-3 border-t pt-3 text-sm"><span className="font-medium">Signature:</span> {submission.signatureValue || "—"}</div>
    </div>)}
  </CardContent></Card>;
}

export function Targets({ detail }: { detail: CaseDetail }) {
  const me = useDmcaMe();
  return <Card><CardHeader><CardTitle>Content targets</CardTitle></CardHeader><CardContent className="space-y-3">
    {detail.targets.map(target => <div key={target.id} className="rounded-md border p-4" data-testid={`target-${target.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{CONTENT_TYPE_LABELS[target.contentType] ?? target.contentType} · {target.contentId}</p>{target.originalUrl && <a className="text-sm text-primary hover:underline" href={target.originalUrl} target="_blank" rel="noreferrer">{target.originalUrl}</a>}</div><Badge className={stateClass[target.state] ?? ""}>{TARGET_STATE_LABELS[target.state] ?? target.state}</Badge></div>
      {target.preview && <div className="mt-3 rounded bg-muted p-3"><p className="font-medium">{target.preview.title || "Content preview"}</p><p className="text-sm whitespace-pre-wrap">{target.preview.excerpt}</p>{target.preview.url && <a className="mt-2 inline-flex items-center text-sm text-primary" href={target.preview.url} target="_blank" rel="noreferrer">Open content <ExternalLink className="ml-1 h-3 w-3" /></a>}</div>}
      {target.quarantinedFiles.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{target.quarantinedFiles.map(file => <Button key={file.id} size="sm" variant="outline" disabled={!me.can(DmcaPerm.VIEW_PRIVATE_FILES)} onClick={() => openEvidence(file.id)}><FileLock2 className="mr-2 h-4 w-4" />{file.fileBasename}</Button>)}</div>}
    </div>)}
  </CardContent></Card>;
}

export function Uploaders({ detail }: { detail: CaseDetail }) {
  return <Card><CardHeader><CardTitle>Uploader accounts & prior copyright events</CardTitle></CardHeader><CardContent className="space-y-4">{detail.uploaders.map(user => <div key={user.id} className="rounded-md border p-4"><div className="flex items-center justify-between"><div><p className="font-medium">{user.fullName || user.username} (@{user.username})</p><p className="text-sm text-muted-foreground">{user.email} · Joined {new Date(user.createdAt).toLocaleDateString()}</p></div>{user.isBlocked && <Badge variant="destructive">Blocked</Badge>}</div><div className="mt-3 space-y-2">{user.priorEvents.length ? user.priorEvents.map((event, index) => <div key={String(event.id ?? index)} className="text-sm"><span className="font-medium">{event.eventType}</span> · {event.caseNumber ?? event.dmcaCaseId} · {event.eventDate ? new Date(event.eventDate).toLocaleDateString() : ""} {event.countsTowardRepeatPolicy && <Badge variant="outline">Counts toward policy</Badge>}</div>) : <p className="text-sm text-muted-foreground">No prior copyright events.</p>}</div></div>)}</CardContent></Card>;
}

export function Timeline({ detail }: { detail: CaseDetail }) {
  return <Card><CardHeader><CardTitle>Audit timeline</CardTitle></CardHeader><CardContent><ol className="relative space-y-4 border-l pl-5">{detail.timeline.map(item => <li key={item.id}><span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" /><p className="font-medium">{item.event.replaceAll("_", " ")}</p><p className="text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleString()} · {item.actorName || item.actorType}</p>{item.notes && <p className="mt-1 text-sm whitespace-pre-wrap break-words">{item.notes}</p>}{(item.previousValue || item.newValue) && <p className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">Changed from {JSON.stringify(item.previousValue)} to {JSON.stringify(item.newValue)}</p>}</li>)}</ol></CardContent></Card>;
}

/** Readable rendering of submitted form values: lists for arrays, Yes/No for statements, nested key/value for objects. */
function PayloadValue({ value }: { value: unknown }) {
  if (value == null || value === "") return <>—</>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <>—</>;
    return <ul className="list-disc space-y-0.5 pl-4">{value.map((v, i) => <li key={i}><PayloadValue value={v} /></li>)}</ul>;
  }
  if (typeof value === "object") {
    return <ul className="space-y-0.5">{Object.entries(value as Record<string, unknown>).map(([k, v]) => <li key={k}><span className="font-medium">{k.replace(/([A-Z])/g, " $1")}:</span> <PayloadValue value={v} /></li>)}</ul>;
  }
  return <>{String(value)}</>;
}
