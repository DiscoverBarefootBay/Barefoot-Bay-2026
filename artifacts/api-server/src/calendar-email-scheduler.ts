/**
 * Automatic Calendar Email Scheduler
 *
 * Fires the daily "tomorrow's events" calendar email at the admin-configured
 * time, once per day, without any manual trigger. This is the background timer
 * that the admin "Automatic Schedule" panel was always meant to drive — the
 * panel persists config to the `calendar_email_schedule` table, but until now
 * nothing read that table on a timer so the emails never auto-sent.
 *
 * Design notes:
 *  - A single recurring interval (once a minute) is started once at boot.
 *  - On each tick, if the schedule is enabled and the current Florida/Eastern
 *    time has reached the configured `sendTime`, and we have not already fired
 *    today (tracked via `lastSentAt`), we send.
 *  - `lastSentAt` is the once-per-day guard. Because it is persisted in the DB,
 *    the schedule survives server restarts without double-sending: after a
 *    restart on the same day, the stored `lastSentAt` still blocks a re-fire.
 *  - It also gives catch-up behaviour: if the server was down at `sendTime`
 *    and comes back later the same day, the next tick still fires the send.
 *  - The actual send reuses the exact same path as the manual admin endpoints
 *    (sendCalendarEventNotificationEmail) and the same event selection as the
 *    POST /api/admin/send-calendar-events/day endpoint, so manual behaviour is
 *    unchanged and the automatic send matches the admin preview.
 */

import { storage } from "./storage";
import { publicOnly } from "./dmca/content-visibility";
import { logger } from "./lib/logger";
import { formatInTimeZone } from "date-fns-tz";
import {
  sendCalendarEventNotificationEmail,
  sendCalendarScheduleEscalationEmail,
} from "./sendgrid-service";
import {
  resolveScheduledCalendarRecipients,
  selectCalendarEventsForTomorrow,
} from "./calendar-notification-helpers";
import type {
  User,
  CalendarEmailRunHistoryEntry,
  CalendarEmailSchedule,
} from "@workspace/db";

const FLORIDA_TZ = "America/New_York";
const CHECK_INTERVAL_MS = 60 * 1000; // evaluate once a minute
const DAYS_AHEAD = 1; // automatic send covers tomorrow's events (matches /day endpoint)

// How long after the configured send time we will still attempt a catch-up
// send. Inside this window a missed/late send is OK (server may have just
// restarted, or events/recipients only just became available). Past this
// window the send is considered MISSED — we stop trying and escalate to admins
// instead of firing the digest hours late (the original bug: a 4:15 PM digest
// went out at ~9 PM because there was no catch-up cutoff).
const CATCHUP_GRACE_MINUTES = 120;

// Terminal outcomes: once one of these is recorded for the day, the run is
// "done" and we don't re-evaluate until tomorrow. ("sent" is also terminal but
// is gated separately via lastSentAt.)
const TERMINAL_SKIP_STATUSES = new Set([
  "sent",
  "partial_failure",
  "failed",
  "no_events",
  "no_recipients",
  "just_me_ineligible",
  "missed_window",
  "pref_none",
]);

// Transient outcomes: recorded while we're still inside the grace window and
// waiting for events/recipients to appear. These do NOT block re-evaluation,
// and they are intentionally kept OUT of the rolling history (they'd otherwise
// flood it with one entry per tick) — only the finalized outcome is logged.
const TRANSIENT_WAIT_STATUSES = new Set([
  "waiting_no_events",
  "waiting_no_recipients",
]);

// How many recent finalized run outcomes to keep in the rolling history.
export const MAX_RUN_HISTORY = 14;

// Missed-day watchdog cadence. It runs shortly after boot (the key moment — a
// server returning from an outage) and then slowly on a standing interval. It
// does no sending and is cheap, so a slow recurring check is plenty.
const WATCHDOG_BOOT_DELAY_MS = 30 * 1000; // ~30s after boot, once the app has settled
const WATCHDOG_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes thereafter

let schedulerStarted = false;
let ticking = false;
let watchdogRunning = false;

/**
 * Environment gate: is this process allowed to send scheduler-driven emails
 * (daily digest, escalations, watchdog alerts, heartbeats)?
 *
 * Only the deployed production server should ever send these. The development
 * workspace runs the very same scheduler code with the same SendGrid
 * credentials but reads a stale dev database, so when it wakes up it can see
 * "no send today, past the grace window" and email every real admin a false
 * "missed its window" alert (this actually happened) — or even blast a
 * duplicate full digest to everyone.
 *
 * Detection matches the rest of the API server (see app.ts): production means
 * NODE_ENV=production or REPLIT_DEPLOYMENT=true. For deliberate testing in a
 * dev workspace, set CALENDAR_SCHEDULER_DEV_SENDING=true to opt in explicitly.
 */
