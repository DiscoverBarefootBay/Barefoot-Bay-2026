/**
 * Weekly "Currently, On The Market" email scheduler.
 *
 * Mirrors the calendar email scheduler pattern: one minute-cadence interval is
 * self-started at boot from index.ts, and each tick checks the admin-configured
 * schedule (site_settings JSON) against the current Eastern time. Idempotency
 * is guaranteed by the `weekly_listings_email_sends` table: one row per
 * campaign, keyed by the unique week_start, claimed atomically via
 * INSERT ... ON CONFLICT DO NOTHING. Because the campaign window is a ROLLING
 * 7 days ending "today" (ET), the week_start shifts daily — so on top of the
 * exact-key claim, any campaign whose window OVERLAPS the requested one and
 * that reached a terminal status blocks a new send. That keeps the "at most
 * one campaign per weekly cycle" guarantee even when a manual send happens on
 * a different day than the scheduled one. A failed attempt leaves its row in
 * status "failed" so the next tick (within the grace window) or a manual
 * trigger can retry — but a campaign that reached "sent", "partially_failed",
 * or "skipped_no_listings" can never send again while its window overlaps.
 */

import { eq, and, desc, inArray, gte, lte } from 'drizzle-orm';
import { publicOnly } from "./dmca/content-visibility";
import { db } from './db';
import {
  weeklyListingsEmailSends,
  weeklyListingsEmailActivity,
  type WeeklyListingsEmailSend,
  type WeeklyListingsEmailActivity,
} from '@workspace/db';
import { storage } from './storage';
import { logger } from './lib/logger';
import { formatInTimeZone } from 'date-fns-tz';
import { sendEmail } from './sendgrid-service';
import {
  EASTERN_TZ,
  getCampaignWeekRange,
  loadWeeklyListingsEmailConfig,
  renderWeeklyListingsEmail,
  resolveWeeklyEmailRecipients,
  selectListingsForWeek,
  type WeeklyListingsEmailConfig,
  type WeeklyEmailListing,
  type WeekRange,
} from './weekly-listings-email';
import { isWeeklyListingsEmailSendingEnabled } from './scheduler-email-gate';
import { isFeaturedListingsEnabled } from './featured-listings-flag';

const CHECK_INTERVAL_MS = 60 * 1000; // evaluate once a minute
const BOOT_DELAY_MS = 45 * 1000;
// After the configured send time, keep retrying failed sends for this long.
const CATCHUP_GRACE_MINUTES = 180;

let started = false;
let ticking = false;

export function getWeeklyEmailBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.APP_BASE_URL || 'https://barefootbay.com';
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
}

// ---------------------------------------------------------------------------
// Campaign record helpers (idempotency)
// ---------------------------------------------------------------------------

export const TERMINAL_SEND_STATUSES = new Set(['sent', 'partially_failed', 'skipped_no_listings']);

/**
 * The schedule identity a campaign was sent under: "<sendDay>@<HH:mm>".
 * The overlap rule only treats a prior terminal campaign as blocking when it
 * was sent under the SAME schedule — an admin schedule change is an explicit
 * request for the next configured send to go out even in an overlapping week.
 */
export function computeScheduleKey(config: Pick<WeeklyListingsEmailConfig, 'sendDay' | 'sendTime'>): string {
  return `${config.sendDay}@${config.sendTime}`;
}

// ---------------------------------------------------------------------------
// Admin-visible activity log
// ---------------------------------------------------------------------------

export type WeeklyEmailActivityEvent =
  | 'sent'
  | 'partially_failed'
  | 'failed'
  | 'skipped_no_listings'
  | 'skipped_already_sent'
  | 'skipped_window_missed'
  | 'test_sent'
  | 'schedule_changed';

// In-memory guard so per-minute ticks don't hammer the DB re-checking whether
// a dedupe-once event was already logged this process lifetime.
const loggedActivityKeys = new Set<string>();

/**
 * Record an admin-visible activity entry. Never throws — a logging failure
 * must not break a send. `dedupeOnce` collapses per-tick repeats (e.g. the
 * scheduler evaluating a skipped window once a minute) into a single row per
 * (event, weekStart).
 */
