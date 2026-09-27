import crypto from "crypto";
import { putPrivateDocument, getPrivateDocument } from "../dmca/quarantine";
import path from "path";
import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { sql } from "drizzle-orm";
import { z, ZodError } from "zod";
import { db } from "../db";
import { requestIp, writeDmcaAudit } from "../dmca/audit";
import { addBusinessDays } from "../dmca/business-days";
import { getContentTypeDef, isDmcaContentType, type DmcaContentType } from "../dmca/content-registry";
import {
  DmcaServiceError, createCase, assignCase, addInternalNote, requestMissingInfo, transitionCase,
  approveTakedown, rejectCase, addTargetToCase, placeCaseHold, recordCounterNotice, acceptCounter,
  rejectCounter, forwardCounterNotice, recordCourtAction, restoreCase, closeCase, applyLegalHold,
  releaseLegalHold, recordRepeatInfringerDecision, moderateContent,
} from "../dmca/dmca-service";
import { InvalidDmcaTransitionError, DmcaCaseStatus as S, canTransition } from "../dmca/state-machine";
import {
  ALL_DMCA_PERMISSIONS, DMCA_ROLE_BUNDLES, DmcaPermission as P, getRequestDmcaPermissions,
  getUserDmcaPermissions, grantDmcaBundle, grantDmcaPermissions, isDmcaPermission,
  requireDmcaPermission, revokeDmcaPermissions,
} from "../dmca/permissions";
import { LegalHoldError } from "../dmca/legal-hold";
import { matchTarget } from "./dmca-public";
import { runLeakageCheck } from "../dmca/leakage-checker";

export const DMCA_ADMIN_FILTERS = {
  new: { label: "New", statuses: [S.RECEIVED] },
  needs_info: { label: "Needs Information (Awaiting Claimant Information)", statuses: [S.INCOMPLETE] },
  awaiting_review: { label: "Awaiting Review", statuses: [S.UNDER_REVIEW] },
  takedown_approved: { label: "Takedown Approved", statuses: [S.ACCEPTED] },
  content_disabled: { label: "Content Disabled", statuses: [S.CONTENT_REMOVED, S.UPLOADER_NOTIFIED] },
  counter_notice: { label: "Counter-Notice Received", statuses: [S.COUNTER_NOTICE_RECEIVED, S.COUNTER_NOTICE_INCOMPLETE, S.COUNTER_NOTICE_ACCEPTED, S.CLAIMANT_NOTIFIED_OF_COUNTER] },
  restoration_waiting: { label: "Restoration Waiting Period", statuses: [S.WAITING_FOR_RESTORATION_WINDOW, S.RESTORATION_ELIGIBLE] },
  court_hold: { label: "Court Action / Hold", statuses: [S.COURT_ACTION_RECEIVED] },
  restored: { label: "Restored", statuses: [S.RESTORED] },
  closed: { label: "Closed", statuses: [S.REJECTED, S.CLOSED] },
} as const;

const router = Router();
const required = (permission: any) => requireDmcaPermission(permission);
const actor = (req: Request) => ({ type: "admin" as const, id: Number((req.user as any).id), ipAddress: requestIp(req) });
const text = (min = 1, max = 10000) => z.string().trim().min(min).max(max);
const id = z.coerce.number().int().positive();
const camel = (row: any) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== "status_token").map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]));

function filterKey(c: any): keyof typeof DMCA_ADMIN_FILTERS {
  if (c.legal_hold || c.status === S.COURT_ACTION_RECEIVED) return "court_hold";
  return (Object.entries(DMCA_ADMIN_FILTERS).find(([, f]) => (f.statuses as readonly string[]).includes(c.status))?.[0] || "closed") as any;
}
const statusLabel = (s: string) => s.toLowerCase().split("_").map(x => x[0].toUpperCase() + x.slice(1)).join(" ");

function validate<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}
const route = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response, next: NextFunction) => {
  try { await fn(req, res); } catch (err) {
    if (err instanceof ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of err.issues) errors[issue.path.join(".") || "body"] = issue.message;
      return res.status(400).json({ message: "Validation failed", errors });
    }
    if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
    if (err instanceof DmcaServiceError || err instanceof InvalidDmcaTransitionError) {
      if (err.statusCode === 423) return res.status(423).json({ error: "legal_hold", message: err.message });
      return res.status(err.statusCode).json({ message: err.message });
    }
    next(err);
  }
};

async function caseRow(caseId: number) {
  return (await db.execute(sql`SELECT * FROM dmca_cases WHERE id=${caseId}`)).rows[0] as any;
}

async function assertTargetsAvailable(targets: Array<{ contentType: string; contentId: number | null }>) {
  for (const target of targets) {
    if (target.contentId == null) continue;
    const conflict = await db.execute(sql`
      SELECT 1 FROM dmca_targets t JOIN dmca_cases c ON c.id=t.dmca_case_id
      WHERE t.content_type=${target.contentType} AND t.content_id=${target.contentId}
        AND t.status IN ('pending','taken_down') AND c.status <> 'CLOSED' LIMIT 1`);
    if (conflict.rows.length) throw new DmcaServiceError("This item already belongs to another active DMCA case", 409);
  }
}