export function isCalendarEmailSendingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env["CALENDAR_SCHEDULER_DEV_SENDING"] === "true") return true;
  return env["NODE_ENV"] === "production" || env["REPLIT_DEPLOYMENT"] === "true";
}

function isTodayET(date: Date | string | null | undefined, todayET: string): boolean {
  if (!date) return false;
  return formatInTimeZone(new Date(date), FLORIDA_TZ, "yyyy-MM-dd") >= todayET;
}

function friendlyTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function eligibleAdminEmails(allUsers: User[]): string[] {
  return allUsers
    .filter(u => u.email && !u.isBlocked && u.role === "admin" && u.emailNotificationsEnabled !== false)
    .map(u => u.email as string);
}

/**
 * Collaborators the tick needs. Injectable so the timing logic can be unit
 * tested in isolation without a database or SendGrid. Production callers omit
 * this and get the real singletons via {@link defaultSchedulerDeps}.
 */
export interface CalendarEmailSchedulerDeps {
  getCalendarEmailSchedule: typeof storage.getCalendarEmailSchedule;
  claimCalendarEmailSend: typeof storage.claimCalendarEmailSend;
  // Atomically claims today's escalation so concurrent instances email admins at
  // most once per day about a non-completing send (CAS on lastEscalationAt).
  claimCalendarEmailEscalation: typeof storage.claimCalendarEmailEscalation;
  // Atomically claims the once-per-missed-day watchdog alert so concurrent
  // instances email admins at most once about a fully-missed send day.
  claimCalendarEmailWatchdog: typeof storage.claimCalendarEmailWatchdog;
  // Atomically claims today's "all healthy" heartbeat so concurrent instances
  // send the once-daily confirmation email at most once per day.
  claimCalendarEmailHeartbeat: typeof storage.claimCalendarEmailHeartbeat;
  getEvents: typeof storage.getEvents;
  getUsers: typeof storage.getUsers;
  sendCalendarEventNotificationEmail: typeof sendCalendarEventNotificationEmail;
  // Records the outcome of a run (status/detail/escalation) without touching the
  // lastSentAt one-shot guard. Backed by upsertCalendarEmailSchedule.
  recordCalendarEmailRun: typeof storage.upsertCalendarEmailSchedule;
  sendCalendarScheduleEscalationEmail: typeof sendCalendarScheduleEscalationEmail;
  // Environment gate — must return true for the tick/watchdog to send ANY
  // email or stamp ANY run/escalation/watchdog state. Defaults to the real
  // production check ({@link isCalendarEmailSendingEnabled}); tests inject
  // their own. Optional so pre-existing test harnesses (which exercise the
  // timing logic, not the environment) keep working — when omitted, sending is
  // treated as allowed, but every production caller goes through
  // defaultSchedulerDeps() which always wires the real check.
  isEmailSendingEnabled?: () => boolean;
}

function defaultSchedulerDeps(): CalendarEmailSchedulerDeps {
  return {
    getCalendarEmailSchedule: () => storage.getCalendarEmailSchedule(),
    claimCalendarEmailSend: (scheduleId, expectedLastSentAt, now) =>
      storage.claimCalendarEmailSend(scheduleId, expectedLastSentAt, now),
    claimCalendarEmailEscalation: (scheduleId, expectedLastEscalationAt, now) =>
      storage.claimCalendarEmailEscalation(scheduleId, expectedLastEscalationAt, now),
    claimCalendarEmailWatchdog: (scheduleId, expectedLastWatchdogAt, now) =>
      storage.claimCalendarEmailWatchdog(scheduleId, expectedLastWatchdogAt, now),
    claimCalendarEmailHeartbeat: (scheduleId, expectedLastHeartbeatAt, now) =>
      storage.claimCalendarEmailHeartbeat(scheduleId, expectedLastHeartbeatAt, now),
    // DMCA/moderation: hidden events are never emailed.
    getEvents: async () => publicOnly(await storage.getEvents()),
    getUsers: forceRefresh => storage.getUsers(forceRefresh),
    sendCalendarEventNotificationEmail: (events, recipientEmails, daysAhead, options) =>
      sendCalendarEventNotificationEmail(events, recipientEmails, daysAhead, options),
    recordCalendarEmailRun: data => storage.upsertCalendarEmailSchedule(data),
    sendCalendarScheduleEscalationEmail: (adminEmails, info) =>
      sendCalendarScheduleEscalationEmail(adminEmails, info),
    isEmailSendingEnabled: () => isCalendarEmailSendingEnabled(),
  };
}

