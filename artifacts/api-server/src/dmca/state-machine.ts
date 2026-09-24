/**
 * Explicit DMCA case state machine. Every status change goes through
 * assertTransition(); anything not listed here is rejected.
 *
 * Legal hold is NOT a status — it is a separate flag that can be set in any
 * state and blocks deletion. Software never decides whether infringement
 * occurred: every transition here is triggered by a human admin action or a
 * recorded submission, except the purely time-based
 * WAITING_FOR_RESTORATION_WINDOW → RESTORATION_ELIGIBLE move (which only
 * makes restoration *possible*; restoring still needs an authorized admin).
 */

export const DmcaCaseStatus = {
  RECEIVED: "RECEIVED",
  INCOMPLETE: "INCOMPLETE",
  UNDER_REVIEW: "UNDER_REVIEW",
  REJECTED: "REJECTED",
  ACCEPTED: "ACCEPTED",
  CONTENT_REMOVED: "CONTENT_REMOVED",
  UPLOADER_NOTIFIED: "UPLOADER_NOTIFIED",
  COUNTER_NOTICE_RECEIVED: "COUNTER_NOTICE_RECEIVED",
  COUNTER_NOTICE_INCOMPLETE: "COUNTER_NOTICE_INCOMPLETE",
  COUNTER_NOTICE_ACCEPTED: "COUNTER_NOTICE_ACCEPTED",
  CLAIMANT_NOTIFIED_OF_COUNTER: "CLAIMANT_NOTIFIED_OF_COUNTER",
  WAITING_FOR_RESTORATION_WINDOW: "WAITING_FOR_RESTORATION_WINDOW",
  RESTORATION_ELIGIBLE: "RESTORATION_ELIGIBLE",
  RESTORED: "RESTORED",
  COURT_ACTION_RECEIVED: "COURT_ACTION_RECEIVED",
  CLOSED: "CLOSED",
} as const;

export type DmcaCaseStatus = typeof DmcaCaseStatus[keyof typeof DmcaCaseStatus];

const S = DmcaCaseStatus;

/** States in which the targeted content is (or should be) hidden. */
export const CONTENT_HIDDEN_STATES: ReadonlySet<DmcaCaseStatus> = new Set([
  S.CONTENT_REMOVED,
  S.UPLOADER_NOTIFIED,
  S.COUNTER_NOTICE_RECEIVED,
  S.COUNTER_NOTICE_INCOMPLETE,
  S.COUNTER_NOTICE_ACCEPTED,
  S.CLAIMANT_NOTIFIED_OF_COUNTER,
  S.WAITING_FOR_RESTORATION_WINDOW,
  S.RESTORATION_ELIGIBLE,
  S.COURT_ACTION_RECEIVED,
]);

/** Court action may interrupt any post-takedown state before restoration. */
const COURT_ACTION_FROM: DmcaCaseStatus[] = [
  S.CONTENT_REMOVED,
  S.UPLOADER_NOTIFIED,
  S.COUNTER_NOTICE_RECEIVED,
  S.COUNTER_NOTICE_INCOMPLETE,
  S.COUNTER_NOTICE_ACCEPTED,
  S.CLAIMANT_NOTIFIED_OF_COUNTER,
  S.WAITING_FOR_RESTORATION_WINDOW,
  S.RESTORATION_ELIGIBLE,
];

export const DMCA_TRANSITIONS: Readonly<Record<DmcaCaseStatus, readonly DmcaCaseStatus[]>> = {
  [S.RECEIVED]: [S.UNDER_REVIEW, S.INCOMPLETE, S.REJECTED],
  [S.INCOMPLETE]: [S.UNDER_REVIEW, S.REJECTED, S.CLOSED],
  [S.UNDER_REVIEW]: [S.INCOMPLETE, S.REJECTED, S.ACCEPTED],
  [S.REJECTED]: [S.CLOSED],
  [S.ACCEPTED]: [S.CONTENT_REMOVED, S.REJECTED],
  // RESTORED from CONTENT_REMOVED / UPLOADER_NOTIFIED covers a claimant
  // withdrawing the notice or an admin reversing an erroneous takedown.
  [S.CONTENT_REMOVED]: [S.UPLOADER_NOTIFIED, S.COURT_ACTION_RECEIVED, S.RESTORED],
  [S.UPLOADER_NOTIFIED]: [S.COUNTER_NOTICE_RECEIVED, S.COURT_ACTION_RECEIVED, S.RESTORED, S.CLOSED],
  [S.COUNTER_NOTICE_RECEIVED]: [S.COUNTER_NOTICE_INCOMPLETE, S.COUNTER_NOTICE_ACCEPTED, S.COURT_ACTION_RECEIVED],
  [S.COUNTER_NOTICE_INCOMPLETE]: [S.COUNTER_NOTICE_RECEIVED, S.COURT_ACTION_RECEIVED, S.CLOSED],
  [S.COUNTER_NOTICE_ACCEPTED]: [S.CLAIMANT_NOTIFIED_OF_COUNTER, S.COURT_ACTION_RECEIVED],
  [S.CLAIMANT_NOTIFIED_OF_COUNTER]: [S.WAITING_FOR_RESTORATION_WINDOW, S.COURT_ACTION_RECEIVED],
  [S.WAITING_FOR_RESTORATION_WINDOW]: [S.RESTORATION_ELIGIBLE, S.COURT_ACTION_RECEIVED],
  [S.RESTORATION_ELIGIBLE]: [S.RESTORED, S.COURT_ACTION_RECEIVED],
  [S.RESTORED]: [S.CLOSED],
  [S.COURT_ACTION_RECEIVED]: [S.CLOSED],
  [S.CLOSED]: [],
};

// Sanity: every COURT_ACTION_FROM state lists COURT_ACTION_RECEIVED.
for (const from of COURT_ACTION_FROM) {
  if (!DMCA_TRANSITIONS[from].includes(S.COURT_ACTION_RECEIVED)) {
    throw new Error(`DMCA state machine misconfigured: ${from} must allow COURT_ACTION_RECEIVED`);
  }
}

export class InvalidDmcaTransitionError extends Error {
  override readonly name = "InvalidDmcaTransitionError";
  readonly statusCode = 409;
  constructor(readonly from: string, readonly to: string) {
    super(`DMCA case cannot move from ${from} to ${to}`);
  }
}

export function isDmcaStatus(value: unknown): value is DmcaCaseStatus {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(DMCA_TRANSITIONS, value);
}

export function canTransition(from: string, to: string): boolean {
  if (!isDmcaStatus(from) || !isDmcaStatus(to)) return false;
  return DMCA_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) throw new InvalidDmcaTransitionError(from, to);
}