export async function logWeeklyEmailActivity(entry: {
  event: WeeklyEmailActivityEvent;
  weekStart?: string | null;
  weekEnd?: string | null;
  detail?: string | null;
  actor?: string | null;
  dedupeOnce?: boolean;
}): Promise<void> {
  try {
    const values = {
      event: entry.event,
      weekStart: entry.weekStart ?? null,
      weekEnd: entry.weekEnd ?? null,
      detail: entry.detail ?? null,
      actor: entry.actor ?? null,
    };
    if (entry.dedupeOnce && entry.weekStart) {
      // Durable dedupe: a partial unique index on (event, week_start) for the
      // dedupe-once events (see lib/db/sql/2026-08-01-weekly-email-activity.sql)
      // makes concurrent/restarted inserts collapse via ON CONFLICT DO NOTHING.
      // The in-memory set is just a fast path to skip the DB round-trip on
      // subsequent per-minute ticks.
      const key = `${entry.event}:${entry.weekStart}`;
      if (loggedActivityKeys.has(key)) return;
      await db.insert(weeklyListingsEmailActivity).values(values).onConflictDoNothing();
      loggedActivityKeys.add(key);
      return;
    }
    await db.insert(weeklyListingsEmailActivity).values(values);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), event: entry.event },
      '[WeeklyListingsEmail] Failed to record activity entry',
    );
  }
}

export async function getWeeklyEmailActivity(limit = 50): Promise<WeeklyListingsEmailActivity[]> {
  return db
    .select()
    .from(weeklyListingsEmailActivity)
    .orderBy(desc(weeklyListingsEmailActivity.createdAt), desc(weeklyListingsEmailActivity.id))
    .limit(limit);
}

/**
 * Compute the next scheduled automatic send as an ET-labelled string, or null
 * when the automation is disabled. Used by the admin tab.
 */
export function getNextScheduledSend(
  config: WeeklyListingsEmailConfig,
  now: Date = new Date(),
): { dateEt: string; time: string; label: string } | null {
  if (!config.enabled) return null;
  const todayEt = formatInTimeZone(now, EASTERN_TZ, 'yyyy-MM-dd');
  const nowHHMM = formatInTimeZone(now, EASTERN_TZ, 'HH:mm');
  const dowEt = Number(formatInTimeZone(now, EASTERN_TZ, 'i')) % 7; // 0 = Sunday
  let daysAhead = (config.sendDay - dowEt + 7) % 7;
  if (daysAhead === 0 && nowHHMM >= config.sendTime) daysAhead = 7;
  const [y, m, d] = todayEt.split('-').map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d!, 12));
  next.setUTCDate(next.getUTCDate() + daysAhead);
  const dateEt = next.toISOString().slice(0, 10);
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    next.getUTCDay()
  ];
  const monthName = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][next.getUTCMonth()];
  return {
    dateEt,
    time: config.sendTime,
    label: `${dayName}, ${monthName} ${next.getUTCDate()}, ${next.getUTCFullYear()} at ${config.sendTime} ET`,
  };
}

/**
 * If the NEXT scheduled automatic send would be skipped because an
 * overlapping campaign already went out under the current schedule, return
 * that blocking campaign so the admin UI can say so up front. Returns null
 * when the next send is expected to fire normally (or automation is off).
 */
export async function getNextSendBlocker(
  config: WeeklyListingsEmailConfig,
  now: Date = new Date(),
): Promise<WeeklyListingsEmailSend | null> {
  const next = getNextScheduledSend(config, now);
  if (!next) return null;
  // The campaign window for that send: the 7 calendar days ending on the
  // send date (ET). Pure date arithmetic — no timezone conversion needed.
  const [y, m, d] = next.dateEt.split('-').map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, d!, 12));
  start.setUTCDate(start.getUTCDate() - 6);
  const range = { weekStart: start.toISOString().slice(0, 10), weekEnd: next.dateEt };
  const blocker = await getOverlappingBlockingSend(range, computeScheduleKey(config));
  return blocker ?? null;
}

