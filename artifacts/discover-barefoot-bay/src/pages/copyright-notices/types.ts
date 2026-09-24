export type CopyrightCaseStatus =
  | "content_disabled"
  | "counter_notice_received"
  | "waiting_period"
  | "content_restored"
  | "closed";

export type CopyrightItem = {
  contentType: string;
  contentTypeLabel: string;
  originalUrl: string;
  title: string | null;
  removed: boolean;
};

export type CopyrightCaseSummary = {
  caseNumber: string;
  status: CopyrightCaseStatus;
  statusLabel: "Content disabled" | "Counter-notice received" | "Waiting period in progress" | "Content restored" | "Closed";
  disabledAt: string;
  counterNoticeSubmittedAt: string | null;
  waitingPeriod: { startedAt: string; earliestRestoreAt: string; latestRestoreAt: string } | null;
  restoredAt: string | null;
  closedAt: string | null;
  items: CopyrightItem[];
  canSubmitCounterNotice: boolean;
};

export type CopyrightCaseDetail = CopyrightCaseSummary & {
  notice: {
    receivedAt: string;
    claimantName: string;
    copyrightedWork: string;
    claimDescription: string;
  };
  howToRespond: string;
  counterNoticeUrl: string;
  templateStatus: "pending_counsel_review";
};

export function formatNoticeDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}