/**
 * Evaluate the schedule once and send if it's due. Exposed (not just the
 * interval) so it can be unit-tested or invoked manually if ever needed.
 */
export async function runCalendarEmailScheduleTick(
  now: Date = new Date(),
  deps: CalendarEmailSchedulerDeps = defaultSchedulerDeps(),
): Promise<void> {
  // Prevent overlapping runs if a previous tick is still sending.
  if (ticking) return;
  ticking = true;
  try {
    // Defense in depth: even if a tick is somehow triggered in a non-production
    // environment (e.g. via an endpoint), send nothing and stamp nothing.
    if (deps.isEmailSendingEnabled && !deps.isEmailSendingEnabled()) {
      logger.info(
        "[CalendarEmailScheduler] Sending is disabled in this environment (not deployed production; set CALENDAR_SCHEDULER_DEV_SENDING=true to opt in) — tick skipped",
      );
      return;
    }
    const schedule = await deps.getCalendarEmailSchedule();
    if (!schedule || !schedule.enabled) {
      return;
    }

    const todayET = formatInTimeZone(now, FLORIDA_TZ, "yyyy-MM-dd");
    const nowHHMM = formatInTimeZone(now, FLORIDA_TZ, "HH:mm");
    const friendlyDate = formatInTimeZone(now, FLORIDA_TZ, "MMM d, yyyy");

    // Not yet at the configured send time (string compare is safe for zero-padded HH:mm).
    if (nowHHMM < schedule.sendTime) {
      return;
    }

    // Already sent today? (survives restarts via persisted lastSentAt)
    if (isTodayET(schedule.lastSentAt, todayET)) {
      return;
    }

    // Already reached a terminal outcome today (skip / failure / missed)? Don't
    // re-evaluate until tomorrow. Transient "waiting_*" statuses fall through so
    // we keep retrying inside the grace window.
    if (
      schedule.lastRunStatus &&
      TERMINAL_SKIP_STATUSES.has(schedule.lastRunStatus) &&
      isTodayET(schedule.lastRunAt, todayET)
    ) {
      return;
    }

    // Minutes elapsed since the configured send time (both in ET, same day).
    const [sh, sm] = schedule.sendTime.split(":").map(Number);
    const [nh, nm] = nowHHMM.split(":").map(Number);
    const pastByMins = (nh * 60 + nm) - (sh * 60 + sm);
    const windowExpired = pastByMins > CATCHUP_GRACE_MINUTES;

    // Helper: record a run outcome (does NOT touch lastSentAt). Finalized
    // outcomes are also appended (newest first, capped) to the rolling history
    // so the admin page can show the last several days' results. Transient
    // "waiting_*" statuses update only the latest-run line, not the history.
    const recordRun = (status: string, detail: string) => {
      const isFinal = !TRANSIENT_WAIT_STATUSES.has(status);
      let recentRuns: CalendarEmailRunHistoryEntry[] | undefined;
      if (isFinal) {
        const prior = (schedule.recentRuns as CalendarEmailRunHistoryEntry[] | null | undefined) ?? [];
        recentRuns = [
          { status, detail, at: now.toISOString() },
          ...prior,
        ].slice(0, MAX_RUN_HISTORY);
      }
      return deps.recordCalendarEmailRun({
        lastRunAt: now,
        lastRunStatus: status,
        lastRunDetail: detail,
        ...(recentRuns ? { recentRuns } : {}),
      });
    };

    // Helper: email all eligible admins that a scheduled send did not complete.
    // De-duped to once per day via lastEscalationAt. `severity: "info"` is the
    // softer, non-alarming variant used for the normal "no events" case.
    const escalate = async (
      allUsers: User[],
      reason: string,
      title: string,
      detail: string,
      severity: "alert" | "info",
    ) => {
      if (isTodayET(schedule.lastEscalationAt, todayET)) return; // fast path: already escalated today
      const adminEmails = eligibleAdminEmails(allUsers);
      if (adminEmails.length === 0) {
        logger.warn("[CalendarEmailScheduler] Wanted to escalate but found no eligible admins to email");
        return;
      }
      // Atomically claim today's escalation BEFORE sending. Cross-process guard:
      // mirrors claimCalendarEmailSend so that, when more than one API server
      // instance runs at once, only the instance that wins the conditional UPDATE
      // emails admins — the rest see the now-changed lastEscalationAt, match 0
      // rows, and skip. The claim marks lastEscalationAt up-front so we never
      // double-notify within the day.
      const claimed = await deps.claimCalendarEmailEscalation(
        schedule.id,
        schedule.lastEscalationAt ?? null,
        now,
      );
      if (!claimed) {
        logger.info("[CalendarEmailScheduler] Another instance already escalated today — skipping");
        return;
      }
      try {
        await deps.sendCalendarScheduleEscalationEmail(adminEmails, {
          reason,
          title,
          detail,
          severity,
          dateET: friendlyDate,
          sendTime: friendlyTime(schedule.sendTime),
        });
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          "[CalendarEmailScheduler] Failed to send escalation email",
        );
      }
    };

    // Helper: send the opt-in once-daily "all healthy" heartbeat after a
    // successful send. Reuses the exact escalation/notification plumbing and the
    // same eligible-admin recipient resolution, so a delivered heartbeat confirms
    // the alert channel works end to end. De-duped to once per ET day via
    // lastHeartbeatAt (CAS), mirroring the escalation guard, so it can never
    // double-send within a day even across concurrent instances. `severity:
    // "info"` renders the calm, non-alarming style.
    const sendHeartbeat = async (allUsers: User[], heartbeatDetail: string) => {
      if (!schedule.heartbeatEnabled) return; // opt-in; off by default
      if (isTodayET(schedule.lastHeartbeatAt, todayET)) return; // already sent today
      const adminEmails = eligibleAdminEmails(allUsers);
      if (adminEmails.length === 0) {
        logger.warn("[CalendarEmailScheduler] Heartbeat enabled but found no eligible admins to email");
        return;
      }
      const claimed = await deps.claimCalendarEmailHeartbeat(
        schedule.id,
        schedule.lastHeartbeatAt ?? null,
        now,
      );
      if (!claimed) {
        logger.info("[CalendarEmailScheduler] Another instance already sent today's heartbeat — skipping");
        return;
      }
      try {
        await deps.sendCalendarScheduleEscalationEmail(adminEmails, {
          reason: "heartbeat_ok",
          title: "Daily calendar digest sent successfully",
          detail: heartbeatDetail,
          severity: "info",
          dateET: friendlyDate,
          sendTime: friendlyTime(schedule.sendTime),
        });
        logger.info("[CalendarEmailScheduler] Sent daily 'all healthy' heartbeat to admins");
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          "[CalendarEmailScheduler] Failed to send heartbeat email",
        );
      }
    };

    const savedCustomOrder = schedule.customEventOrder as number[] | null | undefined;
    const savedAttachImages = schedule.attachImageEventIds as number[] | null | undefined;

    const allEvents = await deps.getEvents();
    const events = selectCalendarEventsForTomorrow(allEvents, now);
    const allUsers = await deps.getUsers();
    const resolution = resolveScheduledCalendarRecipients(
      schedule.notifyPreference,
      allUsers,
      schedule.adminUserId,
    );

    // "Notify no one" is an intentional config, not a failure — finalize quietly
    // with no escalation, regardless of window.
    if (resolution.kind === "none") {
      logger.info("[CalendarEmailScheduler] notifyPreference is 'none' — nothing to send");
      await recordRun("pref_none", "Recipients are set to \u201CNotify no one,\u201D so no email was sent.");
      return;
    }

    const noEvents = events.length === 0;
    const noRecipients = resolution.kind === "noRecipients";
    const justMeIneligible = noRecipients && schedule.notifyPreference === "justme";

    // --- Past the catch-up window: stop trying and finalize the outcome. ---
    if (windowExpired) {
      if (noRecipients) {
        const status = justMeIneligible ? "just_me_ineligible" : "no_recipients";
        const detail = justMeIneligible
          ? `The admin set to receive the \u201Cjust me\u201D digest can no longer receive email, so the ${friendlyTime(schedule.sendTime)} ET send was skipped.`
          : `No eligible recipients for the selected audience, so the ${friendlyTime(schedule.sendTime)} ET send was skipped.`;
        await recordRun(status, detail);
        await escalate(
          allUsers,
          status,
          "Scheduled calendar email skipped — no recipients",
          detail,
          "alert",
        );
        return;
      }
      if (noEvents) {
        const detail = `No events were scheduled for tomorrow, so the ${friendlyTime(schedule.sendTime)} ET digest was not sent. This is normal on quiet days.`;
        await recordRun("no_events", detail);
        await escalate(
          allUsers,
          "no_events",
          "No calendar digest sent — nothing scheduled for tomorrow",
          detail,
          "info",
        );
        return;
      }
      // Events and recipients both exist but we're well past the send time —
      // the server was almost certainly not running during the window. Don't
      // fire the digest hours late; flag it as missed so an admin can send it
      // manually with the "Same-Day" / "1-Day" buttons.
      const detail = `The ${friendlyTime(schedule.sendTime)} ET digest did not run on time (more than ${CATCHUP_GRACE_MINUTES} minutes late) and was not sent automatically to avoid a very late email. Use the manual send buttons if you still want it to go out.`;
      await recordRun("missed_window", detail);
      await escalate(
        allUsers,
        "missed_window",
        "Scheduled calendar email missed its window",
        detail,
        "alert",
      );
      return;
    }

    // --- Inside the catch-up window: wait for events/recipients to appear. ---
    if (noEvents) {
      logger.info("[CalendarEmailScheduler] No events for tomorrow yet — waiting within grace window");
      await recordRun(
        "waiting_no_events",
        "Waiting — no events are scheduled for tomorrow yet.",
      );
      return;
    }
    if (noRecipients) {
      logger.warn(
        { notifyPreference: schedule.notifyPreference },
        "[CalendarEmailScheduler] No eligible recipients yet — waiting within grace window",
      );
      await recordRun(
        "waiting_no_recipients",
        justMeIneligible
          ? "Waiting — the admin set for the \u201Cjust me\u201D digest can't receive email right now."
          : "Waiting — no eligible recipients for the selected audience yet.",
      );
      return;
    }

    // --- Ready to send: claim today's slot, then send. ---
    logger.info(
      { sendTime: schedule.sendTime, notifyPreference: schedule.notifyPreference, todayET },
      "[CalendarEmailScheduler] Schedule is due and ready — attempting to claim today's send",
    );

    // Atomically claim today's send. Cross-process guard: when more than one API
    // server instance runs at once, the conditional UPDATE only succeeds for the
    // instance that wins the race, so the digest goes out exactly once per day.
    // The claim marks lastSentAt up-front so we never double-send within the day
    // even if the send below partially fails, and clears the one-shot fields
    // (customEventOrder / attachImageEventIds) in the same write.
    const claimed = await deps.claimCalendarEmailSend(
      schedule.id,
      schedule.lastSentAt ?? null,
      now,
    );
    if (!claimed) {
      logger.info(
        { todayET },
        "[CalendarEmailScheduler] Another instance already claimed today's send — skipping",
      );
      return;
    }

    let result: { success: boolean; sentCount: number; totalCount: number };
    try {
      result = await deps.sendCalendarEventNotificationEmail(
        events,
        resolution.recipientEmails,
        DAYS_AHEAD,
        {
          customEventOrder: savedCustomOrder ?? undefined,
          attachImageEventIds: savedAttachImages ?? undefined,
        },
      );
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      const detail = `The ${friendlyTime(schedule.sendTime)} ET digest failed to send due to an error: ${msg}`;
      await recordRun("failed", detail);
      await escalate(allUsers, "failed", "Scheduled calendar email failed to send", detail, "alert");
      return;
    }

    if (result.sentCount === 0 && result.totalCount > 0) {
      const detail = `The ${friendlyTime(schedule.sendTime)} ET digest reached 0 of ${result.totalCount} intended recipient(s) — every delivery failed.`;
      await recordRun("partial_failure", detail);
      await escalate(
        allUsers,
        "partial_failure",
        "Scheduled calendar email did not deliver",
        detail,
        "alert",
      );
      return;
    }

    await recordRun(
      "sent",
      `Sent to ${result.sentCount} of ${result.totalCount} recipient(s) covering ${events.length} event(s).`,
    );
    logger.info(
      {
        eventCount: events.length,
        sentCount: result.sentCount,
        totalCount: result.totalCount,
        success: result.success,
      },
      "[CalendarEmailScheduler] Automatic calendar email send complete",
    );

    // Opt-in "all healthy" heartbeat: confirm to admins that today's digest went
    // out and, by arriving, that the alert channel itself works end to end.
    await sendHeartbeat(
      allUsers,
      `Today's calendar digest was sent successfully to ${result.sentCount} of ${result.totalCount} recipient(s), covering ${events.length} event(s). This confirmation means the daily email and its alerting channel are both working — no action is needed.`,
    );
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      "[CalendarEmailScheduler] Error during scheduled calendar email tick",
    );
  } finally {
    ticking = false;
  }
}

