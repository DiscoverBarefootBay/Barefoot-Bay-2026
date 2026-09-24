/**
 * Notification outbox.
 *
 * DMCA operations never send email inline: they insert an outbox row in the
 * SAME transaction as the state change, so a takedown/restore is never rolled
 * back by an email failure and a notice is never "sent" for a change that
 * didn't commit. A boot-started dispatcher delivers due rows with
 * exponential-backoff retry, and gives up (status "dead") after max_attempts
 * so admins can see failures (admin UI is a later task).
 *
 * Dispatch is behind the shared scheduler email gate: only production sends,
 * unless DMCA_OUTBOX_DEV_SENDING=true in a dev workspace.
 */
import { sql } from "drizzle-orm";
import { notificationOutbox } from "@workspace/db";
import { db } from "../db";
import { logger } from "../lib/logger";
import { isSchedulerEmailSendingEnabled } from "../scheduler-email-gate";
import type { DbExecutor } from "./audit";

export const DMCA_OUTBOX_DEV_SENDING = "DMCA_OUTBOX_DEV_SENDING";

export interface OutboxEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EnqueueInput {
  eventType: string;
  email: OutboxEmail;
  dmcaCaseId?: number | null;
  /** Unique key — enqueueing the same key twice is a no-op. */
  dedupeKey?: string | null;
  data?: Record<string, unknown>;
  maxAttempts?: number;
}

export async function enqueueNotification(input: EnqueueInput, executor: DbExecutor = db): Promise<number | null> {
  const rows = await executor
    .insert(notificationOutbox)
    .values({
      eventType: input.eventType,
      payload: { email: input.email, data: input.data ?? {} } as any,
      dmcaCaseId: input.dmcaCaseId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      maxAttempts: input.maxAttempts ?? 8,
    })
    .onConflictDoNothing({ target: notificationOutbox.dedupeKey })
    .returning({ id: notificationOutbox.id });
  return rows[0]?.id ?? null;
}

/** Backoff: 1, 2, 4, 8 … minutes, capped at 6 hours. */
export function nextRetryDelayMs(attempts: number): number {
  const minutes = Math.min(2 ** Math.max(0, attempts - 1), 360);
  return minutes * 60_000;
}

export type OutboxSender = (email: OutboxEmail) => Promise<boolean>;

async function defaultSender(email: OutboxEmail): Promise<boolean> {
  const { sendEmail } = await import("../sendgrid-service");
  return sendEmail({ to: email.to, subject: email.subject, text: email.text, html: email.html });
}

export interface DispatchResult {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  skippedByGate: boolean;
}

/**
 * Deliver due outbox rows once. Rows are claimed with FOR UPDATE SKIP LOCKED
 * so concurrent dispatchers (e.g. two deploy instances) never double-send.
 * Rows stuck in "processing" for 15+ minutes (crashed mid-send) are reclaimed.
 */
export async function dispatchOutboxOnce(
  opts: { sender?: OutboxSender; batchSize?: number; env?: Record<string, string | undefined>; onlyIds?: number[] } = {},
): Promise<DispatchResult> {
  const result: DispatchResult = { claimed: 0, sent: 0, failed: 0, dead: 0, skippedByGate: false };
  if (!isSchedulerEmailSendingEnabled(DMCA_OUTBOX_DEV_SENDING, opts.env ?? process.env)) {
    result.skippedByGate = true;
    return result;
  }
  const sender = opts.sender ?? defaultSender;
  const batchSize = opts.batchSize ?? 25;
  const onlyIds = opts.onlyIds && opts.onlyIds.length ? opts.onlyIds : null;
  const onlyIdsArray = onlyIds
    ? sql`ARRAY[${sql.join(onlyIds.map((id) => sql`${id}`), sql`, `)}]::int[]`
    : null;

  const claimed = await db.execute(sql`
    UPDATE notification_outbox SET status = 'processing', attempts = attempts + 1, next_attempt_at = now()
    WHERE id IN (
      SELECT id FROM notification_outbox
      WHERE (
        (status IN ('pending', 'failed') AND next_attempt_at <= now())
        OR (status = 'processing' AND next_attempt_at <= now() - interval '15 minutes')
      )
      ${onlyIdsArray ? sql`AND id = ANY(${onlyIdsArray})` : sql``}
      ORDER BY next_attempt_at
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, event_type, payload, attempts, max_attempts`);

  for (const row of claimed.rows as any[]) {
    result.claimed++;
    const email: OutboxEmail | undefined = row.payload?.email;
    let ok = false;
    let error: string | null = null;
    try {
      if (!email?.to || !email.subject) throw new Error("outbox row has no deliverable email payload");
      ok = await sender(email);
      if (!ok) error = "sender returned false";
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    if (ok) {
      await db.execute(sql`UPDATE notification_outbox SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = ${row.id}`);
      result.sent++;
      await runOnSentHook(row).catch((err) => logger.error({ err, outboxId: row.id }, "[DmcaOutbox] onSent hook failed"));
      continue;
    }
    const attempts = Number(row.attempts);
    if (attempts >= Number(row.max_attempts)) {
      await db.execute(sql`UPDATE notification_outbox SET status = 'dead', last_error = ${error} WHERE id = ${row.id}`);
      result.dead++;
      logger.error({ outboxId: row.id, eventType: row.event_type, error }, "[DmcaOutbox] Giving up on notification");
    } else {
      const next = new Date(Date.now() + nextRetryDelayMs(attempts));
      await db.execute(sql`UPDATE notification_outbox SET status = 'failed', last_error = ${error}, next_attempt_at = ${next} WHERE id = ${row.id}`);
      result.failed++;
      logger.warn({ outboxId: row.id, eventType: row.event_type, attempts, error }, "[DmcaOutbox] Notification failed; will retry");
    }
  }
  return result;
}

/** Post-delivery side effects (e.g. the case records "uploader notified" only once the notice was actually delivered). */
async function runOnSentHook(row: any): Promise<void> {
  const hook = row.payload?.data?.onSent;
  if (hook === "mark_uploader_notified") {
    const caseId = Number(row.payload?.data?.caseId);
    if (!Number.isInteger(caseId)) return;
    const { markUploaderNotified } = await import("./dmca-service");
    await markUploaderNotified(caseId);
  }
}

const CHECK_INTERVAL_MS = 60_000;
const BOOT_DELAY_MS = 20_000;
let started = false;
let running = false;
let loggedGateSkip = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const r = await dispatchOutboxOnce();
    if (r.skippedByGate) {
      if (!loggedGateSkip) {
        loggedGateSkip = true;
        logger.info(`[DmcaOutbox] Email sending disabled in this environment (set ${DMCA_OUTBOX_DEV_SENDING}=true to test); rows stay queued`);
      }
    } else if (r.claimed > 0) {
      logger.info(r, "[DmcaOutbox] Dispatch tick");
    }
  } catch (err) {
    logger.error({ err }, "[DmcaOutbox] Dispatch tick failed");
  } finally {
    running = false;
  }
}

export function startNotificationOutboxDispatcher(): void {
  if (started) return;
  started = true;
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "[DmcaOutbox] Starting notification outbox dispatcher");
  setTimeout(() => void tick(), BOOT_DELAY_MS).unref?.();
  const timer = setInterval(() => void tick(), CHECK_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
}
