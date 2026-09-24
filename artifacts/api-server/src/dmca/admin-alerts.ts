/**
 * DMCA admin alerts: one durable dashboard row per alert (deduplicated by key)
 * plus, optionally, an email to DMCA staff through the notification outbox.
 *
 * Dashboard rows are always written. Emails are only enqueued when the caller
 * allows it (schedulers pass their env gate result), and the outbox dispatcher
 * applies its own production gate on delivery as well.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { enqueueNotification } from "./outbox";
import type { DbExecutor } from "./audit";

export type DmcaAlertSeverity = "info" | "warning" | "critical";

export interface RaiseDmcaAlertInput {
  /** Machine type, e.g. "counter_notice_received", "restoration_eligible", "content_exposure". */
  alertType: string;
  severity: DmcaAlertSeverity;
  title: string;
  /** Plain text. Never include internal notes or claimant/uploader private contact data. */
  body: string;
  /** Unique key; raising the same key twice is a no-op (no second email either). */
  dedupeKey: string;
  dmcaCaseId?: number | null;
  userId?: number | null;
  /**
   * Who gets an email. "none" = dashboard only. "assigned" = the case's assigned
   * admin (falls back to all DMCA staff when unassigned). "all" = all DMCA staff.
   */
  emailTo?: "none" | "assigned" | "all";
  /** Pass false to suppress email (e.g. scheduler env gate is off). Default true. */
  emailEnabled?: boolean;
}

/** Active (non-blocked) users holding dmca.view or dmca.review. */
export async function getDmcaStaffRecipients(executor: DbExecutor = db): Promise<{ id: number; email: string }[]> {
  const r = await executor.execute(sql`
    SELECT DISTINCT u.id, u.email FROM users u
    JOIN dmca_permission_grants g ON g.user_id = u.id
    WHERE g.permission IN ('dmca.view','dmca.review')
      AND COALESCE(u.is_blocked,false) = false AND u.email IS NOT NULL AND u.email <> ''`);
  return (r.rows as any[]).map((x) => ({ id: Number(x.id), email: String(x.email) }));
}

async function getAssignedRecipient(caseId: number, executor: DbExecutor): Promise<{ id: number; email: string } | null> {
  const r = await executor.execute(sql`
    SELECT u.id, u.email FROM dmca_cases c JOIN users u ON u.id = c.admin_assigned_id
    WHERE c.id = ${caseId} AND COALESCE(u.is_blocked,false) = false AND u.email IS NOT NULL AND u.email <> ''`);
  const row = r.rows[0] as any;
  return row ? { id: Number(row.id), email: String(row.email) } : null;
}

/** Returns the new alert id, or null when the dedupe key already existed. */
export async function raiseDmcaAdminAlert(input: RaiseDmcaAlertInput, executor: DbExecutor = db): Promise<number | null> {
  const ins = await executor.execute(sql`
    INSERT INTO dmca_admin_alerts (alert_type, severity, title, body, dedupe_key, dmca_case_id, user_id)
    VALUES (${input.alertType}, ${input.severity}, ${input.title}, ${input.body}, ${input.dedupeKey},
            ${input.dmcaCaseId ?? null}, ${input.userId ?? null})
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`);
  const id = (ins.rows[0] as any)?.id;
  if (id == null) return null;

  const emailTo = input.emailTo ?? "all";
  if (emailTo !== "none" && input.emailEnabled !== false) {
    let recipients: { id: number; email: string }[] = [];
    if (emailTo === "assigned" && input.dmcaCaseId != null) {
      const a = await getAssignedRecipient(input.dmcaCaseId, executor);
      if (a) recipients = [a];
    }
    if (recipients.length === 0) recipients = await getDmcaStaffRecipients(executor);
    const prefix = input.severity === "critical" ? "[CRITICAL] " : input.severity === "warning" ? "[Action needed] " : "";
    for (const r of recipients) {
      await enqueueNotification({
        eventType: `dmca.admin_alert.${input.alertType}`,
        email: { to: r.email, subject: `${prefix}DMCA: ${input.title}`, text: `${input.body}\n\nOpen the DMCA dashboard to review.` },
        dmcaCaseId: input.dmcaCaseId ?? null,
        dedupeKey: `alert:${input.dedupeKey}:u${r.id}`,
        data: { alertId: Number(id), severity: input.severity },
      }, executor);
    }
  }
  return Number(id);
}