/**
 * Independent "did the digest ever stop going out?" watchdog.
 *
 * The minute-by-minute tick can only notice a problem while the server is
 * running. The one gap it cannot close itself is an outage that spans the entire
 * send + catch-up window AND continues past end-of-day: when the process is down
 * through the whole window, no run is ever recorded for that day, and once the ET
 * day rolls over the tick resets and silently forgets the missed day.
 *
 * This watchdog is the catch-up safety net. Whenever the server is up (run once
 * at boot and then periodically) it asks a simple question: "for the most recent
 * expected-send day whose window has fully elapsed, did the scheduler record ANY
 * run?" If not — and we have a prior baseline run, so this isn't a brand-new
 * never-run schedule — it means a whole day's digest silently never happened, so
 * it alerts admins through the exact same escalation path the tick uses.
 *
 * De-duped per missed expected-day via `lastWatchdogAt` (CAS), so a multi-day
 * outage or multiple instances coming back online alert admins at most once for
 * a given missed day.
 *
 * Returns a {@link WatchdogResult} so it can be driven by an EXTERNAL, out-of-
 * process trigger (the public verification endpoint) and not only the in-process
 * timer: an external uptime monitor / scheduled job can poll the endpoint on its
 * own clock, get back a clear healthy/missed verdict, and — because this call
 * itself fires the admin escalation on a detected miss — the alert goes out even
 * if the in-process timers never ran. If the whole app is down, the monitor's
 * request simply fails, which is the out-of-band signal of total outage.
 */