function actionsFor(c: any, perms: Set<any>): string[] {
  const out: string[] = [];
  if (perms.has(P.VIEW)) out.push("note");
  if (perms.has(P.REVIEW)) {
    out.push("assign");
    if ([S.RECEIVED, S.UNDER_REVIEW].includes(c.status)) out.push("request_info");
    if ([S.RECEIVED, S.INCOMPLETE].includes(c.status)) out.push("start_review");
    if ([S.RECEIVED, S.INCOMPLETE, S.UNDER_REVIEW, S.ACCEPTED].includes(c.status)) out.push("add_content");
    if ([S.RECEIVED, S.INCOMPLETE, S.UNDER_REVIEW, S.ACCEPTED].includes(c.status) && perms.has(P.TAKEDOWN)) out.push("approve_takedown");
    if ([S.RECEIVED, S.INCOMPLETE, S.UNDER_REVIEW, S.ACCEPTED].includes(c.status)) out.push("reject");
    if ([S.CONTENT_REMOVED, S.UPLOADER_NOTIFIED, S.COUNTER_NOTICE_INCOMPLETE].includes(c.status)) out.push("record_counter");
    if (c.status === S.COUNTER_NOTICE_RECEIVED) out.push("accept_counter", "reject_counter");
    if (c.status === S.COUNTER_NOTICE_ACCEPTED) out.push("forward_counter");
    if ((c.status === S.RESTORED) || [S.UPLOADER_NOTIFIED, S.COUNTER_NOTICE_INCOMPLETE, S.COURT_ACTION_RECEIVED].includes(c.status)) out.push("close");
  }
  if (perms.has(P.MANAGE_HOLDS)) {
    out.push("add_hold", "release_hold");
    if (canTransition(c.status, S.COURT_ACTION_RECEIVED)) out.push("court_action");
  }
  if (perms.has(P.RESTORE) && !c.legal_hold && !c.court_action_received_at &&
      ([S.CONTENT_REMOVED, S.UPLOADER_NOTIFIED, S.RESTORATION_ELIGIBLE].includes(c.status) ||
       (c.status === S.WAITING_FOR_RESTORATION_WINDOW && c.restore_eligible_at && new Date(c.restore_eligible_at) <= new Date()))) out.push("restore");
  return out;
}

async function detail(req: Request, caseId: number) {
  const c = await caseRow(caseId);
  if (!c) throw new DmcaServiceError("DMCA case not found", 404);
  const [submissions, targets, holds, timeline, notes] = await Promise.all([
    db.execute(sql`SELECT * FROM dmca_submissions WHERE dmca_case_id=${caseId} ORDER BY received_at,id`),
    db.execute(sql`SELECT t.*, u.username,u.full_name,u.email,u.created_at AS user_created_at,u.is_blocked FROM dmca_targets t LEFT JOIN users u ON u.id=t.uploader_user_id WHERE t.dmca_case_id=${caseId} ORDER BY t.id`),
    db.execute(sql`SELECT * FROM legal_holds WHERE case_type='dmca' AND case_id=${caseId} ORDER BY placed_at DESC`),
    db.execute(sql`SELECT a.*,u.username AS actor_name FROM dmca_audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE a.dmca_case_id=${caseId} ORDER BY a.created_at,a.id`),
    db.execute(sql`SELECT a.id,a.actor_id,u.username AS author_name,a.notes AS body,a.created_at FROM dmca_audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE a.dmca_case_id=${caseId} AND a.event='internal_note' ORDER BY a.created_at`),
  ]);
  const uploaderMap = new Map<number, any>();
  const targetDetails = [];
  for (const raw of targets.rows as any[]) {
    let preview: any = null, state = "deleted";
    if (raw.content_id != null && isDmcaContentType(raw.content_type)) {
      const def = getContentTypeDef(raw.content_type);
      const row = (await db.execute(sql`SELECT * FROM ${sql.identifier(def.table)} WHERE id=${raw.content_id}`)).rows[0] as any;
      if (row) {
        state = raw.legal_hold || row.legal_hold ? "legal_hold" : (row.visibility_status || "published");
        const title = row.title || row.subject || row.name || row.slug || `${raw.content_type} #${raw.content_id}`;
        const excerpt = String(row.content || row.description || "").replace(/<[^>]*>/g, "").slice(0, 300);
        preview = { title, excerpt, url: def.publicPath?.(row) ?? raw.original_url, ownerId: row[def.ownerColumn] ?? null };
      }
    } else state = raw.status === "taken_down" ? "dmca_hidden" : "published";
    const files = await db.execute(sql`SELECT id,file_basename,status FROM dmca_quarantined_objects WHERE dmca_target_id=${raw.id} ORDER BY id`);
    targetDetails.push({ ...camel(raw), state, onHold: state === "legal_hold", preview, quarantinedFiles: files.rows.map(camel) });
    if (raw.uploader_user_id != null && !uploaderMap.has(Number(raw.uploader_user_id))) {
      const events = await db.execute(sql`SELECT e.*,c.case_number FROM user_copyright_events e LEFT JOIN dmca_cases c ON c.id=e.dmca_case_id WHERE e.user_id=${raw.uploader_user_id} ORDER BY e.event_date DESC`);
      uploaderMap.set(Number(raw.uploader_user_id), { id: raw.uploader_user_id, username: raw.username, fullName: raw.full_name, email: raw.email, createdAt: raw.user_created_at, isBlocked: raw.is_blocked, priorEvents: events.rows.map(camel) });
    }
  }
  const perms = await getRequestDmcaPermissions(req);
  return {
    case: { ...camel(c), statusLabel: statusLabel(c.status), filterKey: filterKey(c) },
    submissions: submissions.rows.map((s: any) => ({ ...camel(s), hasDocument: !!s.original_document_path })),
    targets: targetDetails, uploaders: [...uploaderMap.values()], holds: holds.rows.map(camel),
    notes: notes.rows.map(camel),
    timeline: timeline.rows.map((a: any) => ({ id: a.id, event: a.event, actorType: a.actor_type, actorName: a.actor_name, createdAt: a.created_at, previousValue: a.previous_value, newValue: a.new_value, notes: a.notes })),
    availableActions: actionsFor(c, perms),
  };
}

router.get("/me", route(async (req, res) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ error: "Not authenticated", message: "You must be logged in to access this resource" });
  const perms = [...await getRequestDmcaPermissions(req)];
  const u = req.user as any;
  res.json({ permissions: perms, bundles: DMCA_ROLE_BUNDLES, allPermissions: ALL_DMCA_PERMISSIONS, isSiteAdmin: u.role === "admin", isModerator: u.role === "moderator" });
}));

router.get("/assignees", required(P.VIEW), route(async (_req, res) => {
  const r = await db.execute(sql`SELECT DISTINCT u.id,u.username,u.full_name FROM users u JOIN dmca_permission_grants p ON p.user_id=u.id AND p.permission='dmca.view' ORDER BY u.username`);
  res.json(r.rows.map(camel));
}));