export async function getWeeklySendHistory(limit = 26): Promise<WeeklyListingsEmailSend[]> {
  return db
    .select()
    .from(weeklyListingsEmailSends)
    .orderBy(desc(weeklyListingsEmailSends.weekStart))
    .limit(limit);
}

export async function getWeeklySendForWeek(
  weekStart: string,
): Promise<WeeklyListingsEmailSend | undefined> {
  const rows = await db
    .select()
    .from(weeklyListingsEmailSends)
    .where(eq(weeklyListingsEmailSends.weekStart, weekStart))
    .limit(1);
  return rows[0];
}

// Statuses that block a new overlapping campaign: terminal outcomes (the
// cycle already went out) plus "sending" (another instance is mid-send for an
// overlapping window — possibly claimed under a different week_start on
// another day). Only "failed" rows are non-blocking, so retries stay possible.
const BLOCKING_SEND_STATUSES = [...TERMINAL_SEND_STATUSES, 'sending'];

/**
 * Find a campaign whose 7-day window overlaps the given range and whose
 * status blocks a new send. With a rolling window, an overlapping terminal
 * campaign means "this cycle already went out" — a new send would re-feature
 * listings already covered — and an overlapping "sending" row means another
 * instance is currently sending this cycle (even if it claimed a different
 * week_start on an earlier day). Only "failed" rows don't count here.
 *
 * When `currentScheduleKey` is provided, a TERMINAL overlapping campaign only
 * blocks when it was sent under the same schedule (or under an unknown/legacy
 * NULL schedule — treated as blocking for safety). An admin who changes the
 * send day/time explicitly wants the next configured send to go out even in
 * an overlapping week. "sending" rows always block regardless of schedule —
 * two concurrent sends must never race.
 */
export async function getOverlappingBlockingSend(
  range: Pick<WeekRange, 'weekStart' | 'weekEnd'>,
  currentScheduleKey?: string,
): Promise<WeeklyListingsEmailSend | undefined> {
  const rows = await db
    .select()
    .from(weeklyListingsEmailSends)
    .where(
      and(
        lte(weeklyListingsEmailSends.weekStart, range.weekEnd),
        gte(weeklyListingsEmailSends.weekEnd, range.weekStart),
        inArray(weeklyListingsEmailSends.status, BLOCKING_SEND_STATUSES),
      ),
    )
    .orderBy(desc(weeklyListingsEmailSends.weekStart));
  if (!currentScheduleKey) return rows[0];
  return rows.find(
    (row) =>
      row.status === 'sending' ||
      row.scheduleKey == null ||
      row.scheduleKey === currentScheduleKey,
  );
}

/**
 * Atomically claim a campaign week for sending. Returns the claimed row, or
 * null when the week is already terminal (sent/skipped) or another instance is
 * currently sending it. A prior "failed" attempt may be re-claimed.
 */
export async function claimWeeklySend(
  range: Pick<WeekRange, 'weekStart' | 'weekEnd'>,
  triggeredBy: 'scheduler' | 'manual',
  triggeredByUser?: string | null,
  scheduleKey?: string | null,
): Promise<WeeklyListingsEmailSend | null> {
  // Fresh claim: only succeeds for the first instance to insert this week.
  const inserted = await db
    .insert(weeklyListingsEmailSends)
    .values({
      weekStart: range.weekStart,
      weekEnd: range.weekEnd,
      status: 'sending',
      triggeredBy,
      triggeredByUser: triggeredByUser ?? null,
      scheduleKey: scheduleKey ?? null,
    })
    .onConflictDoNothing({ target: weeklyListingsEmailSends.weekStart })
    .returning();
  if (inserted[0]) return inserted[0];

  // Row exists. Re-claim is allowed ONLY from "failed" (retry path) — a CAS
  // update so concurrent retriers can't both win.
  const reclaimed = await db
    .update(weeklyListingsEmailSends)
    .set({
      status: 'sending',
      triggeredBy,
      triggeredByUser: triggeredByUser ?? null,
      scheduleKey: scheduleKey ?? null,
      error: null,
    })
    .where(
      and(
        eq(weeklyListingsEmailSends.weekStart, range.weekStart),
        inArray(weeklyListingsEmailSends.status, ['failed']),
      ),
    )
    .returning();
  return reclaimed[0] ?? null;
}

