import { useQuery } from "@tanstack/react-query";
import { Copyright, FileText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CopyrightCaseSummary } from "./types";
import { formatNoticeDate } from "./types";

export default function CopyrightNoticesPage() {
  const query = useQuery<{ cases: CopyrightCaseSummary[] }>({
    queryKey: ["/api/dmca/my-cases"],
    placeholderData: undefined,
  });
  const cases = query.data && !Array.isArray(query.data) && Array.isArray(query.data.cases) ? query.data.cases : [];
  const submitted = new URLSearchParams(window.location.search).get("submitted") === "1";

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-navy"><Copyright className="h-7 w-7" />Copyright Notices</h1>
        <p className="mt-2 text-muted-foreground">Review copyright notices affecting content you uploaded and respond when available.</p>
      </div>
      {submitted && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900" role="status" data-testid="status-counter-notice-submitted">
          <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" />Counter-notice received</p>
          <p className="mt-1 text-sm">Your counter-notice was submitted successfully and is awaiting review.</p>
        </div>
      )}
      {query.isLoading && <p data-testid="status-copyright-notices-loading">Loading copyright notices…</p>}
      {query.error && <p className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800" data-testid="status-copyright-notices-error">{(query.error as Error).message}</p>}
      {!query.isLoading && !query.error && cases.length === 0 && (
        <Card data-testid="status-copyright-notices-empty">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No copyright notices</h2>
            <p className="mt-1 text-sm text-muted-foreground">There are no copyright cases associated with your uploaded content.</p>
          </CardContent>
        </Card>
      )}
      {cases.map((item) => (
        <Card key={item.caseNumber} data-testid={`card-copyright-case-${item.caseNumber}`}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Case {item.caseNumber}</CardTitle>
                <CardDescription>Content disabled {formatNoticeDate(item.disabledAt)}</CardDescription>
                {item.counterNoticeSubmittedAt && <p className="mt-1 text-sm text-muted-foreground">Counter-notice submitted {formatNoticeDate(item.counterNoticeSubmittedAt)}</p>}
                {item.restoredAt && <p className="mt-1 text-sm text-muted-foreground">Content restored {formatNoticeDate(item.restoredAt)}</p>}
                {item.closedAt && <p className="mt-1 text-sm text-muted-foreground">Closed {formatNoticeDate(item.closedAt)}</p>}
              </div>
              <Badge variant="secondary" data-testid={`status-copyright-case-${item.caseNumber}`}>{item.statusLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {item.waitingPeriod && (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-950" data-testid={`dates-waiting-period-${item.caseNumber}`}>
                <p>Waiting period started: {formatNoticeDate(item.waitingPeriod.startedAt)}</p>
                <p>Restoration window: {formatNoticeDate(item.waitingPeriod.earliestRestoreAt)}–{formatNoticeDate(item.waitingPeriod.latestRestoreAt)}</p>
              </div>
            )}
            <div className="space-y-2">
              {item.items.map((affected, index) => (
                <div key={`${affected.contentType}-${affected.originalUrl}-${index}`} className="rounded-md border p-3" data-testid={`item-copyright-case-${item.caseNumber}-${index}`}>
                  <p className="font-medium">{affected.title || affected.contentTypeLabel}</p>
                  <p className="text-sm text-muted-foreground">{affected.contentTypeLabel}</p>
                  <a className="break-all text-sm text-primary underline" href={affected.originalUrl} data-testid={`link-original-content-${item.caseNumber}-${index}`}>{affected.originalUrl}</a>
                  {affected.removed && <Badge className="ml-2 bg-red-700 text-white">Removed</Badge>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/copyright-notices/${encodeURIComponent(item.caseNumber)}`}><Button variant="outline" data-testid={`button-view-notice-${item.caseNumber}`}>View notice information</Button></Link>
              {item.canSubmitCounterNotice && (
                <Link href={`/copyright-notices/${encodeURIComponent(item.caseNumber)}/counter-notice`}><Button data-testid={`button-submit-counter-notice-${item.caseNumber}`}>Submit counter-notice</Button></Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