router.get("/alerts", required(P.VIEW), route(async (req, res) => {
  const open = String(req.query.status || "open") !== "all";
  const r = await db.execute(sql`
    SELECT a.id,a.alert_type,a.severity,a.title,a.body,a.dmca_case_id,c.case_number,
           a.user_id,a.created_at,a.acknowledged_at
    FROM dmca_admin_alerts a LEFT JOIN dmca_cases c ON c.id=a.dmca_case_id
    WHERE ${open ? sql`a.acknowledged_at IS NULL` : sql`true`}
    ORDER BY a.created_at DESC`);
  res.json({ alerts: r.rows.map(camel) });
}));
router.post("/alerts/:id/acknowledge", required(P.VIEW), route(async (req, res) => {
  await db.execute(sql`UPDATE dmca_admin_alerts SET acknowledged_at=COALESCE(acknowledged_at,now()),
    acknowledged_by=COALESCE(acknowledged_by,${Number((req.user as any).id)}) WHERE id=${id.parse(req.params.id)}`);
  res.json({ ok: true });
}));
router.post("/leakage-check", required(P.REVIEW), route(async (_req, res) => {
  res.json(await runLeakageCheck({ baseUrl: `http://127.0.0.1:${process.env.PORT}` }));
}));

router.get("/cases", required(P.VIEW), route(async (req, res) => {
  const q = String(req.query.q || "").trim(), assigned = String(req.query.assigned || "");
  const page = Math.max(1, Number(req.query.page) || 1), pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const key = String(req.query.filter || "") as keyof typeof DMCA_ADMIN_FILTERS;
  const where: any[] = [];
  if (DMCA_ADMIN_FILTERS[key]) {
    const statuses = DMCA_ADMIN_FILTERS[key].statuses;
    // Drizzle does not serialize JS arrays as PG arrays: build ARRAY[...] explicitly.
    const statusArray = sql`ARRAY[${sql.join(statuses.map((s: string) => sql`${s}`), sql`, `)}]::text[]`;
    where.push(key === "court_hold" ? sql`(c.status = ANY(${statusArray}) OR c.legal_hold=true)` : sql`c.status = ANY(${statusArray})`);
  }
  if (q) where.push(sql`(c.case_number ILIKE ${`%${q}%`} OR c.claimant_name ILIKE ${`%${q}%`} OR c.claimant_email ILIKE ${`%${q}%`})`);
  if (assigned === "me") where.push(sql`c.admin_assigned_id=${Number((req.user as any).id)}`);
  else if (assigned === "unassigned") where.push(sql`c.admin_assigned_id IS NULL`);
  else if (/^\d+$/.test(assigned)) where.push(sql`c.admin_assigned_id=${Number(assigned)}`);
  const clause = where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``;
  const total = Number(((await db.execute(sql`SELECT count(*)::int n FROM dmca_cases c ${clause}`)).rows[0] as any).n);
  const rows = (await db.execute(sql`SELECT c.*,a.username assigned_username,count(t.id)::int item_count,array_remove(array_agg(DISTINCT t.content_type),NULL) item_types
    FROM dmca_cases c LEFT JOIN users a ON a.id=c.admin_assigned_id LEFT JOIN dmca_targets t ON t.dmca_case_id=c.id ${clause}
    GROUP BY c.id,a.username ORDER BY c.received_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`)).rows as any[];
  const cases = [];
  for (const c of rows) {
    const ups = (await db.execute(sql`SELECT DISTINCT u.id,u.username FROM dmca_targets t JOIN users u ON u.id=t.uploader_user_id WHERE t.dmca_case_id=${c.id}`)).rows;
    let nextDeadline = null;
    if ([S.WAITING_FOR_RESTORATION_WINDOW, S.RESTORATION_ELIGIBLE].includes(c.status)) {
      const at = c.restore_eligible_at || c.restore_deadline_at; if (at) nextDeadline = { label: "Restoration", at };
    } else if ([S.RECEIVED, S.UNDER_REVIEW].includes(c.status)) nextDeadline = { label: "Review notice", at: addBusinessDays(new Date(c.received_at), 1) };
    cases.push({ id: c.id, caseNumber: c.case_number, status: c.status, statusLabel: statusLabel(c.status), filterKey: filterKey(c), receivedAt: c.received_at, submittedVia: c.submitted_via, claimantName: c.claimant_name, itemCount: c.item_count, itemTypes: c.item_types, uploaders: ups, nextDeadline, assignedAdmin: c.admin_assigned_id ? { id: c.admin_assigned_id, username: c.assigned_username } : null, legalHold: c.legal_hold });
  }
  const all = (await db.execute(sql`SELECT status,legal_hold,count(*)::int n FROM dmca_cases GROUP BY status,legal_hold`)).rows as any[];
  // Counts use the same membership rule as the list filter (a held case also counts under Court Action / Hold).
  const inFilter = (k: string, r: any) => (DMCA_ADMIN_FILTERS as any)[k].statuses.includes(r.status) || (k === "court_hold" && r.legal_hold === true);
  const counts = Object.fromEntries(Object.keys(DMCA_ADMIN_FILTERS).map(k => [k, all.filter(r => inFilter(k, r)).reduce((n, r) => n + Number(r.n), 0)]));
  res.json({ cases, total, counts });
}));

router.get("/cases/:id", required(P.VIEW), route(async (req, res) => res.json(await detail(req, id.parse(req.params.id)))));