export async function finalizeWeeklySend(
  id: number,
  update: {
    status: 'sent' | 'partially_failed' | 'failed' | 'skipped_no_listings';
    listingCount: number;
    recipientCount: number;
    sentCount: number;
    error?: string | null;
  },
): Promise<void> {
  await db
    .update(weeklyListingsEmailSends)
    .set({
      status: update.status,
      listingCount: update.listingCount,
      recipientCount: update.recipientCount,
      sentCount: update.sentCount,
      error: update.error ?? null,
      sentAt: update.status === 'sent' || update.status === 'partially_failed' ? new Date() : null,
    })
    .where(eq(weeklyListingsEmailSends.id, id));
}

// ---------------------------------------------------------------------------
// Send execution (shared by scheduler tick and manual admin trigger)
// ---------------------------------------------------------------------------

export interface WeeklySendDeps {
  getListings: () => Promise<any[]>;
  getUsers: () => Promise<any[]>;
  sendEmail: typeof sendEmail;
  claimWeeklySend: typeof claimWeeklySend;
  finalizeWeeklySend: typeof finalizeWeeklySend;
  getWeeklySendForWeek: typeof getWeeklySendForWeek;
  getOverlappingBlockingSend: typeof getOverlappingBlockingSend;
  // Optional so pre-existing test harnesses keep working; production callers
  // get the real logger via defaultWeeklySendDeps(). Never throws.
  logActivity?: typeof logWeeklyEmailActivity;
  baseUrl?: string;
}

export function defaultWeeklySendDeps(): WeeklySendDeps {
  return {
    // DMCA/moderation: hidden listings are never emailed.
    getListings: async () => publicOnly(await storage.getListings()),
    getUsers: () => storage.getUsers(),
    sendEmail,
    claimWeeklySend,
    finalizeWeeklySend,
    getWeeklySendForWeek,
    getOverlappingBlockingSend,
    logActivity: logWeeklyEmailActivity,
    baseUrl: getWeeklyEmailBaseUrl(),
  };
}

export interface WeeklySendResult {
  status: 'sent' | 'partially_failed' | 'failed' | 'skipped_no_listings' | 'already_sent' | 'claim_lost';
  listingCount: number;
  recipientCount: number;
  sentCount: number;
  weekStart: string;
  weekEnd: string;
  label: string;
  error?: string;
}

// Serializes all campaign sends within this process so the overlap-check →
// claim sequence can't race between the scheduler tick and a manual admin
// send (the claim's unique key is week_start, which doesn't cover two
// DIFFERENT overlapping week windows). The app runs as a single server
// process, so an in-process mutex closes the realistic race window.
let sendChain: Promise<unknown> = Promise.resolve();
function withSendLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = sendChain.then(fn, fn);
  sendChain = run.catch(() => {});
  return run;
}

/**
 * Execute a campaign send for the given week: claim → select listings →
 * resolve recipients → render → send per recipient → finalize the record.
 * Never sends twice for a week that already reached a terminal status.
 * Sends are serialized process-wide (see withSendLock).
 */
export function executeWeeklySend(
  range: WeekRange,
  config: WeeklyListingsEmailConfig,
  triggeredBy: 'scheduler' | 'manual',
  deps: WeeklySendDeps = defaultWeeklySendDeps(),
  now: Date = new Date(),
  triggeredByUser?: string | null,
): Promise<WeeklySendResult> {
  return withSendLock(() => executeWeeklySendInner(range, config, triggeredBy, deps, now, triggeredByUser));
}