// Last-run outcomes that mean the most recent expected day was attempted but did
// NOT result in a clean send — the admin still needs to act.
const FAILED_RUN_STATUSES = new Set(["failed", "partial_failure", "missed_window"]);

/**
 * Read-only health verdict for the admin "Automatic Schedule" panel.
 *
 * Mirrors the watchdog's expected-day question — "for the most recent
 * fully-elapsed send window, did the scheduler record a run?" — but performs NO
 * side effects (no email, no claim), so it is safe to call from a plain GET.
 * It also flags a last run that finished in a failed/missed outcome, which the
 * watchdog itself treats as "ran" (pipeline alive) but an admin should still see
 * as needing attention.
 */
export interface CalendarEmailHealth {
  /** Overall verdict for the panel badge. */
  status: "healthy" | "attention" | "unknown";
  /** Short machine-readable reason for the verdict. */
  reason:
    | "disabled"
    | "pref_none"
    | "no_baseline"
    | "ran"
    | "missed_day"
    | "last_run_failed";
  /** The ET day (yyyy-MM-dd) evaluated, when applicable. */
  expectedDay?: string;
}

export function computeCalendarEmailHealth(
  schedule: CalendarEmailSchedule | undefined | null,
  now: Date = new Date(),
): CalendarEmailHealth {
  if (!schedule || !schedule.enabled) {
    return { status: "unknown", reason: "disabled" };
  }
  // "Notify no one" is an intentional config — there is nothing to watch.
  if (schedule.notifyPreference === "none") {
    return { status: "unknown", reason: "pref_none" };
  }

  const todayET = formatInTimeZone(now, FLORIDA_TZ, "yyyy-MM-dd");
  const nowHHMM = formatInTimeZone(now, FLORIDA_TZ, "HH:mm");
  const [sh, sm] = schedule.sendTime.split(":").map(Number);
  const [nh, nm] = nowHHMM.split(":").map(Number);
  const sendMins = sh * 60 + sm;
  const nowMins = nh * 60 + nm;
  const windowEndMins = sendMins + CATCHUP_GRACE_MINUTES;

  // The most recent day whose send window (sendTime + grace) has fully elapsed.
  let expectedDay: string;
  if (nowMins > windowEndMins) {
    expectedDay = todayET;
  } else {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expectedDay = formatInTimeZone(yesterday, FLORIDA_TZ, "yyyy-MM-dd");
  }

  const ranOnExpectedDay =
    isTodayET(schedule.lastRunAt, expectedDay) ||
    isTodayET(schedule.lastSentAt, expectedDay);
  if (ranOnExpectedDay) {
    if (schedule.lastRunStatus && FAILED_RUN_STATUSES.has(schedule.lastRunStatus)) {
      return { status: "attention", reason: "last_run_failed", expectedDay };
    }
    return { status: "healthy", reason: "ran", expectedDay };
  }

  // No run on the expected day. A schedule that has literally never run yet
  // shouldn't read as "attention" — there is no established cadence to break.
  const hasBaseline = Boolean(schedule.lastRunAt || schedule.lastSentAt);
  if (!hasBaseline) {
    return { status: "unknown", reason: "no_baseline", expectedDay };
  }

  return { status: "attention", reason: "missed_day", expectedDay };
}

