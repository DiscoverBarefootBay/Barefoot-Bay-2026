import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copyright } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CopyrightCaseDetail } from "./types";
import { formatNoticeDate } from "./types";

export default function CopyrightNoticeDetailPage() {
  const [, params] = useRoute<{ caseNumber: string }>("/copyright-notices/:caseNumber");
  const caseNumber = params?.caseNumber || "";
  const query = useQuery<CopyrightCaseDetail>({
    queryKey: [`/api/dmca/my-cases/${encodeURIComponent(caseNumber)}`],
    enabled: Boolean(caseNumber),
    placeholderData: undefined,
  });
  const detail = query.data && !Array.isArray(query.data) && query.data.notice ? query.data : null;

  if (query.isLoading) return <p className="py-12 text-center" data-testid="status-copyright-notice-loading">Loading notice information…</p>;
  if (query.error || !detail) return <div className="mx-auto max-w-3xl py-8"><p className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800" data-testid="status-copyright-notice-error">{query.error instanceof Error ? query.error.message : "Notice information could not be found."}</p></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <Link href="/copyright-notices"><Button variant="ghost" data-testid="button-back-copyright-notices"><ArrowLeft className="mr-2 h-4 w-4" />Copyright Notices</Button></Link>
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Copyright className="h-7 w-7" />Notice information</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2"><span>Case {detail.caseNumber}</span><Badge variant="secondary" data-testid="status-copyright-notice">{detail.statusLabel}</Badge></div>
      </div>
      <Card>
        <CardHeader><CardTitle>Claim summary</CardTitle></CardHeader>
        <CardContent className="space-y-4" data-testid="section-claim-summary">
          <div><p className="text-sm font-medium text-muted-foreground">Notice received</p><p>{formatNoticeDate(detail.notice.receivedAt)}</p></div>
          <div><p className="text-sm font-medium text-muted-foreground">Claimant</p><p>{detail.notice.claimantName}</p></div>
          <div><p className="text-sm font-medium text-muted-foreground">Copyrighted work</p><p className="whitespace-pre-wrap">{detail.notice.copyrightedWork}</p></div>
          <div><p className="text-sm font-medium text-muted-foreground">Claim description</p><p className="whitespace-pre-wrap">{detail.notice.claimDescription}</p></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Affected content</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {detail.items.map((item, index) => <div key={`${item.originalUrl}-${index}`} className="rounded-md border p-3"><p className="font-medium">{item.title || item.contentTypeLabel}</p><a href={item.originalUrl} className="break-all text-sm text-primary underline" data-testid={`link-notice-original-content-${index}`}>{item.originalUrl}</a></div>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>How to respond</CardTitle></CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap" data-testid="text-how-to-respond">{detail.howToRespond}</p>
          <p className="mt-4 text-xs text-muted-foreground">Response template pending counsel review.</p>
          {detail.canSubmitCounterNotice && <Link href={detail.counterNoticeUrl}><Button className="mt-4" data-testid="button-detail-submit-counter-notice">Submit counter-notice</Button></Link>}
        </CardContent>
      </Card>
    </div>
  );
}
