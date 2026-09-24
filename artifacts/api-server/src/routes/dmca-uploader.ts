import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  DmcaServiceError, DmcaValidationError, submitCounterNoticeByUploader,
} from "../dmca/dmca-service";
import { DmcaCaseStatus as S } from "../dmca/state-machine";
import { getContentTypeDef, isDmcaContentType } from "../dmca/content-registry";

const router = Router();
const counterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => ipKeyGenerator(req.ip || "unknown"),
  message: { message: "Too many counter-notice attempts. Please try again later." },
});
const route = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); }
    catch (error) {
      if (error instanceof DmcaValidationError) return res.status(400).json({ message: error.message, fieldErrors: error.fieldErrors });
      if (error instanceof DmcaServiceError) return res.status(error.statusCode).json({ message: error.message });
      next(error);
    }
  };
router.use((req, res, next) => {
  if (!req.isAuthenticated?.() || !(req.user as any)?.id) return res.status(401).json({ message: "You must be logged in" });
  next();
});

const statuses = [
  S.CONTENT_REMOVED, S.UPLOADER_NOTIFIED, S.COURT_ACTION_RECEIVED,
  S.COUNTER_NOTICE_RECEIVED, S.COUNTER_NOTICE_INCOMPLETE, S.COUNTER_NOTICE_ACCEPTED,
  S.CLAIMANT_NOTIFIED_OF_COUNTER, S.WAITING_FOR_RESTORATION_WINDOW, S.RESTORATION_ELIGIBLE,
  S.RESTORED, S.CLOSED,
] as string[];
const statusArray = sql`ARRAY[${sql.join(statuses.map((s) => sql`${s}`), sql`, `)}]::text[]`;

function publicStatus(status: string): { status: string; statusLabel: string } {
  if ([S.CONTENT_REMOVED, S.UPLOADER_NOTIFIED, S.COURT_ACTION_RECEIVED].includes(status as any)) return { status: "content_disabled", statusLabel: "Content disabled" };
  if ([S.COUNTER_NOTICE_RECEIVED, S.COUNTER_NOTICE_INCOMPLETE, S.COUNTER_NOTICE_ACCEPTED].includes(status as any)) return { status: "counter_notice_received", statusLabel: "Counter-notice received" };
  if ([S.CLAIMANT_NOTIFIED_OF_COUNTER, S.WAITING_FOR_RESTORATION_WINDOW, S.RESTORATION_ELIGIBLE].includes(status as any)) return { status: "waiting_period", statusLabel: "Waiting period in progress" };
  if (status === S.RESTORED) return { status: "content_restored", statusLabel: "Content restored" };
  return { status: "closed", statusLabel: "Closed" };
}

const contentTypeLabel = (value: string) => value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");

async function titleFor(target: any): Promise<string | null> {
  if (target.content_id == null || !isDmcaContentType(target.content_type)) return null;
  const def = getContentTypeDef(target.content_type);
  const row = (await db.execute(sql`SELECT * FROM ${sql.identifier(def.table)} WHERE id=${target.content_id}`)).rows[0] as any;
  return row ? String(row.title || row.subject || row.name || row.slug || `${contentTypeLabel(target.content_type)} #${target.content_id}`) : null;
}

async function summary(row: any, userId: number) {
  const targets = (await db.execute(sql`
    SELECT * FROM dmca_targets WHERE dmca_case_id=${row.id} AND uploader_user_id=${userId} ORDER BY id`)).rows as any[];
  const mappedItems = await Promise.all(targets.map(async (target) => ({
    contentType: target.content_type,
    contentTypeLabel: contentTypeLabel(target.content_type),
    originalUrl: target.original_url || "",
    title: await titleFor(target),
    removed: target.status === "taken_down",
  })));
  const mapped = publicStatus(row.status);
  const otherUploaders = (await db.execute(sql`SELECT 1 FROM dmca_targets
    WHERE dmca_case_id=${row.id} AND uploader_user_id IS DISTINCT FROM ${userId} LIMIT 1`)).rows.length > 0;
  const waitingPeriod = [S.CLAIMANT_NOTIFIED_OF_COUNTER, S.WAITING_FOR_RESTORATION_WINDOW, S.RESTORATION_ELIGIBLE].includes(row.status)
    ? {
        startedAt: new Date(row.claimant_counter_notified_at || row.counter_notice_received_at).toISOString(),
        earliestRestoreAt: new Date(row.restore_eligible_at).toISOString(),
        latestRestoreAt: new Date(row.restore_deadline_at).toISOString(),
      } : null;
  return {
    caseNumber: row.case_number, ...mapped,
    disabledAt: new Date(row.takedown_at).toISOString(),
    counterNoticeSubmittedAt: row.counter_notice_received_at ? new Date(row.counter_notice_received_at).toISOString() : null,
    waitingPeriod,
    restoredAt: row.restored_at ? new Date(row.restored_at).toISOString() : null,
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    items: mappedItems,
    canSubmitCounterNotice: !row.legal_hold && !row.court_action_received_at && !row.active_hold && !otherUploaders
      && [S.CONTENT_REMOVED, S.UPLOADER_NOTIFIED, S.COUNTER_NOTICE_INCOMPLETE].includes(row.status),
  };
}