export interface WatchdogResult {
  /** Did we actually evaluate the cadence (enabled, watched audience, baseline)? */
  checked: boolean;
  /** Nothing to alarm about: a run was recorded for the expected day, or there is nothing to watch. */
  healthy: boolean;
  /** A fully-elapsed expected-send day had no recorded run. */
  missed: boolean;
  /** This call sent (or claimed) the admin alert for the missed day. */
  alerted: boolean;
  /** The ET day (yyyy-MM-dd) we evaluated, when applicable. */
  expectedDay?: string;
  /** Short machine-readable reason for the verdict. */
  reason:
    | "already_running"
    | "sending_disabled_in_env"
    | "disabled"
    | "pref_none"
    | "ran"
    | "no_baseline"
    | "already_alerted"
    | "no_admins"
    | "claimed_by_other"
    | "alerted"
    | "error";
  /** Present when reason === "error". */
  error?: string;
}

export async function runCalendarEmailWatchdog(
  now: Date = new Date(),
  deps: CalendarEmailSchedulerDeps = defaultSchedulerDeps(),
): Promise<WatchdogResult> {
  if (watchdogRunning) {
    return { checked: false, healthy: true, missed: false, alerted: false, reason: "already_running" };
  }
  watchdogRunning = true;
  try {
    // Defense in depth: even if the watchdog is triggered in a non-production
    // environment (e.g. via the public verification endpoint), send nothing
    // and stamp nothing.
    if (deps.isEmailSendingEnabled && !deps.isEmailSendingEnabled()) {
      logger.info(
        "[CalendarEmailScheduler] Watchdog sending is disabled in this environment (not deployed production; set CALENDAR_SCHEDULER_DEV_SENDING=true to opt in) — check skipped",
      );
      return { checked: false, healthy: true, missed: false, alerted: false, reason: "sending_disabled_in_env" };
    }
    const schedule = await deps.getCalendarEmailSchedule();
    if (!schedule || !schedule.enabled) {
      return { checked: false, healthy: true, missed: false, alerted: false, reason: "disabled" };
    }

    // "Notify no one" is an intentional config — there is nothing to watch.
    if (schedule.notifyPreference === "none") {
      return { checked: false, healthy: true, missed: false, alerted: false, reason: "pref_none" };
    }

    const todayET = formatInTimeZone(now, FLORIDA_TZ, "yyyy-MM-dd");
    const nowHHMM = formatInTimeZone(now, FLORIDA_TZ, "HH:mm");
    const [sh, sm] = schedule.sendTime.split(":").map(Number);
    const [nh, nm] = nowHHMM.split(":").map(Number);
    const sendMins = sh * 60 + sm;
    const nowMins = nh * 60 + nm;
    const windowEndMins = sendMins + CATCHUP_GRACE_MINUTES;

    // The most recent day whose send window (sendTime + grace) has FULLY elapsed.
    // If today's window has passed, today is the day we expect a run for;
    // otherwise the last fully-elapsed window was yesterday's.
    let expectedDay: string;
    if (nowMins > windowEndMins) {
      expectedDay = todayET;
    } else {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expectedDay = formatInTimeZone(yesterday, FLORIDA_TZ, "yyyy-MM-dd");
    }

    // Did the scheduler record anything (a real send OR any run outcome) on or
    // after the expected day? If so, the digest pipeline is alive — nothing to do.
    const ranOnExpectedDay =
      isTodayET(schedule.lastRunAt, expectedDay) ||
      isTodayET(schedule.lastSentAt, expectedDay);
    if (ranOnExpectedDay) {
      return { checked: true, healthy: true, missed: false, alerted: false, expectedDay, reason: "ran" };
    }

    // Require a baseline: a schedule that has literally never run yet (just
    // enabled, server cold) shouldn't trigger a "stopped sending" alarm — there
    // is no established cadence to have stopped. The real-world outage we care
    // about always has prior successful runs behind it.
    const hasBaseline = Boolean(schedule.lastRunAt || schedule.lastSentAt);
    if (!hasBaseline) {
      return { checked: false, healthy: true, missed: false, alerted: false, expectedDay, reason: "no_baseline" };
    }

    // Already alerted for this missed expected-day (or a later one)? Stop.
    if (isTodayET(schedule.lastWatchdogAt, expectedDay)) {
      return { checked: true, healthy: false, missed: true, alerted: false, expectedDay, reason: "already_alerted" };
    }

    const allUsers = await deps.getUsers();
    const adminEmails = eligibleAdminEmails(allUsers);
    if (adminEmails.length === 0) {
      logger.warn(
        "[CalendarEmailScheduler] Watchdog wanted to alert about a missed send day but found no eligible admins to email",
      );
      return { checked: true, healthy: false, missed: true, alerted: false, expectedDay, reason: "no_admins" };
    }

    // Atomically claim this watchdog alert before sending (cross-instance dedup).
    const claimed = await deps.claimCalendarEmailWatchdog(
      schedule.id,
      schedule.lastWatchdogAt ?? null,
      now,
    );
    if (!claimed) {
      logger.info(
        "[CalendarEmailScheduler] Another instance already raised the watchdog alert — skipping",
      );
      return { checked: true, healthy: false, missed: true, alerted: false, expectedDay, reason: "claimed_by_other" };
    }

    const friendlyExpectedDay = formatInTimeZone(
      // Parse the ET date string back to a noon-UTC instant just for display
      // formatting (avoids any midnight/DST edge in the friendly label).
      new Date(`${expectedDay}T12:00:00Z`),
      FLORIDA_TZ,
      "MMM d, yyyy",
    );
    const detail = `No calendar digest run was recorded for ${friendlyExpectedDay}. The ${friendlyTime(schedule.sendTime)} ET send and its catch-up window passed with the server apparently down the whole time, so that day's digest never went out and was not flagged at the time. If those events are still relevant, send them manually from Calendar Management.`;

    logger.warn(
      { expectedDay, sendTime: schedule.sendTime },
      "[CalendarEmailScheduler] Watchdog detected a fully-missed send day — alerting admins",
    );

    try {
      await deps.sendCalendarScheduleEscalationEmail(adminEmails, {
        reason: "watchdog_missed_day",
        title: "Daily calendar email did not go out",
        detail,
        severity: "alert",
        dateET: friendlyExpectedDay,
        sendTime: friendlyTime(schedule.sendTime),
      });
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[CalendarEmailScheduler] Failed to send watchdog alert email",
      );
    }
    return { checked: true, healthy: false, missed: true, alerted: true, expectedDay, reason: "alerted" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(
      { err: msg },
      "[CalendarEmailScheduler] Error during calendar email watchdog check",
    );
    return { checked: false, healthy: true, missed: false, alerted: false, reason: "error", error: msg };
  } finally {
    watchdogRunning = false;
  }
}