async function executeWeeklySendInner(
  range: WeekRange,
  config: WeeklyListingsEmailConfig,
  triggeredBy: 'scheduler' | 'manual',
  deps: WeeklySendDeps,
  now: Date,
  triggeredByUser?: string | null,
): Promise<WeeklySendResult> {
  const base = { weekStart: range.weekStart, weekEnd: range.weekEnd, label: range.label };
  const scheduleKey = computeScheduleKey(config);
  const logActivity = deps.logActivity ?? (async () => {});

  // Fast path: a blocking campaign whose rolling window overlaps this one
  // means the current weekly cycle already went out (terminal) or is being
  // sent right now by another instance ("sending") — never send twice. A
  // terminal campaign sent under a DIFFERENT schedule does not block: the
  // admin changed the schedule and expects the configured send to go out.
  const existing = await deps.getOverlappingBlockingSend(range, scheduleKey);
  if (existing) {
    if (existing.status === 'sending') {
      return { ...base, status: 'claim_lost', listingCount: 0, recipientCount: 0, sentCount: 0 };
    }
    await logActivity({
      event: 'skipped_already_sent',
      weekStart: range.weekStart,
      weekEnd: range.weekEnd,
      detail: `Skipped — a campaign covering ${existing.weekStart} – ${existing.weekEnd} already went out under the current schedule (${existing.sentCount} of ${existing.recipientCount} delivered).`,
      actor: triggeredByUser ?? null,
      dedupeOnce: triggeredBy === 'scheduler',
    });
    return {
      ...base,
      status: 'already_sent',
      listingCount: existing.listingCount,
      recipientCount: existing.recipientCount,
      sentCount: existing.sentCount,
    };
  }

  const claimed = await deps.claimWeeklySend(range, triggeredBy, triggeredByUser ?? null, scheduleKey);
  if (!claimed) {
    return { ...base, status: 'claim_lost', listingCount: 0, recipientCount: 0, sentCount: 0 };
  }

  try {
    const allListings = await deps.getListings();
    const listings: WeeklyEmailListing[] = selectListingsForWeek(allListings, range, now);

    if (listings.length === 0 && !config.sendWhenEmpty) {
      await deps.finalizeWeeklySend(claimed.id, {
        status: 'skipped_no_listings',
        listingCount: 0,
        recipientCount: 0,
        sentCount: 0,
      });
      logger.info(
        { weekStart: range.weekStart },
        '[WeeklyListingsEmail] No active listings — campaign skipped',
      );
      await logActivity({
        event: 'skipped_no_listings',
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        detail: 'Skipped — no active listings this week and "send even when empty" is off.',
        actor: triggeredByUser ?? null,
      });
      return { ...base, status: 'skipped_no_listings', listingCount: 0, recipientCount: 0, sentCount: 0 };
    }

    const allUsers = await deps.getUsers();
    const recipients = resolveWeeklyEmailRecipients(allUsers);

    if (recipients.length === 0) {
      const error = 'No eligible marketing-opt-in recipients';
      await deps.finalizeWeeklySend(claimed.id, {
        status: 'failed',
        listingCount: listings.length,
        recipientCount: 0,
        sentCount: 0,
        error,
      });
      await logActivity({
        event: 'failed',
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        detail: `Failed — ${error}.`,
        actor: triggeredByUser ?? null,
      });
      return { ...base, status: 'failed', listingCount: listings.length, recipientCount: 0, sentCount: 0, error };
    }

    const rendered = renderWeeklyListingsEmail(
      listings,
      range,
      deps.baseUrl ?? getWeeklyEmailBaseUrl(),
      config.template,
      { featuredEnabled: await isFeaturedListingsEnabled() },
    );

    let sentCount = 0;
    for (const email of recipients) {
      // sendEmail resolves false rather than throwing — check the boolean.
      const ok = await deps.sendEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      if (ok) sentCount++;
      else logger.warn({ email }, '[WeeklyListingsEmail] Send returned false for recipient');
    }

    if (sentCount === 0) {
      const error = `All ${recipients.length} sends failed`;
      await deps.finalizeWeeklySend(claimed.id, {
        status: 'failed',
        listingCount: listings.length,
        recipientCount: recipients.length,
        sentCount: 0,
        error,
      });
      await logActivity({
        event: 'failed',
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        detail: `Failed — ${error}. The scheduler will retry within the grace window; the campaign can also be sent manually.`,
        actor: triggeredByUser ?? null,
      });
      return {
        ...base,
        status: 'failed',
        listingCount: listings.length,
        recipientCount: recipients.length,
        sentCount: 0,
        error,
      };
    }

    // Partial failure is terminal (retrying would double-send the successes)
    // but recorded distinctly so admins can see the failed-recipient count.
    const failedCount = recipients.length - sentCount;
    const finalStatus: 'sent' | 'partially_failed' = failedCount > 0 ? 'partially_failed' : 'sent';
    const partialError =
      failedCount > 0 ? `${failedCount} of ${recipients.length} sends failed` : null;
    await deps.finalizeWeeklySend(claimed.id, {
      status: finalStatus,
      listingCount: listings.length,
      recipientCount: recipients.length,
      sentCount,
      error: partialError,
    });
    logger.info(
      { weekStart: range.weekStart, listings: listings.length, recipients: recipients.length, sentCount, failedCount },
      '[WeeklyListingsEmail] Weekly campaign sent',
    );
    await logActivity({
      event: finalStatus,
      weekStart: range.weekStart,
      weekEnd: range.weekEnd,
      detail:
        finalStatus === 'sent'
          ? `Sent to ${sentCount} recipient(s), covering ${listings.length} listing(s)${triggeredBy === 'manual' ? ' (manual send)' : ''}.`
          : `Sent to ${sentCount} of ${recipients.length} recipient(s) — ${failedCount} failed. Covering ${listings.length} listing(s)${triggeredBy === 'manual' ? ' (manual send)' : ''}.`,
      actor: triggeredByUser ?? null,
    });
    return {
      ...base,
      status: finalStatus,
      listingCount: listings.length,
      recipientCount: recipients.length,
      sentCount,
      ...(partialError ? { error: partialError } : {}),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ err: error, weekStart: range.weekStart }, '[WeeklyListingsEmail] Campaign send threw');
    try {
      await deps.finalizeWeeklySend(claimed.id, {
        status: 'failed',
        listingCount: 0,
        recipientCount: 0,
        sentCount: 0,
        error,
      });
    } catch (finalizeErr) {
      logger.error({ err: finalizeErr }, '[WeeklyListingsEmail] Failed to record failed send');
    }
    await logActivity({
      event: 'failed',
      weekStart: range.weekStart,
      weekEnd: range.weekEnd,
      detail: `Failed — ${error}.`,
      actor: triggeredByUser ?? null,
    });
    return { ...base, status: 'failed', listingCount: 0, recipientCount: 0, sentCount: 0, error };
  }
}