async function ownedCase(caseNumber: string, userId: number) {
  return (await db.execute(sql`
    SELECT c.*, EXISTS (
      SELECT 1 FROM legal_holds h WHERE h.released_at IS NULL
        AND ((h.case_type='dmca' AND h.case_id=c.id) OR EXISTS (
          SELECT 1 FROM dmca_targets t WHERE t.dmca_case_id=c.id AND t.uploader_user_id=${userId}
            AND ((h.content_type=t.content_type AND h.content_id=t.content_id) OR h.user_id=${userId})
        ))
    ) AS active_hold FROM dmca_cases c
    WHERE c.case_number=${caseNumber} AND c.status=ANY(${statusArray}) AND c.takedown_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM dmca_targets t WHERE t.dmca_case_id=c.id AND t.uploader_user_id=${userId})
    LIMIT 1`)).rows[0] as any;
}

router.get("/my-cases", route(async (req, res) => {
  const userId = Number((req.user as any).id);
  const rows = (await db.execute(sql`
    SELECT c.*, EXISTS (
      SELECT 1 FROM legal_holds h WHERE h.released_at IS NULL
        AND ((h.case_type='dmca' AND h.case_id=c.id) OR EXISTS (
          SELECT 1 FROM dmca_targets t WHERE t.dmca_case_id=c.id AND t.uploader_user_id=${userId}
            AND ((h.content_type=t.content_type AND h.content_id=t.content_id) OR h.user_id=${userId})
        ))
    ) AS active_hold FROM dmca_cases c
    WHERE c.status=ANY(${statusArray}) AND c.takedown_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM dmca_targets t WHERE t.dmca_case_id=c.id AND t.uploader_user_id=${userId})
    ORDER BY c.takedown_at DESC, c.id DESC`)).rows as any[];
  res.json({ cases: await Promise.all(rows.map((row) => summary(row, userId))) });
}));

router.get("/my-cases/:caseNumber", route(async (req, res) => {
  const userId = Number((req.user as any).id);
  const row = await ownedCase(String(req.params.caseNumber), userId);
  if (!row) return res.status(404).json({ message: "DMCA case not found" });
  res.json({
    ...(await summary(row, userId)),
    notice: {
      receivedAt: new Date(row.received_at).toISOString(),
      claimantName: row.claimant_company || row.claimant_name || "Copyright claimant",
      copyrightedWork: row.copyright_owner_name || row.work_description || "Copyrighted work identified in the notice",
      claimDescription: row.work_description || "The claimant identified the affected material in a copyright notice.",
    },
    howToRespond: "If you believe the material was removed by mistake or misidentification, you may submit a complete counter-notice for staff review.",
    counterNoticeUrl: `/copyright-notices/${encodeURIComponent(String(row.case_number))}/counter-notice`,
    templateStatus: "pending_counsel_review",
  });
}));

router.post("/my-cases/:caseNumber/counter-notice", counterLimiter, route(async (req, res) => {
  const userId = Number((req.user as any).id);
  const row = await ownedCase(String(req.params.caseNumber), userId);
  if (!row) return res.status(404).json({ message: "DMCA case not found" });
  await submitCounterNoticeByUploader(Number(row.id), userId, req.body || {}, {
    ipAddress: req.ip || null, userAgent: req.get("user-agent") || null,
  });
  res.status(201).json({ caseNumber: row.case_number, status: "counter_notice_received" });
}));

export default router;