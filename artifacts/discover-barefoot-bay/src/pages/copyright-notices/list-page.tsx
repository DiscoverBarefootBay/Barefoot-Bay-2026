import { useQuery } from "@tanstack/react-query";
import { Copyright, FileText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CopyrightCaseSummary } from "./types";
import { formatNoticeDate } from "./types";
import { useAuth } from "@/hooks/use-auth";
import { LegalApiError, isPolicyRequiredError } from "@/lib/legal";

type FiledClaim = { caseNumber: string; receivedAt: string; updatedAt: string; status: string };

export default function CopyrightNoticesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const query = useQuery<{ cases: CopyrightCaseSummary[] }>({
    queryKey: ["/api/dmca/my-cases", userId],
    enabled: userId != null,
    queryFn: async () => {
      const response = await fetch("/api/dmca/my-cases", { credentials: "include" });
      if (!response.ok) throw new Error("Could not load copyright notices");
      return response.json();
    },
    placeholderData: undefined,
  });
  const cases = query.data && !Array.isArray(query.data) && Array.isArray(query.data.cases) ? query.data.cases : [];
  const claimsQuery = useQuery<{ claims: FiledClaim[] }>({
    queryKey: ["/api/dmca/my-claims", userId],
    enabled: userId != null,
    queryFn: async () => {
      const response = await fetch("/api/dmca/my-claims", { credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new LegalApiError("Could not load filed claims", response.status, typeof body?.code === "string" ? body.code : null);
      }
      return response.json();
    },
    placeholderData: undefined,
    retry: (count, err) => !isPolicyRequiredError(err) && count < 2,
  });
  const claimsNeedPolicy = claimsQuery.isError && isPolicyRequiredError(claimsQuery.error);
  const claims = claimsQuery.data && !Array.isArray(claimsQuery.data) && Array.isArray(claimsQuery.data.claims) ? claimsQuery.data.claims : [];
  const submitted = new URLSearchParams(window.location.search).get("submitted") === "1";

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-navy"><Copyright className="h-7 w-7" />Copyright Notices</h1>
        <p className="mt-2 text-muted-foreground">Review notices affecting your uploads and copyright claims you filed while signed in.</p>
      </div>
      {submitted && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900" role="status" data-testid="status-counter-notice-submitted">
          <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" />Counter-notice received</p>
          <p className="mt-1 text-sm">Your counter-notice was submitted successfully and is awaiting review.</p>
        </div>
      )}
      {query.isLoading && <p data-testid="status-copyright-notices-loading">Loading copyright notices…</p>}
      {claimsQuery.isLoading && <p>Loading filed claims…</p>}
      {query.error && <p className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800" data-testid="status-copyright-notices-error">{(query.error as Error).message}</p>}
      {claimsNeedPolicy && (
        <div role="status" data-testid="claims-policy-required" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Claims you have filed are shown after you accept the current site policies. Your notices about your own uploads remain available below.{" "}
          <Link href="/" className="font-semibold underline" data-testid="link-claims-review-policies">Review policies</Link>
        </div>
      )}
      {claimsQuery.error && !claimsNeedPolicy && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">Could not load filed claims. Please try again.</p>}
      {!query.isLoading && !claimsQuery.isLoading && !query.error && !claimsQuery.error && cases.length === 0 && claims.length === 0 && (
        <Card data-testid="status-copyright-notices-empty">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No copyright notices</h2>
            <p className="mt-1 text-sm text-muted-foreground">There are no notices about your uploads or claims filed by this account.</p>
          </CardContent>
        </Card>
      )}
      {cases.length > 0 && <h2 className="text-xl font-semibold text-navy">Notices about your uploads</h2>}
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
      {claims.length > 0 && <h2 className="text-xl font-semibold text-navy">Claims you filed</h2>}
      {claims.map((claim) => (
        <Card key={claim.caseNumber} data-testid={`card-filed-claim-${claim.caseNumber}`}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Case {claim.caseNumber}</CardTitle>
                <CardDescription>Submitted {formatNoticeDate(claim.receivedAt)} · Updated {formatNoticeDate(claim.updatedAt)}</CardDescription>
              </div>
              <Badge variant="secondary">{claim.status}</Badge>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
