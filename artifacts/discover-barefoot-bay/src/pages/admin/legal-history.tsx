import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLegalHistory } from "@/hooks/use-legal";
import { PolicyDocument } from "@/components/legal/policy-document";
import { LEGAL_POLICY_LABELS, formatPolicyDate, type LegalPolicy } from "@/lib/legal";

const FILTERS = [
  { value: "all", label: "All policies" },
  { value: "terms", label: LEGAL_POLICY_LABELS.terms },
  { value: "privacy", label: LEGAL_POLICY_LABELS.privacy },
  { value: "dmca", label: LEGAL_POLICY_LABELS.dmca },
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Read-only publication and acceptance history. Server enforces authorization. */
export default function LegalHistoryPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [viewing, setViewing] = useState<LegalPolicy | null>(null);
  const { data, isLoading, isError, error, refetch, isFetching } = useLegalHistory(page, filter);

  const status = (error as any)?.status;
  const pageSize = data?.pageSize ?? 50;
  const hasNext = data
    ? typeof data.total === "number"
      ? page * pageSize < data.total
      : data.acceptances.length >= pageSize
    : false;

  return (
    <div className="max-w-6xl mx-auto bg-white/95 rounded-xl p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Link href="/admin/manage-pages" className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to content management
          </Link>
          <h1 className="text-3xl">Legal policy history</h1>
          <p className="text-gray-600 text-sm mt-1">Read-only record of published policy versions and member acceptances. Records cannot be edited or removed here.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by policy">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => { setFilter(f.value); setPage(1); }}
              data-testid={`button-filter-${f.value}`}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-slate-100" />)}
        </div>
      ) : isError ? (
        <div role="alert" className="text-center py-10">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-gray-800 mb-4">
            {status === 403 || status === 401 ? "You are not authorized to view legal history." : (error as Error).message}
          </p>
          {status !== 403 && status !== 401 && (
            <Button onClick={() => refetch()} disabled={isFetching}>Try again</Button>
          )}
        </div>
      ) : data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Published versions</CardTitle>
              <CardDescription>Each published change creates a new immutable version.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.versions.length === 0 ? (
                <p className="text-sm text-gray-600">No published versions recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Policy</th><th className="py-2 pr-4">Version</th>
                      <th className="py-2 pr-4">Published</th><th className="py-2 pr-4">Notes</th><th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.versions.map((v) => (
                      <tr key={`${v.key}-${v.versionId}`} className="border-b last:border-0" data-testid={`row-version-${v.versionId}`}>
                        <td className="py-2 pr-4">{LEGAL_POLICY_LABELS[v.key]}</td>
                        <td className="py-2 pr-4 font-mono">{v.versionId}</td>
                        <td className="py-2 pr-4">{formatPolicyDate(v.publishedAt)}</td>
                        <td className="py-2 pr-4 text-gray-600">{v.changeNotes || "-"}</td>
                        <td className="py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => setViewing(v)} data-testid={`button-view-version-${v.versionId}`}>View text</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Acceptances</CardTitle>
              <CardDescription>Server-recorded acceptance time and source (signup or later review).</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.acceptances.length === 0 ? (
                <p className="text-sm text-gray-600">No acceptances on this page.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Account ID</th><th className="py-2 pr-4">Policy</th>
                      <th className="py-2 pr-4">Version</th><th className="py-2 pr-4">Accepted at</th><th className="py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.acceptances.map((a, i) => (
                      <tr key={`${a.userId}-${a.policyKey}-${a.versionId}-${i}`} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono">{a.userId}</td>
                        <td className="py-2 pr-4">{LEGAL_POLICY_LABELS[a.policyKey]}</td>
                        <td className="py-2 pr-4 font-mono">{a.versionId}</td>
                        <td className="py-2 pr-4">{formatDateTime(a.acceptedAt)}</td>
                        <td className="py-2 capitalize">{a.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex items-center justify-end gap-2 mt-4">
                <Button size="sm" variant="outline" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)} data-testid="button-history-prev">
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <span className="text-sm text-gray-600">Page {page}</span>
                <Button size="sm" variant="outline" disabled={!hasNext || isFetching} onClick={() => setPage((p) => p + 1)} data-testid="button-history-next">
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>
              {viewing ? `Version ${viewing.versionId}, published ${formatPolicyDate(viewing.publishedAt)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {viewing && <PolicyDocument policy={viewing} showHeader={false} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