// ---------------------------------------------------------------------------
// Scheduler tick
// ---------------------------------------------------------------------------

export interface WeeklySchedulerDeps extends WeeklySendDeps {
  loadConfig: () => Promise<WeeklyListingsEmailConfig>;
  // Environment gate — must return true for the scheduled tick to send ANY
  // email. Defaults to the real production check (NODE_ENV=production or
  // REPLIT_DEPLOYMENT=true, with WEEKLY_LISTINGS_SCHEDULER_DEV_SENDING=true as
  // an explicit dev opt-in). Optional so pre-existing test harnesses that
  // exercise the timing logic keep working — when omitted, sending is treated
  // as allowed, but every production caller goes through
  // defaultWeeklySchedulerDeps() which always wires the real check.
  isEmailSendingEnabled?: () => boolean;
}

export function defaultWeeklySchedulerDeps(): WeeklySchedulerDeps {
  return {
    ...defaultWeeklySendDeps(),
    loadConfig: loadWeeklyListingsEmailConfig,
    isEmailSendingEnabled: () => isWeeklyListingsEmailSendingEnabled(),
  };
}

/**
 * Evaluate the weekly schedule once and send when due. Due means: automation
 * enabled, today's ET day-of-week matches the configured send day, current ET
 * time is at/after the configured send time but within the grace window, and
 * this campaign week has not already reached a terminal status.
 */