const manualSchema = z.object({
  submittedVia: z.enum(["email", "mail", "phone", "fax"]), receivedAt: z.coerce.date(),
  claimantName: text(1, 200), claimantCompany: z.string().optional(), claimantEmail: z.string().email().optional().or(z.literal("")),
  claimantPhone: z.string().optional(), claimantAddress: z.string().optional(), claimantRole: z.enum(["owner", "agent"]),
  copyrightOwnerName: z.string().optional(), workTitle: text(1, 500), workDescription: z.string().optional(),
  urls: z.array(z.string().url()).min(1), statements: z.object({ goodFaith: z.boolean(), accuracyPerjury: z.boolean() }),
  signature: z.string().optional(), notes: z.string().optional(), originalDocumentPath: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.submittedVia === "phone" && !v.notes?.trim()) ctx.addIssue({ code: "custom", path: ["notes"], message: "Call summary is required" });
  if (v.submittedVia !== "phone" && !v.originalDocumentPath) ctx.addIssue({ code: "custom", path: ["originalDocumentPath"], message: "Original document is required" });
});
router.post("/cases", required(P.CREATE), multer().none(), route(async (req, res) => {
  const b = validate(manualSchema, req.body);
  const targets = await Promise.all(b.urls.map(async u => matchTarget(db, new URL(u))));
  await assertTargetsAvailable(targets);
  const result = await createCase({
    receivedAt: b.receivedAt, submittedVia: b.submittedVia, actor: actor(req),
    claimant: { name: b.claimantName, company: b.claimantCompany, email: b.claimantEmail || null, phone: b.claimantPhone, address: b.claimantAddress, role: b.claimantRole, copyrightOwnerName: b.copyrightOwnerName, workDescription: b.workDescription },
    targets, enforceActiveTargets: true, submission: { submissionType: "notice", submittedByName: b.claimantName, signatureValue: b.signature, originalDocumentPath: b.originalDocumentPath, ipAddress: requestIp(req), formPayload: { ...b, originalDocumentPath: undefined } },
  });
  res.status(201).json({ id: result.id, caseNumber: result.caseNumber });
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, /^(application\/pdf|image\/|message\/rfc822|text\/plain|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)/.test(f.mimetype)) });
router.post("/files", required(P.CREATE), upload.single("file"), route(async (req, res) => {
  if (!req.file) throw new DmcaServiceError("A supported file is required");
  const name = `${Date.now()}-${crypto.randomUUID()}-${req.file.originalname.replace(/[^\w.-]/g, "_")}`;
  await putPrivateDocument(name, req.file.buffer);
  const privatePath = `dmca/${name}`;
  await writeDmcaAudit({ event: "document_uploaded", actorType: "admin", actorId: Number((req.user as any).id), ipAddress: requestIp(req), targetType: "dmca_file", notes: privatePath, newValue: { path: privatePath, size: req.file.size, mime: req.file.mimetype } });
  res.status(201).json({ path: privatePath });
}));
const fileSig = (p: string, exp: number, uid: number) => crypto.createHmac("sha256", process.env.SESSION_SECRET || "dev_session_secret").update(`${p}:${exp}:${uid}`).digest("base64url");
/** Validates a `dmca/<name>` document path (no traversal: a single safe segment) and returns the object name. */
function privateFileName(value: string): string {
  if (!/^dmca\/[\w][\w.-]*$/.test(value) || value.includes("..")) throw new DmcaServiceError("Invalid file path");
  return value.slice("dmca/".length);
}
function contentTypeFor(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ({ ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".eml": "message/rfc822", ".txt": "text/plain", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } as Record<string, string>)[ext] ?? "application/octet-stream";
}
router.get("/files/download", required(P.VIEW_PRIVATE_FILES), route(async (req, res) => {
  const p = String(req.query.path || ""), exp = Number(req.query.exp), sig = String(req.query.sig || ""), uid = Number((req.user as any).id);
  if (exp < Date.now() || sig !== fileSig(p, exp, uid)) return res.status(403).json({ message: "Invalid or expired file link" });
  const name = privateFileName(p);
  const data = await getPrivateDocument(name);
  if (!data) return res.status(404).json({ message: "File not found" });
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", contentTypeFor(name));
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
  res.send(data);
}));
router.get("/files", required(P.VIEW_PRIVATE_FILES), route(async (req, res) => {
  const p = String(req.query.path || "");
  if (!(await getPrivateDocument(privateFileName(p)))) return res.status(404).json({ message: "File not found" });
  const exp = Date.now() + 5 * 60_000, uid = Number((req.user as any).id);
  await writeDmcaAudit({ event: "private_file_link_issued", actorType: "admin", actorId: uid, ipAddress: requestIp(req), targetType: "dmca_file", notes: p, newValue: { expiresAt: new Date(exp) } });
  res.json({ url: `/api/admin/dmca/files/download?path=${encodeURIComponent(p)}&exp=${exp}&sig=${fileSig(p, exp, uid)}`, expiresAt: new Date(exp) });
}));

