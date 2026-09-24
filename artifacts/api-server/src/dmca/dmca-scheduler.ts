import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../lib/logger";
import { isDmcaSchedulerEmailSendingEnabled } from "../scheduler-email-gate";
import { raiseDmcaAdminAlert } from "./admin-alerts";
import { addBusinessDays, businessDaysBetween } from "./business-days";
import { transitionCase } from "./dmca-service";
import { runLeakageCheck } from "./leakage-checker";
import { DmcaCaseStatus as S } from "./state-machine";

export async function runDmcaSchedulerTick({ now = new Date(), emailEnabled }: {
  now?: Date; emailEnabled: boolean;
}): Promise<void> {
  const settings = ((await db.execute(sql`SELECT * FROM dmca_settings WHERE id=1`)).rows[0] || {}) as any;
  const offsets = settings.reminder_offsets || {};
  const untouchedDays = Number(offsets.untouchedNoticeBusinessDays ??
    Math.ceil(Number(offsets.untouchedNoticeHours ?? 48) / 24));
  const cases = (await db.execute(sql`
    SELECT c.*, EXISTS(
      SELECT 1 FROM legal_holds h WHERE h.released_at IS NULL AND (
        (h.case_type='dmca' AND h.case_id=c.id) OR EXISTS(
          SELECT 1 FROM dmca_targets t WHERE t.dmca_case_id=c.id AND
          ((h.content_type=t.content_type AND h.content_id=t.content_id) OR
           (h.user_id IS NOT NULL AND h.user_id=t.uploader_user_id))))
    ) active_hold
    FROM dmca_cases c
    WHERE c.status IN ('RECEIVED','UNDER_REVIEW','COUNTER_NOTICE_RECEIVED',
      'CLAIMANT_NOTIFIED_OF_COUNTER','WAITING_FOR_RESTORATION_WINDOW','RESTORATION_ELIGIBLE')`)).rows as any[];
  for (const c of cases) {
    try {
    if (c.status === S.RECEIVED || c.status === S.UNDER_REVIEW) {
      const age = businessDaysBetween(new Date(c.status === S.UNDER_REVIEW ? c.updated_at : c.received_at), now);
      if (age >= untouchedDays) await raiseDmcaAdminAlert({
        alertType: "untouched_notice", severity: "warning", title: "DMCA notice awaiting review",
        body: `${c.case_number} has had no review activity for ${age} business days.`,
        dedupeKey: `sched:untouched:${c.id}:${new Date(c.status === S.UNDER_REVIEW ? c.updated_at : c.received_at).toISOString()}`,
        dmcaCaseId: Number(c.id), emailTo: "all", emailEnabled,
      });
    }
    if (c.status === S.COUNTER_NOTICE_RECEIVED && c.counter_notice_received_at &&
        businessDaysBetween(new Date(c.counter_notice_received_at), now) >= 2) {
      await raiseDmcaAdminAlert({
        alertType: "counter_notice_unreviewed", severity: "warning", title: "Counter-notice awaiting review",
        body: `${c.case_number} has not been reviewed within 2 business days.`,
        dedupeKey: `sched:counter-review:${c.id}:${new Date(c.counter_notice_received_at).toISOString()}`,
        dmcaCaseId: Number(c.id), emailTo: "all", emailEnabled,
      });
    }
    if (!c.claimant_counter_notified_at || c.status === S.COURT_ACTION_RECEIVED ||
        c.court_action_received_at || c.legal_hold || c.active_hold) continue;
    const start = new Date(c.claimant_counter_notified_at);
    const day = businessDaysBetween(start, now);
    const key = start.toISOString();
    if (day >= Number(offsets.restoreReminderBusinessDay ?? 8)) await raiseDmcaAdminAlert({
      alertType: "restoration_day8", severity: "info", title: "Restoration window reminder",
      body: `${c.case_number} is at business day ${day} of its restoration window.`,
      dedupeKey: `sched:day8:${c.id}:${key}`, dmcaCaseId: Number(c.id), emailTo: "assigned", emailEnabled,
    });
    const eligibility = c.restore_eligible_at
      ? new Date(c.restore_eligible_at)
      : addBusinessDays(start, Number(offsets.restoreEligibleBusinessDay ?? 10));
    if (day >= Number(offsets.restoreEligibleBusinessDay ?? 10) && now >= eligibility &&
        [S.WAITING_FOR_RESTORATION_WINDOW, S.CLAIMANT_NOTIFIED_OF_COUNTER].includes(c.status)) {
      if (c.status === S.CLAIMANT_NOTIFIED_OF_COUNTER) {
        await transitionCase(Number(c.id), S.WAITING_FOR_RESTORATION_WINDOW, { type: "system" }, { now });
      }
      await transitionCase(Number(c.id), S.RESTORATION_ELIGIBLE, { type: "system" }, { now });
      await raiseDmcaAdminAlert({
        alertType: "restoration_eligible", severity: "warning", title: "DMCA case eligible for restoration",
        body: `${c.case_number} reached business day 10. An administrator must decide whether to restore; no restoration was performed.`,
        dedupeKey: `sched:day10:${c.id}:${key}`, dmcaCaseId: Number(c.id), emailTo: "all", emailEnabled,
      });
    }
    if (day >= Number(offsets.restoreEscalationBusinessDay ?? 12)) await raiseDmcaAdminAlert({
      alertType: "restoration_day12", severity: "warning", title: "DMCA administrator review required",
      body: `${c.case_number} is at business day ${day}; DMCA administrator action is required.`,
      dedupeKey: `sched:day12:${c.id}:${key}`, dmcaCaseId: Number(c.id), emailTo: "all", emailEnabled,
    });
    if (day >= Number(offsets.restoreDeadlineBusinessDay ?? 14) - 1) await raiseDmcaAdminAlert({
      alertType: "restoration_deadline", severity: "critical", title: "DMCA restoration deadline approaching",
      body: `${c.case_number} is approaching the 14-business-day deadline. Review immediately.`,
      dedupeKey: `sched:day13:${c.id}:${key}`, dmcaCaseId: Number(c.id), emailTo: "all", emailEnabled,
    });
    } catch (err) {
      // One malformed case must not prevent other case alerts, registration
      // reminders or the leakage check from running.
      logger.error({ err, caseId: c.id }, "[DMCA scheduler] case tick failed");
    }
  }

  const users = (await db.execute(sql`SELECT DISTINCT user_id FROM user_copyright_events WHERE counts_toward_repeat_policy=true`)).rows as any[];
  try {
    const service = await import("./dmca-service") as any;
    if (typeof service.checkRepeatInfringerThreshold === "function")
      for (const u of users) await service.checkRepeatInfringerThreshold(Number(u.user_id));
  } catch (err) { logger.error({ err }, "[DMCA scheduler] repeat-infringer catch-up failed"); }

  if (settings.registration_expires_at) {
    const expiry = new Date(settings.registration_expires_at);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
    for (const offset of (offsets.agentRenewalReminderDays || [90, 30, 7])) {
      if (days <= Number(offset)) await raiseDmcaAdminAlert({
        alertType: "agent_registration_expiry", severity: days <= 7 ? "critical" : "warning",
        title: days < 0 ? "DMCA agent registration expired" : "DMCA agent registration renewal due",
        body: days < 0 ? "The DMCA agent registration has expired." : `The DMCA agent registration expires in ${days} days.`,
        dedupeKey: `sched:agent:${offset}:${expiry.toISOString().slice(0, 10)}`, emailTo: "all", emailEnabled,
      });
    }
  }
}

let started = false, ticking = false, lastLeakageAt = 0;
export function startDmcaScheduler(): void {
  if (started) return;
  started = true;
  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      const emailEnabled = isDmcaSchedulerEmailSendingEnabled();
      await runDmcaSchedulerTick({ emailEnabled });
      if (Date.now() - lastLeakageAt >= 6 * 60 * 60_000) {
        await runLeakageCheck({ baseUrl: `http://127.0.0.1:${process.env.PORT}` });
        lastLeakageAt = Date.now();
      }
    } catch (err) { logger.error({ err }, "[DMCA scheduler] tick failed"); }
    finally { ticking = false; }
  };
  const first = setTimeout(() => void tick(), 10_000); first.unref();
  const timer = setInterval(() => void tick(), 15 * 60_000); timer.unref();
}