/**
 * Start the background scheduler. Idempotent — calling it more than once is a
 * no-op so we never end up with two timers firing.
 */
export function startCalendarEmailScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  // Only the deployed production server may run the scheduler/watchdog timers.
  // The dev workspace shares SendGrid credentials but reads a stale dev DB, so
  // running here would fire false "missed window" alerts (and could even
  // duplicate the daily digest) at real admins.
  if (!isCalendarEmailSendingEnabled()) {
    logger.info(
      "[CalendarEmailScheduler] Not starting: scheduler email sending is disabled in this environment (not deployed production). Set CALENDAR_SCHEDULER_DEV_SENDING=true to opt in for testing.",
    );
    return;
  }

  schedulerStarted = true;

  logger.info(
    { intervalMs: CHECK_INTERVAL_MS, watchdogIntervalMs: WATCHDOG_INTERVAL_MS },
    "[CalendarEmailScheduler] Starting automatic calendar email scheduler",
  );

  const timer = setInterval(() => {
    void runCalendarEmailScheduleTick();
  }, CHECK_INTERVAL_MS);

  // Don't let the timer keep the process alive on its own.
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  // Run the missed-day watchdog shortly after boot (so a server that just came
  // back from an outage spanning a whole send window alerts admins right away)
  // and then on a slow recurring cadence as a standing safety net.
  setTimeout(() => {
    void runCalendarEmailWatchdog();
  }, WATCHDOG_BOOT_DELAY_MS).unref?.();

  const watchdogTimer = setInterval(() => {
    void runCalendarEmailWatchdog();
  }, WATCHDOG_INTERVAL_MS);
  if (typeof watchdogTimer.unref === "function") {
    watchdogTimer.unref();
  }
}