const returnDetail = (permission: any, handler: (req: Request, caseId: number) => Promise<any>) => [
  required(permission), route(async (req, res) => { const caseId = id.parse(req.params.id); const extra = await handler(req, caseId); res.json({ ...(await detail(req, caseId)), ...(extra || {}) }); }),
] as any;
router.patch("/cases/:id/assign", ...returnDetail(P.REVIEW, async (r, i) => assignCase(i, z.object({ adminId: id.nullable() }).parse(r.body).adminId, actor(r))));
router.post("/cases/:id/notes", ...returnDetail(P.VIEW, async (r, i) => addInternalNote(i, z.object({ body: text() }).parse(r.body).body, actor(r))));
router.post("/cases/:id/request-info", ...returnDetail(P.REVIEW, async (r, i) => {
  const b = z.object({ reasons: z.array(z.enum(["work_id","url","contact","statement","signature","other"])).min(1), otherText: z.string().optional(), message: z.string().optional() }).refine(v => !v.reasons.includes("other") || !!v.otherText?.trim(), { path: ["otherText"], message: "Required for other" }).parse(r.body);
  return requestMissingInfo(i, b, actor(r));
}));
router.post("/cases/:id/start-review", ...returnDetail(P.REVIEW, async (r, i) => transitionCase(i, S.UNDER_REVIEW, actor(r))));
router.post("/cases/:id/approve-takedown", required(P.REVIEW), ...returnDetail(P.TAKEDOWN, async (r, i) => { const b=z.object({reason:text(),notifyUploader:z.boolean().default(true)}).parse(r.body); return approveTakedown(i,actor(r),b.reason,b.notifyUploader); }));
router.post("/cases/:id/reject", ...returnDetail(P.REVIEW, async (r,i)=>{const b=z.object({reason:text()}).parse(r.body);return rejectCase(i,b.reason,actor(r));}));
router.post("/cases/:id/targets", ...returnDetail(P.REVIEW, async (r,i)=>{ const b=z.union([z.object({url:z.string().url()}),z.object({contentType:z.string(),contentId:id})]).parse(r.body); const t="url" in b?await matchTarget(db,new URL(b.url)):{contentType:b.contentType as DmcaContentType,contentId:b.contentId}; return addTargetToCase(i,t,actor(r)); }));
router.post("/cases/:id/holds", ...returnDetail(P.MANAGE_HOLDS, async(r,i)=>placeCaseHold(i,z.object({reason:text()}).parse(r.body).reason,actor(r))));
router.post("/cases/:id/counter-notice", ...returnDetail(P.REVIEW, async(r,i)=>recordCounterNotice(i,z.object({receivedAt:z.coerce.date(),submittedVia:text(),name:text(),address:text(),phone:text(),email:z.string().email().optional(),materialIdentification:text(),goodFaithStatement:z.literal(true),jurisdictionConsent:z.literal(true),signature:text(),originalDocumentPath:z.string().optional(),notes:z.string().optional()}).parse(r.body),actor(r))));
router.post("/cases/:id/counter-notice/accept", ...returnDetail(P.REVIEW, async(r,i)=>acceptCounter(i,actor(r))));
router.post("/cases/:id/counter-notice/reject", ...returnDetail(P.REVIEW, async(r,i)=>rejectCounter(i,z.object({reason:text()}).parse(r.body).reason,actor(r))));
router.post("/cases/:id/counter-notice/forward", ...returnDetail(P.REVIEW, async(r,i)=>forwardCounterNotice(i,actor(r))));
router.post("/cases/:id/court-action", ...returnDetail(P.MANAGE_HOLDS, async(r,i)=>{const b=z.object({notes:z.string().optional(),documentPath:z.string().optional()}).refine(v=>v.notes?.trim()||v.documentPath,{message:"Notes or document is required"}).parse(r.body); return recordCourtAction({caseId:i,actor:actor(r),submission:{formPayload:{notes:b.notes},submittedByName:(r.user as any).username,originalDocumentPath:b.documentPath,ipAddress:requestIp(r)},reason:b.notes});}));
router.post("/cases/:id/restore", ...returnDetail(P.RESTORE, async(r,i)=>{const b=z.object({reason:text(),mode:z.enum(["counter_notice","notice_withdrawn"])}).parse(r.body);return restoreCase({caseId:i,actor:actor(r),reason:b.reason,mode:b.mode});}));
router.post("/cases/:id/close", ...returnDetail(P.REVIEW, async(r,i)=>{const b=z.object({outcome:z.enum(["removed","restored"]),notes:z.string().optional()}).parse(r.body);return closeCase(i,b.outcome,b.notes,actor(r));}));

router.get("/holds", required(P.MANAGE_HOLDS), route(async(req,res)=>{const active=String(req.query.active??"true")==="true";const r=await db.execute(sql`SELECT h.*,c.case_number,u.username,p.username placed_by_name,rel.username released_by_name FROM legal_holds h LEFT JOIN dmca_cases c ON c.id=h.case_id AND h.case_type='dmca' LEFT JOIN users u ON u.id=h.user_id LEFT JOIN users p ON p.id=h.placed_by LEFT JOIN users rel ON rel.id=h.released_by WHERE ${active?sql`h.released_at IS NULL`:sql`h.released_at IS NOT NULL`} ORDER BY h.placed_at DESC`);res.json(r.rows.map(camel));}));
router.post("/holds", required(P.MANAGE_HOLDS), route(async(req,res)=>{const b=z.object({target:z.enum(["user","content","case"]),userId:id.optional(),contentType:z.string().optional(),contentId:id.optional(),caseId:id.optional(),reason:text()}).parse(req.body);if(b.target==="case"){if(!b.caseId)throw new DmcaServiceError("caseId is required");await placeCaseHold(b.caseId,b.reason,actor(req));}else await applyLegalHold({userId:b.userId,contentType:b.contentType as any,contentId:b.contentId,reason:b.reason,actor:actor(req)});res.status(201).json({ok:true});}));
router.post("/holds/:holdId/release", required(P.MANAGE_HOLDS), route(async(req,res)=>{const holdId=id.parse(req.params.holdId),hold=(await db.execute(sql`SELECT case_type,case_id FROM legal_holds WHERE id=${holdId}`)).rows[0] as any;await releaseLegalHold({holdId,actor:actor(req),reason:z.object({reason:text()}).parse(req.body).reason});if(hold?.case_type==="dmca"&&hold.case_id)return res.json(await detail(req,Number(hold.case_id)));res.json({ok:true});}));