export async function runWeeklyListingsEmailTick(
  now: Date = new Date(),
  deps: WeeklySchedulerDeps = defaultWeeklySchedulerDeps(),
): Promise<WeeklySendResult | null> {
  if (ticking) return null;
  ticking = true;
  try {
    // Environment gate: the dev workspace runs this same scheduler with the
    // real SendGrid key against a stale dev DB — never let it email real users.
    if (deps.isEmailSendingEnabled && !deps.isEmailSendingEnabled()) {
      logger.info(
        '[WeeklyListingsEmail] Sending is disabled in this environment (not deployed production; set WEEKLY_LISTINGS_SCHEDULER_DEV_SENDING=true to opt in) — tick skipped',
      );
      return null;
    }
    const config = await deps.loadConfig();
    if (!config.enabled) return null;

    const dowEt = Number(formatInTimeZone(now, EASTERN_TZ, 'i')) % 7; // 'i' = ISO day 1–7 (Mon–Sun) → 0 = Sunday
    if (dowEt !== config.sendDay) return null;

    const nowHHMM = formatInTimeZone(now, EASTERN_TZ, 'HH:mm');
    if (nowHHMM < config.sendTime) return null;

    const scheduleKey = computeScheduleKey(config);
    const logActivity = deps.logActivity ?? (async () => {});

    // Past the catch-up grace window: don't fire a very late campaign. The
    // per-week record means the week simply stays unsent (visible in history
    // as absent/failed) and the admin can trigger it manually.
    const [sh, sm] = config.sendTime.split(':').map(Number);
    const [nh, nm] = nowHHMM.split(':').map(Number);
    const pastByMins = nh! * 60 + nm! - (sh! * 60 + sm!);
    if (pastByMins > CATCHUP_GRACE_MINUTES) {
      // Record the miss (once) so admins can see WHY nothing arrived — but
      // only when this cycle genuinely never went out under this schedule.
      const range = getCampaignWeekRange(now);
      const covered = await deps.getOverlappingBlockingSend(range, scheduleKey);
      if (!covered) {
        await logActivity({
          event: 'skipped_window_missed',
          weekStart: range.weekStart,
          weekEnd: range.weekEnd,
          detail: `No campaign went out during the scheduled ${config.sendTime} ET send window (the server may have been offline, the schedule may have been changed after the window, or a send attempt may have failed — check the entries above). Use "Send Campaign Now" to send it manually, or wait for the next scheduled send.`,
          dedupeOnce: true,
        });
      }
      return null;
    }

    const range = getCampaignWeekRange(now);

    // Cheap pre-checks to avoid claim churn every tick once the cycle is done:
    // an overlapping in-progress send, or a terminal campaign sent under the
    // SAME schedule, blocks the scheduled send. A terminal campaign from a
    // different (old) schedule does NOT block — the admin changed the
    // schedule and expects this send to fire (executeWeeklySend logs the
    // skip when it applies).
    const overlapping = await deps.getOverlappingBlockingSend(range, scheduleKey);
    if (overlapping) {
      await logActivity({
        event: 'skipped_already_sent',
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        detail: `Scheduled send skipped — a campaign covering ${overlapping.weekStart} – ${overlapping.weekEnd} already went out this cycle under the current schedule.`,
        dedupeOnce: true,
      });
      return null;
    }
    const existing = await deps.getWeeklySendForWeek(range.weekStart);
    if (existing && existing.status !== 'failed') {
      // "sending" means another instance is mid-send.
      return null;
    }

    return await executeWeeklySend(range, config, 'scheduler', deps, now);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      '[WeeklyListingsEmail] Scheduler tick failed',
    );
    return null;
  } finally {
    ticking = false;
  }
}

/**
 * Start the weekly listings email scheduler. Idempotent — one timer only.
 */
export function startWeeklyListingsEmailScheduler(): void {
  if (started) return;
  started = true;

  logger.info(
    { intervalMs: CHECK_INTERVAL_MS, bootDelayMs: BOOT_DELAY_MS },
    '[WeeklyListingsEmail] Starting weekly listings email scheduler',
  );

  setTimeout(() => {
    void runWeeklyListingsEmailTick();
  }, BOOT_DELAY_MS).unref?.();

  const timer = setInterval(() => {
    void runWeeklyListingsEmailTick();
  }, CHECK_INTERVAL_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}
