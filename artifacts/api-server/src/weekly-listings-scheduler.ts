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
import { db } from './db';
import { weeklyListingsEmailSends, type WeeklyListingsEmailSend } from '@workspace/db';
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
 */
export async function getOverlappingBlockingSend(
  range: Pick<WeekRange, 'weekStart' | 'weekEnd'>,
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
    .orderBy(desc(weeklyListingsEmailSends.weekStart))
    .limit(1);
  return rows[0];
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
    })
    .onConflictDoNothing({ target: weeklyListingsEmailSends.weekStart })
    .returning();
  if (inserted[0]) return inserted[0];

  // Row exists. Re-claim is allowed ONLY from "failed" (retry path) — a CAS
  // update so concurrent retriers can't both win.
  const reclaimed = await db
    .update(weeklyListingsEmailSends)
    .set({ status: 'sending', triggeredBy, triggeredByUser: triggeredByUser ?? null, error: null })
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
  baseUrl?: string;
}

export function defaultWeeklySendDeps(): WeeklySendDeps {
  return {
    getListings: () => storage.getListings(),
    getUsers: () => storage.getUsers(),
    sendEmail,
    claimWeeklySend,
    finalizeWeeklySend,
    getWeeklySendForWeek,
    getOverlappingBlockingSend,
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

/**
 * Execute a campaign send for the given week: claim → select listings →
 * resolve recipients → render → send per recipient → finalize the record.
 * Never sends twice for a week that already reached a terminal status.
 */
export async function executeWeeklySend(
  range: WeekRange,
  config: WeeklyListingsEmailConfig,
  triggeredBy: 'scheduler' | 'manual',
  deps: WeeklySendDeps = defaultWeeklySendDeps(),
  now: Date = new Date(),
  triggeredByUser?: string | null,
): Promise<WeeklySendResult> {
  const base = { weekStart: range.weekStart, weekEnd: range.weekEnd, label: range.label };

  // Fast path: a blocking campaign whose rolling window overlaps this one
  // means the current weekly cycle already went out (terminal) or is being
  // sent right now by another instance ("sending") — never send twice.
  const existing = await deps.getOverlappingBlockingSend(range);
  if (existing) {
    if (existing.status === 'sending') {
      return { ...base, status: 'claim_lost', listingCount: 0, recipientCount: 0, sentCount: 0 };
    }
    return {
      ...base,
      status: 'already_sent',
      listingCount: existing.listingCount,
      recipientCount: existing.recipientCount,
      sentCount: existing.sentCount,
    };
  }

  const claimed = await deps.claimWeeklySend(range, triggeredBy, triggeredByUser ?? null);
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
      return { ...base, status: 'failed', listingCount: listings.length, recipientCount: 0, sentCount: 0, error };
    }

    const rendered = renderWeeklyListingsEmail(
      listings,
      range,
      deps.baseUrl ?? getWeeklyEmailBaseUrl(),
      config.template,
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
    return { ...base, status: 'failed', listingCount: 0, recipientCount: 0, sentCount: 0, error };
  }
}

// ---------------------------------------------------------------------------
// Scheduler tick
// ---------------------------------------------------------------------------

export interface WeeklySchedulerDeps extends WeeklySendDeps {
  loadConfig: () => Promise<WeeklyListingsEmailConfig>;
}

export function defaultWeeklySchedulerDeps(): WeeklySchedulerDeps {
  return { ...defaultWeeklySendDeps(), loadConfig: loadWeeklyListingsEmailConfig };
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
    const config = await deps.loadConfig();
    if (!config.enabled) return null;

    const dowEt = Number(formatInTimeZone(now, EASTERN_TZ, 'i')) % 7; // 'i' = ISO day 1–7 (Mon–Sun) → 0 = Sunday
    if (dowEt !== config.sendDay) return null;

    const nowHHMM = formatInTimeZone(now, EASTERN_TZ, 'HH:mm');
    if (nowHHMM < config.sendTime) return null;

    // Past the catch-up grace window: don't fire a very late campaign. The
    // per-week record means the week simply stays unsent (visible in history
    // as absent/failed) and the admin can trigger it manually.
    const [sh, sm] = config.sendTime.split(':').map(Number);
    const [nh, nm] = nowHHMM.split(':').map(Number);
    const pastByMins = nh! * 60 + nm! - (sh! * 60 + sm!);
    if (pastByMins > CATCHUP_GRACE_MINUTES) return null;

    const range = getCampaignWeekRange(now);

    // Cheap pre-checks to avoid claim churn every tick once the cycle is done:
    // an overlapping terminal campaign (possibly sent manually on another day)
    // or an overlapping in-progress send blocks the scheduled send.
    const overlapping = await deps.getOverlappingBlockingSend(range);
    if (overlapping) return null;
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