router.get("/repeat-infringers", required(P.MANAGE_REPEAT_INFRINGER), route(async(_req,res)=>{const settings=(await db.execute(sql`SELECT * FROM dmca_settings WHERE id=1`)).rows[0] as any;const months=settings.repeat_infringer_window_months, threshold=settings.repeat_infringer_threshold;const rows=(await db.execute(sql`SELECT u.id,u.username,u.full_name,u.email,u.is_blocked,json_agg(e ORDER BY e.event_date DESC) events,count(*) FILTER(WHERE e.counts_toward_repeat_policy AND e.status='active')::int active_strikes,count(*)::int total_events,max(e.event_date) last_event_at, (r.opened_at IS NOT NULL) in_review, r.opened_at review_opened_at FROM users u JOIN user_copyright_events e ON e.user_id=u.id LEFT JOIN LATERAL (SELECT opened_at FROM dmca_repeat_infringer_reviews WHERE user_id=u.id AND status='open' LIMIT 1) r ON true WHERE e.event_date >= now()-(${months}||' months')::interval GROUP BY u.id,r.opened_at ORDER BY (count(*) FILTER(WHERE e.counts_toward_repeat_policy AND e.status='active') >= ${threshold}) DESC,max(e.event_date) DESC`)).rows as any[];res.json({threshold,windowMonths:months,users:rows.map(r=>{const events=((r.events as any[])||[]).map(camel);return{...camel(r),events,inReview:!!r.in_review,reviewOpenedAt:r.review_opened_at??null,overThreshold:r.active_strikes>=threshold,lastDecision:events.find(e=>!e.countsTowardRepeatPolicy)||null};})});}));
router.post("/repeat-infringers/:userId/decision", required(P.MANAGE_REPEAT_INFRINGER), route(async(req,res)=>{const b=z.object({decision:z.enum(["warning","dismiss","suspend","terminate"]),notes:text()}).parse(req.body);await recordRepeatInfringerDecision(id.parse(req.params.userId),b.decision,b.notes,actor(req));res.json({ok:true});}));

async function settingsResponse(){const r=(await db.execute(sql`SELECT * FROM dmca_settings WHERE id=1`)).rows[0] as any;return{agent:{name:r.agent_name,organization:r.agent_organization,address:r.agent_address,phone:r.agent_phone,email:r.agent_email},registrationNumber:r.registration_number,registrationExpiresAt:r.registration_expires_at,repeatInfringerThreshold:r.repeat_infringer_threshold,repeatInfringerWindowMonths:r.repeat_infringer_window_months,reminderOffsets:r.reminder_offsets,policySections:r.policy_sections};}
router.get("/settings", required(P.MANAGE_PERMISSIONS), route(async(_r,res)=>res.json(await settingsResponse())));
router.put("/settings", required(P.MANAGE_PERMISSIONS), route(async(req,res)=>{const b=z.object({agent:z.object({name:z.string(),organization:z.string(),address:z.string(),phone:z.string(),email:z.string()}),registrationNumber:z.string().nullable().optional(),registrationExpiresAt:z.coerce.date().nullable().optional(),repeatInfringerThreshold:z.number().int().positive(),repeatInfringerWindowMonths:z.number().int().positive(),reminderOffsets:z.any(),policySections:z.any()}).parse(req.body);await db.transaction(async tx=>{const old=(await tx.execute(sql`SELECT * FROM dmca_settings WHERE id=1 FOR UPDATE`)).rows[0];await tx.execute(sql`UPDATE dmca_settings SET agent_name=${b.agent.name},agent_organization=${b.agent.organization},agent_address=${b.agent.address},agent_phone=${b.agent.phone},agent_email=${b.agent.email},registration_number=${b.registrationNumber},registration_expires_at=${b.registrationExpiresAt},repeat_infringer_threshold=${b.repeatInfringerThreshold},repeat_infringer_window_months=${b.repeatInfringerWindowMonths},reminder_offsets=${JSON.stringify(b.reminderOffsets)}::jsonb,policy_sections=${JSON.stringify(b.policySections)}::jsonb,updated_by=${Number((req.user as any).id)},updated_at=now() WHERE id=1`);await writeDmcaAudit({event:"settings_updated",actorType:"admin",actorId:Number((req.user as any).id),ipAddress:requestIp(req),targetType:"dmca_settings",targetId:1,previousValue:old as any,newValue:b},tx);});res.json(await settingsResponse());}));

router.get("/permissions", required(P.MANAGE_PERMISSIONS), route(async(_r,res)=>{const rows=(await db.execute(sql`SELECT u.id,u.username,u.full_name,u.role,array_remove(array_agg(p.permission),NULL) permissions FROM users u LEFT JOIN dmca_permission_grants p ON p.user_id=u.id WHERE p.id IS NOT NULL OR u.role IN ('admin','moderator') GROUP BY u.id ORDER BY u.username`)).rows;res.json({users:rows.map(camel)});}));
router.get("/permissions/search", required(P.MANAGE_PERMISSIONS), route(async(req,res)=>{const q=`%${String(req.query.q||"").trim()}%`;const r=await db.execute(sql`SELECT id,username,full_name,role,email FROM users WHERE username ILIKE ${q} OR full_name ILIKE ${q} OR email ILIKE ${q} ORDER BY username LIMIT 30`);res.json(r.rows.map(camel));}));
router.post("/permissions/:userId/grant", required(P.MANAGE_PERMISSIONS), route(async(req,res)=>{const b=z.object({bundle:z.enum(["moderator","dmca_admin","legal_admin"]).optional(),permissions:z.array(z.string()).optional()}).refine(v=>v.bundle||v.permissions?.length).parse(req.body),uid=id.parse(req.params.userId);await db.transaction(async tx=>{if(b.bundle)await grantDmcaBundle({userId:uid,bundle:b.bundle,grantedBy:Number((req.user as any).id),ipAddress:requestIp(req)},tx);if(b.permissions)await grantDmcaPermissions({userId:uid,permissions:b.permissions.filter(isDmcaPermission),grantedBy:Number((req.user as any).id),ipAddress:requestIp(req)},tx);});res.json({ok:true});}));
router.post("/permissions/:userId/revoke", required(P.MANAGE_PERMISSIONS), route(async(req,res)=>{const b=z.object({permissions:z.array(z.string()).min(1)}).parse(req.body),uid=id.parse(req.params.userId),perms=b.permissions.filter(isDmcaPermission);if(perms.includes(P.MANAGE_PERMISSIONS)){const n=Number(((await db.execute(sql`SELECT count(DISTINCT user_id)::int n FROM dmca_permission_grants WHERE permission=${P.MANAGE_PERMISSIONS} AND user_id<>${uid}`)).rows[0] as any).n);if(!n)throw new DmcaServiceError("Cannot remove the last holder of dmca.manage_permissions",409);}await db.transaction(tx=>revokeDmcaPermissions({userId:uid,permissions:perms,revokedBy:Number((req.user as any).id),ipAddress:requestIp(req)},tx));res.json({ok:true});}));

async function contentStatus(type:string,contentId:number){if(!isDmcaContentType(type)||type==="avatar")throw new DmcaServiceError("Unknown content type",404);const def=getContentTypeDef(type);const row=(await db.execute(sql`SELECT * FROM ${sql.identifier(def.table)} WHERE id=${contentId}`)).rows[0] as any;if(!row)throw new DmcaServiceError("Content not found",404);const active=(await db.execute(sql`SELECT c.id,c.case_number,c.status FROM dmca_targets t JOIN dmca_cases c ON c.id=t.dmca_case_id WHERE t.content_type=${type} AND t.content_id=${contentId} AND c.status<>'CLOSED' ORDER BY c.id DESC LIMIT 1`)).rows[0] as any;return{row,active};}
const recoveryTypes = ["forum_post", "forum_comment", "event", "event_comment", "listing", "page", "vendor_comment"] as const;
type RecoveryType = typeof recoveryTypes[number];
const recoveryFields: Record<RecoveryType, { label: string; search: string; parent: string }> = {
  forum_post: { label: "p.title", search: "p.title || ' ' || p.content", parent: "NULL::text" },
  forum_comment: { label: "p.content", search: "p.content", parent: "p.post_id::text" },
  event: { label: "p.title", search: "p.title || ' ' || COALESCE(p.description,'')", parent: "NULL::text" },
  event_comment: { label: "p.content", search: "p.content", parent: "p.event_id::text" },
  listing: { label: "p.title", search: "p.title || ' ' || COALESCE(p.description,'')", parent: "NULL::text" },
  page: { label: "p.title", search: "p.title || ' ' || p.slug || ' ' || p.content", parent: "p.slug" },
  vendor_comment: { label: "p.content", search: "p.content || ' ' || p.page_slug", parent: "p.page_slug" },
};
router.get("/moderated-content", route(async (req, res) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Not authenticated" });
  if (!["admin", "moderator"].includes((req.user as any).role)) return res.status(403).json({ message: "Site admin or moderator required" });
  const { q, page, type } = z.object({
    q: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    type: z.enum(["all", ...recoveryTypes]).default("all"),
  }).parse(req.query);
  const search = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const exactId = /^\d+$/.test(q) ? Number(q) : -1;
  const types = type === "all" ? recoveryTypes : [type];
  const branches = types.map(t => {
    const def = getContentTypeDef(t);
    const fields = recoveryFields[t];
    return sql`SELECT ${t}::text AS content_type,p.id,
      left(${sql.raw(fields.label)}, 180) AS title,${sql.raw(fields.parent)} AS parent_ref,
      p.visibility_status,p.hidden_reason,p.hidden_at,p.legal_hold,p.dmca_case_id,
      u.username AS author_name,
      EXISTS(SELECT 1 FROM legal_holds h WHERE h.content_type=${t} AND h.content_id=p.id AND h.released_at IS NULL) AS active_hold,
      EXISTS(SELECT 1 FROM dmca_targets d JOIN dmca_cases c ON c.id=d.dmca_case_id
        WHERE d.content_type=${t} AND d.content_id=p.id AND c.status NOT IN ('CLOSED','REJECTED','RESTORED')) AS active_dmca_case
      FROM ${sql.identifier(def.table)} p LEFT JOIN users u ON u.id=p.${sql.identifier(def.ownerColumn)}
      WHERE p.visibility_status='moderation_hidden'
        AND (${q === ""} OR p.id=${exactId} OR ${sql.raw(fields.search)} ILIKE ${search} ESCAPE '\\')`;
  });
  // Identifiers and search expressions above come only from this fixed server-side allowlist.
  const combined = sql.join(branches, sql` UNION ALL `);
  const total = Number((await db.execute(sql`SELECT count(*)::int AS total FROM (${combined}) hidden`)).rows[0]?.total ?? 0);
  const rows = (await db.execute(sql`
    SELECT * FROM (${combined}) hidden ORDER BY hidden_at DESC NULLS LAST,content_type,id DESC
    LIMIT 20 OFFSET ${(page - 1) * 20}
  `)).rows as any[];
  res.json({
    items: rows.map(row => {
      const t = row.content_type as RecoveryType;
      const ref = row.parent_ref;
      const { parent_ref: _parentRef, ...visibleFields } = row;
      const pathRow = { id: row.id, post_id: ref, event_id: ref, slug: ref, page_slug: ref };
      return { ...camel(visibleFields), title: String(row.title || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "(No text)",
        publicPath: getContentTypeDef(t).publicPath?.(pathRow) ?? null };
    }),
    total, page, pageSize: 20,
  });
}));
router.get("/moderated-posts", route(async (req, res) => {
  if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Not authenticated" });
  if (!["admin", "moderator"].includes((req.user as any).role)) return res.status(403).json({ message: "Site admin or moderator required" });
  const { q, page } = z.object({
    q: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  }).parse(req.query);
  const search = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const exactId = /^\d+$/.test(q) ? Number(q) : -1;
  const where = sql`p.visibility_status='moderation_hidden' AND (${q === ""} OR p.title ILIKE ${search} ESCAPE '\\' OR p.id=${exactId})`;
  const total = Number((await db.execute(sql`SELECT count(*)::int AS total FROM forum_posts p WHERE ${where}`)).rows[0]?.total ?? 0);
  const rows = (await db.execute(sql`
    SELECT p.id,p.title,p.visibility_status,p.hidden_reason,p.hidden_at,p.legal_hold,p.dmca_case_id,
      u.username AS author_name,
      EXISTS(SELECT 1 FROM legal_holds h WHERE h.content_type='forum_post' AND h.content_id=p.id AND h.released_at IS NULL) AS active_hold,
      EXISTS(SELECT 1 FROM dmca_targets t JOIN dmca_cases c ON c.id=t.dmca_case_id
        WHERE t.content_type='forum_post' AND t.content_id=p.id AND c.status NOT IN ('CLOSED','REJECTED','RESTORED')) AS active_dmca_case
    FROM forum_posts p LEFT JOIN users u ON u.id=p.user_id
    WHERE ${where} ORDER BY p.hidden_at DESC NULLS LAST,p.id DESC LIMIT 20 OFFSET ${(page - 1) * 20}
  `)).rows;
  res.json({ posts: rows.map(camel), total, page, pageSize: 20 });
}));
router.get("/content/:type/:id/status", route(async(req,res)=>{if(!req.isAuthenticated?.())return res.status(401).json({message:"Not authenticated"});const u=req.user as any,perms=await getRequestDmcaPermissions(req);if(!["admin","moderator"].includes(u.role)&&!perms.has(P.VIEW))return res.status(403).json({message:"Not permitted"});const {row,active}=await contentStatus(req.params.type,id.parse(req.params.id));res.json({visibilityStatus:row.visibility_status,legalHold:row.legal_hold,activeCase:active?camel(active):null,canHide:["admin","moderator"].includes(u.role),canDmca:perms.has(active?P.REVIEW:P.CREATE),canFlag:perms.has(P.FLAG),canPermanentDelete:perms.has(P.PERMANENT_DELETE)});}));
router.post("/content/:type/:id/moderate", route(async(req,res)=>{if(!req.isAuthenticated?.())return res.status(401).json({message:"Not authenticated"});if(!["admin","moderator"].includes((req.user as any).role))return res.status(403).json({message:"Site admin or moderator required"});const b=z.object({hidden:z.boolean(),reason:text()}).parse(req.body);await moderateContent(req.params.type as any,id.parse(req.params.id),b.hidden,b.reason,actor(req));res.json({ok:true});}));
router.post("/content/:type/:id/dmca", route(async(req,res)=>{if(!req.isAuthenticated?.())return res.status(401).json({message:"Not authenticated"});const contentId=id.parse(req.params.id),type=req.params.type as any,b=z.union([z.object({caseId:id}),z.object({newCase:z.object({claimantName:text(),claimantEmail:z.string().email().optional(),submittedVia:z.string(),notes:z.string().optional()})})]).parse(req.body),perms=await getRequestDmcaPermissions(req);if("caseId"in b){if(!perms.has(P.REVIEW))return res.status(403).json({message:"Missing permission: dmca.review"});await addTargetToCase(b.caseId,{contentType:type,contentId},actor(req));const c=await caseRow(b.caseId);return res.json({caseId:b.caseId,caseNumber:c.case_number});}if(!perms.has(P.CREATE))return res.status(403).json({message:"Missing permission: dmca.create"});await assertTargetsAvailable([{contentType:type,contentId}]);const c=await createCase({actor:actor(req),submittedVia:"admin_entry",claimant:{name:b.newCase.claimantName,email:b.newCase.claimantEmail},targets:[{contentType:type,contentId}],enforceActiveTargets:true,submission:{submissionType:"notice",submittedByName:b.newCase.claimantName,formPayload:b.newCase}});res.json({caseId:c.id,caseNumber:c.caseNumber});}));
router.post("/content/:type/:id/flag", required(P.FLAG), route(async(req,res)=>{const contentId=id.parse(req.params.id),type=req.params.type;if(!isDmcaContentType(type)||type==="avatar")throw new DmcaServiceError("Unknown content type");await contentStatus(type,contentId);const reason=z.object({reason:text()}).parse(req.body).reason;const r=await db.transaction(async tx=>{const ins=await tx.execute(sql`INSERT INTO dmca_content_flags(content_type,content_id,reason,flagged_by) VALUES(${type},${contentId},${reason},${Number((req.user as any).id)}) RETURNING id`);const fid=Number((ins.rows[0]as any).id);await writeDmcaAudit({event:"content_flagged_for_dmca",actorType:"admin",actorId:Number((req.user as any).id),targetType:type,targetId:contentId,ipAddress:requestIp(req),newValue:{flagId:fid},notes:reason},tx);return fid;});res.status(201).json({id:r});}));
router.get("/flags", required(P.VIEW), route(async(req,res)=>{const open=String(req.query.open??"true")==="true";const r=await db.execute(sql`SELECT f.*,u.username AS flagged_by_name,c.case_number FROM dmca_content_flags f LEFT JOIN users u ON u.id=f.flagged_by LEFT JOIN dmca_cases c ON c.id=f.dmca_case_id WHERE ${open?sql`f.resolved_at IS NULL`:sql`f.resolved_at IS NOT NULL`} ORDER BY f.flagged_at DESC`);res.json(r.rows.map(camel));}));
router.post("/flags/:id/resolve", required(P.REVIEW), route(async(req,res)=>{const flagId=id.parse(req.params.id),b=z.object({resolution:z.enum(["added_to_case","dismissed"]),caseId:id.optional()}).refine(v=>v.resolution!=="added_to_case"||v.caseId,{path:["caseId"],message:"caseId is required"}).parse(req.body);const f=(await db.execute(sql`SELECT * FROM dmca_content_flags WHERE id=${flagId}`)).rows[0]as any;if(!f)throw new DmcaServiceError("Flag not found",404);if(f.resolved_at)throw new DmcaServiceError("Flag already resolved",409);if(b.resolution==="added_to_case")await addTargetToCase(b.caseId!,{contentType:f.content_type,contentId:f.content_id},actor(req));await db.transaction(async tx=>{const updated=await tx.execute(sql`UPDATE dmca_content_flags SET resolved_at=now(),resolved_by=${Number((req.user as any).id)},resolution=${b.resolution},dmca_case_id=${b.caseId??null} WHERE id=${flagId} AND resolved_at IS NULL`);if(!updated.rowCount)throw new DmcaServiceError("Flag already resolved",409);await writeDmcaAudit({event:"dmca_content_flag_resolved",actorType:"admin",actorId:Number((req.user as any).id),dmcaCaseId:b.caseId,targetType:f.content_type,targetId:f.content_id,ipAddress:requestIp(req),newValue:{resolution:b.resolution,flagId}},tx);});res.json({ok:true});}));

export default router;