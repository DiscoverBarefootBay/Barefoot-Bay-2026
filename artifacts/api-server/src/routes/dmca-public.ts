import { Router, type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { logger } from "../lib/logger";
import { createCase, type TargetInput } from "../dmca/dmca-service";
import { CONTENT_TYPES, extractStoredFileUrls, type DmcaContentType } from "../dmca/content-registry";
import { DmcaPermission, getRequestDmcaPermissions, requireDmcaPermission } from "../dmca/permissions";
import { requestIp, writeDmcaAudit, type DbExecutor } from "../dmca/audit";
import { enqueueNotification } from "../dmca/outbox";
import { adminNoticeEmail, claimantNoticeEmail } from "../dmca/email-templates";
import { DEFAULT_DMCA_POLICY_SECTIONS, DMCA_POLICY_KEYS, mergePolicySections } from "../dmca/policy-defaults";

const router = Router();
// req.ip honours the app's "trust proxy" hop count, so a client-supplied
// X-Forwarded-For cannot rotate the limiter key.
const keyGenerator = (req: Request) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || "unknown");
const noticeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false }, keyGenerator,
  message: { message: "Too many copyright notice submissions. Please try again later." },
});
const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false }, keyGenerator,
  message: { message: "Too many status requests. Please try again later." },
});

const trimmed = (min: number, max: number, label: string) =>
  z.string({ error: `${label} is required` }).trim().min(min, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
export const dmcaPublicNoticeSchema = z.object({
  name: trimmed(2, 200, "Name"),
  company: optionalText(200),
  email: z.string({ error: "Email is required" }).trim().email("Enter a valid email address").max(320),
  phone: trimmed(5, 60, "Phone"),
  address: trimmed(5, 1000, "Address"),
  role: z.enum(["owner", "agent"], { error: "Select whether you are the owner or an authorized agent" }),
  copyrightOwnerName: optionalText(200),
  workTitle: trimmed(1, 500, "Work title"),
  workDescription: trimmed(10, 5000, "Work description"),
  referenceUrl: z.string().trim().url("Reference URL must be a valid URL").max(2000).optional().or(z.literal("").transform(() => undefined)),
  infringingUrls: z.array(z.string()).min(1, "Provide at least one infringing URL").max(50, "No more than 50 URLs may be submitted"),
  additionalInfo: optionalText(10000),
  goodFaith: z.literal(true, { error: "You must affirm the good-faith statement" }),
  accuracyPerjury: z.literal(true, { error: "You must affirm the accuracy and authority statement" }),
  signature: trimmed(2, 200, "Signature"),
  recaptchaToken: trimmed(1, 4096, "CAPTCHA verification"),
}).strict().superRefine((value, ctx) => {
  if (value.role === "agent" && !value.copyrightOwnerName) {
    ctx.addIssue({ code: "custom", path: ["copyrightOwnerName"], message: "Copyright owner name is required for an agent" });
  }
});

const sectionSchema = z.object({
  key: z.enum(DMCA_POLICY_KEYS as [string, ...string[]]),
  title: trimmed(1, 200, "Section title"),
  body: z.string().trim().max(20000, "Section body is too long"),
  pendingCounselReview: z.boolean(),
}).strict();
const settingsSchema = z.object({
  agent: z.object({
    name: z.string().trim().max(200),
    organization: z.string().trim().max(200),
    address: z.string().trim().max(1000),
    phone: z.string().trim().max(60),
    email: z.string().trim().email("Enter a valid agent email").max(320).or(z.literal("")),
  }).strict(),
  sections: z.array(sectionSchema).length(DEFAULT_DMCA_POLICY_SECTIONS.length),
}).strict().superRefine((value, ctx) => {
  const keys = value.sections.map((s) => s.key);
  if (new Set(keys).size !== DMCA_POLICY_KEYS.length || DMCA_POLICY_KEYS.some((key) => !keys.includes(key))) {
    ctx.addIssue({ code: "custom", path: ["sections"], message: "Every policy section must appear exactly once" });
  }
});

type RecaptchaVerifier = (token: string, ip: string | null) => Promise<boolean>;
let injectedRecaptchaVerifier: RecaptchaVerifier | null = null;
/** Test seam; production callers should never set this. */
export function setDmcaRecaptchaVerifierForTests(verifier: RecaptchaVerifier | null): void {
  injectedRecaptchaVerifier = verifier;
}

async function verifyRecaptcha(token: string, ip: string | null): Promise<boolean> {
  if (injectedRecaptchaVerifier) return injectedRecaptchaVerifier(token, ip);
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "true") return false;
    logger.warn("[DMCA] RECAPTCHA_SECRET_KEY is not configured; skipping verification outside production");
    return true;
  }
  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const result = await response.json() as { success?: boolean };
    return response.ok && result.success === true;
  } catch (error) {
    logger.error({ err: error }, "[DMCA] reCAPTCHA verification failed");
    return false;
  }
}

function baseUrl(): string {
  const value = process.env.APP_BASE_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://barefootbay.com");
  return value.replace(/\/+$/, "");
}

function allowedHosts(): Set<string> {
  const hosts = new Set(["barefootbay.com", "www.barefootbay.com"]);
  for (const raw of [process.env.APP_BASE_URL, process.env.REPLIT_DEV_DOMAIN, ...(process.env.REPLIT_DOMAINS || "").split(",")]) {
    if (!raw?.trim()) continue;
    try { hosts.add(new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase()); } catch { /* ignore malformed environment entries */ }
  }
  return hosts;
}

function normalizeReportedUrl(raw: string): URL {
  let parsed: URL;
  try { parsed = new URL(raw.trim()); } catch { throw new Error("Enter a valid URL"); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http(s) URLs are accepted");
  if (!allowedHosts().has(parsed.hostname.toLowerCase())) throw new Error("URL must be on the Barefoot Bay site");
  parsed.username = "";
  parsed.password = "";
  return parsed;
}

async function rowExists(tx: DbExecutor, table: string, id: number): Promise<boolean> {
  const result = await tx.execute(sql`SELECT 1 FROM ${sql.identifier(table)} WHERE id = ${id} LIMIT 1`);
  return result.rows.length > 0;
}

/** Only URLs that point at a stored file (upload/media/storage-proxy paths with a file extension) are media-matched. */
function isStoredFileUrl(url: URL): boolean {
  return extractStoredFileUrls(`${url.pathname}${url.search}`).length > 0 || extractStoredFileUrls(url.toString()).length > 0;
}

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

async function matchMedia(tx: DbExecutor, url: URL): Promise<TargetInput | null> {
  if (!isStoredFileUrl(url)) return null;
  const candidates = [url.toString(), `${url.pathname}${url.search}`, url.pathname];
  const hits: TargetInput[] = [];
  for (const [type, def] of Object.entries(CONTENT_TYPES) as [DmcaContentType, (typeof CONTENT_TYPES)[DmcaContentType]][]) {
    const clauses: any[] = [];
    for (const column of def.mediaScalarColumns) {
      clauses.push(sql`${sql.identifier(column)} IN (${sql.join(candidates.map((v) => sql`${v}`), sql`, `)})`);
    }
    for (const column of def.mediaArrayColumns) {
      clauses.push(sql`EXISTS (SELECT 1 FROM unnest(coalesce(${sql.identifier(column)}, ARRAY[]::text[])) AS media_url WHERE media_url IN (${sql.join(candidates.map((v) => sql`${v}`), sql`, `)}))`);
    }
    if (def.htmlColumn) {
      clauses.push(sql`${sql.identifier(def.htmlColumn)} LIKE ${`%${escapeLike(url.pathname)}%`}`);
    }
    if (!clauses.length) continue;
    const found = await tx.execute(sql`SELECT id FROM ${sql.identifier(def.table)} WHERE (${sql.join(clauses, sql` OR `)}) ORDER BY id LIMIT 2`);
    for (const row of found.rows as any[]) hits.push({ contentType: type, contentId: Number(row.id), originalUrl: url.toString() });
    if (hits.length > 1) break;
  }
  // A file referenced by more than one item is ambiguous: leave it unmatched
  // so a human picks the right item(s) instead of guessing.
  return hits.length === 1 ? hits[0] : null;
}

async function matchTarget(tx: DbExecutor, url: URL): Promise<TargetInput> {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  let match: RegExpMatchArray | null;
  if ((match = path.match(/^\/forum\/post\/(\d+)$/))) {
    const comment = url.hash.match(/^#comment-(\d+)$/);
    if (comment) {
      // Only accept the comment when it actually belongs to the post in the URL.
      const found = await tx.execute(sql`SELECT 1 FROM forum_comments WHERE id = ${Number(comment[1])} AND post_id = ${Number(match[1])} LIMIT 1`);
      if (found.rows.length) return { contentType: "forum_comment", contentId: Number(comment[1]), originalUrl: url.toString() };
    } else if (await rowExists(tx, CONTENT_TYPES.forum_post.table, Number(match[1]))) {
      return { contentType: "forum_post", contentId: Number(match[1]), originalUrl: url.toString() };
    }
  } else if ((match = path.match(/^\/(?:for-sale|real-estate)\/(\d+)$/))) {
    const id = Number(match[1]);
    if (await rowExists(tx, CONTENT_TYPES.listing.table, id)) return { contentType: "listing", contentId: id, originalUrl: url.toString() };
  } else if ((match = path.match(/^\/events\/(\d+)$/))) {
    const id = Number(match[1]);
    if (await rowExists(tx, CONTENT_TYPES.event.table, id)) return { contentType: "event", contentId: id, originalUrl: url.toString() };
  } else if ((match = path.match(/^\/vendors\/([^/]+)\/([^/]+)$/))) {
    const slug = `vendors-${decodeURIComponent(match[1])}-${decodeURIComponent(match[2])}`;
    const found = await tx.execute(sql`SELECT id FROM page_contents WHERE slug = ${slug} LIMIT 1`);
    if (found.rows[0]) return { contentType: "page", contentId: Number((found.rows[0] as any).id), originalUrl: url.toString() };
  } else if ((match = path.match(/^\/community\/([^/]+)\/([^/]+)$/))) {
    const slug = `${decodeURIComponent(match[1])}-${decodeURIComponent(match[2])}`;
    const found = await tx.execute(sql`SELECT id FROM page_contents WHERE slug = ${slug} LIMIT 1`);
    if (found.rows[0]) return { contentType: "page", contentId: Number((found.rows[0] as any).id), originalUrl: url.toString() };
  } else if ((match = path.match(/^\/([a-z0-9][a-z0-9-]*)$/i))) {
    // CMS page served at /<slug> (page content registry publicPath)
    const found = await tx.execute(sql`SELECT id FROM page_contents WHERE slug = ${decodeURIComponent(match[1])} ORDER BY id LIMIT 1`);
    if (found.rows[0]) return { contentType: "page", contentId: Number((found.rows[0] as any).id), originalUrl: url.toString() };
  }
  return (await matchMedia(tx, url)) || { contentType: "url", contentId: null, originalUrl: url.toString() };
}

async function loadSettings(executor: DbExecutor = db): Promise<any> {
  const result = await executor.execute(sql`SELECT * FROM dmca_settings WHERE id = 1`);
  return result.rows[0] || {};
}

async function policyResponse(req: Request, executor: DbExecutor = db) {
  const row = await loadSettings(executor);
  const agent = {
    name: row.agent_name ?? null, organization: row.agent_organization ?? null, address: row.agent_address ?? null,
    phone: row.agent_phone ?? null, email: row.agent_email ?? null,
  };
  const canEdit = (await getRequestDmcaPermissions(req)).has(DmcaPermission.MANAGE_PERMISSIONS);
  return {
    agent,
    agentConfigured: Object.values(agent).every((value) => typeof value === "string" && value.trim().length > 0),
    sections: mergePolicySections(row.policy_sections),
    canEdit,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

router.get("/policy", async (req, res, next) => {
  try { res.json(await policyResponse(req)); } catch (error) { next(error); }
});

router.put("/settings", requireDmcaPermission(DmcaPermission.MANAGE_PERMISSIONS), async (req, res, next) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "body"] ||= issue.message;
    return res.status(400).json({ message: "Please correct the highlighted fields", errors });
  }
  try {
    await db.transaction(async (tx) => {
      const previous = await loadSettings(tx);
      const { agent, sections } = parsed.data;
      await tx.execute(sql`UPDATE dmca_settings SET agent_name=${agent.name || null}, agent_organization=${agent.organization || null},
        agent_address=${agent.address || null}, agent_phone=${agent.phone || null}, agent_email=${agent.email || null},
        policy_sections=${JSON.stringify(sections)}::jsonb, updated_by=${(req.user as any).id}, updated_at=now() WHERE id=1`);
      await writeDmcaAudit({
        event: "settings_updated", actorType: "admin", actorId: (req.user as any).id,
        targetType: "dmca_settings", targetId: 1, ipAddress: requestIp(req),
        previousValue: { agent: {
          name: previous.agent_name, organization: previous.agent_organization, address: previous.agent_address,
          phone: previous.agent_phone, email: previous.agent_email,
        }, sections: mergePolicySections(previous.policy_sections) },
        newValue: parsed.data,
      }, tx);
    });
    res.json(await policyResponse(req));
  } catch (error) { next(error); }
});

router.post("/notices", noticeLimiter, async (req, res, next) => {
  const parsed = dmcaPublicNoticeSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "body"] ||= issue.message;
    return res.status(400).json({ message: "Please correct the highlighted fields", errors });
  }
  const data = parsed.data;
  const normalized: URL[] = [];
  const urlErrors: string[] = [];
  data.infringingUrls.forEach((value, index) => {
    try { normalized.push(normalizeReportedUrl(value)); } catch (error) { urlErrors[index] = error instanceof Error ? error.message : "Invalid URL"; }
  });
  // The same URL reported twice becomes one case target (first occurrence kept).
  const deduped = normalized.filter((u, i) => normalized.findIndex((o) => o.toString() === u.toString()) === i);
  normalized.length = 0;
  normalized.push(...deduped);
  if (urlErrors.some(Boolean)) {
    const errors: Record<string, string> = {};
    urlErrors.forEach((message, index) => { if (message) errors[`infringingUrls.${index}`] = message; });
    return res.status(400).json({ message: "Please correct the highlighted fields", errors });
  }
  const ip = requestIp(req);
  if (!(await verifyRecaptcha(data.recaptchaToken, ip))) return res.status(403).json({ message: "CAPTCHA verification failed. Please try again." });

  try {
    const resolved = await db.transaction(async (tx) => Promise.all(normalized.map((url) => matchTarget(tx, url))));
    // URL aliases (e.g. /for-sale/1 and /real-estate/1) resolve to the same item; keep one
    // target per item. Every submitted URL is still preserved in the immutable form payload.
    const seenTargets = new Set<string>();
    const targets = resolved.filter((t) => {
      if (t.contentId == null) return true;
      const key = `${t.contentType}:${t.contentId}`;
      if (seenTargets.has(key)) return false;
      seenTargets.add(key);
      return true;
    });
    const matchedCount = targets.filter((target) => target.contentId != null).length;
    const completeness = {
      signature: !!data.signature, workIdentified: !!data.workTitle && !!data.workDescription,
      materialIdentified: normalized.length > 0, matchedCount, unmatchedCount: targets.length - matchedCount,
      contactInfo: !!data.address && !!data.phone && !!data.email, goodFaithStatement: data.goodFaith === true,
      accuracyAndAuthorityStatement: data.accuracyPerjury === true,
      allPresent: !!data.signature && !!data.workTitle && !!data.workDescription && normalized.length > 0 &&
        !!data.address && !!data.phone && !!data.email && data.goodFaith === true && data.accuracyPerjury === true,
      note: "automated presence check only; not a legal determination",
    };
    const { recaptchaToken: _omitted, ...payload } = { ...data, infringingUrls: normalized.map(String) };
    let receivedAt: Date | null = null;
    const created = await createCase({
      claimant: {
        name: data.name, company: data.company, email: data.email, phone: data.phone, address: data.address,
        role: data.role, copyrightOwnerName: data.copyrightOwnerName,
        workDescription: `${data.workTitle}\n\n${data.workDescription}`,
      },
      submission: {
        submissionType: "notice", formPayload: payload, submittedByName: data.name, signatureValue: data.signature,
        ipAddress: ip, userAgent: req.headers["user-agent"] || null,
      },
      targets, submittedVia: "web_form", actor: { type: "public", id: null, ipAddress: ip },
      afterCreate: async (tx, createdCase) => {
        receivedAt = createdCase.receivedAt;
        await tx.execute(sql`UPDATE dmca_cases SET completeness=${JSON.stringify(completeness)}::jsonb WHERE id=${createdCase.id}`);
        await writeDmcaAudit({
          event: "notice_received", actorType: "public", actorId: null, dmcaCaseId: createdCase.id,
          targetType: "dmca_case", targetId: createdCase.id, ipAddress: ip, newValue: { completeness },
        }, tx);
        const settings = await loadSettings(tx);
        const absoluteStatus = `${baseUrl()}/dmca/status/${createdCase.statusToken}`;
        const confirmation = claimantNoticeEmail({
          caseNumber: createdCase.caseNumber, receivedAt: createdCase.receivedAt, name: data.name,
          workTitle: data.workTitle, urls: normalized.map(String), statusUrl: absoluteStatus,
          company: data.company ?? null, email: data.email, phone: data.phone, address: data.address,
          role: data.role, copyrightOwnerName: data.copyrightOwnerName ?? null, workDescription: data.workDescription,
          referenceUrl: data.referenceUrl ?? null, signature: data.signature,
          agent: { name: settings.agent_name, organization: settings.agent_organization, address: settings.agent_address, phone: settings.agent_phone, email: settings.agent_email },
        });
        await enqueueNotification({
          eventType: "dmca_notice_claimant_confirmation", email: { to: data.email, ...confirmation },
          dmcaCaseId: createdCase.id, dedupeKey: `dmca:${createdCase.id}:claimant-confirmation`,
        }, tx);
        const recipients = await tx.execute(sql`SELECT DISTINCT lower(trim(u.email)) AS email FROM users u
          LEFT JOIN dmca_permission_grants g ON g.user_id=u.id AND g.permission=${DmcaPermission.VIEW}
          WHERE g.id IS NOT NULL AND u.email IS NOT NULL AND trim(u.email) <> ''`);
        for (const recipient of recipients.rows as any[]) {
          if (!recipient.email) continue;
          const alert = adminNoticeEmail({
            caseNumber: createdCase.caseNumber, claimantName: data.name, claimantEmail: data.email,
            urlCount: normalized.length, completeness, adminUrl: `${baseUrl()}/admin`,
          });
          await enqueueNotification({
            eventType: "dmca_notice_admin_alert", email: { to: recipient.email, ...alert },
            dmcaCaseId: createdCase.id, dedupeKey: `dmca:${createdCase.id}:admin:${recipient.email}`,
          }, tx);
        }
      },
    });
    res.status(201).json({ caseNumber: created.caseNumber, receivedAt: (receivedAt || new Date()).toISOString(), statusUrl: `/dmca/status/${created.statusToken}` });
  } catch (error) { next(error); }
});

export const DMCA_PUBLIC_STATUS_LABELS = ["Received", "Under review", "Needs information", "Content disabled", "Counter-notice received", "Closed"] as const;
export const statusLabels: Record<string, (typeof DMCA_PUBLIC_STATUS_LABELS)[number]> = {
  RECEIVED: "Received", UNDER_REVIEW: "Under review", ACCEPTED: "Under review", INCOMPLETE: "Needs information",
  CONTENT_REMOVED: "Content disabled", UPLOADER_NOTIFIED: "Content disabled", COUNTER_NOTICE_RECEIVED: "Content disabled",
  COUNTER_NOTICE_INCOMPLETE: "Content disabled", COUNTER_NOTICE_ACCEPTED: "Content disabled", COURT_ACTION_RECEIVED: "Content disabled",
  CLAIMANT_NOTIFIED_OF_COUNTER: "Counter-notice received", WAITING_FOR_RESTORATION_WINDOW: "Counter-notice received",
  RESTORATION_ELIGIBLE: "Counter-notice received", REJECTED: "Closed", RESTORED: "Closed", CLOSED: "Closed",
};

router.get("/status/:token", statusLimiter, async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const token = req.params.token;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return res.status(404).json({ message: "DMCA case status not found" });
  try {
    const result = await db.execute(sql`SELECT case_number, received_at, updated_at, status FROM dmca_cases WHERE status_token=${token} LIMIT 1`);
    const row = result.rows[0] as any;
    if (!row) return res.status(404).json({ message: "DMCA case status not found" });
    res.json({
      caseNumber: row.case_number, receivedAt: new Date(row.received_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(), status: statusLabels[row.status] || "Under review",
    });
  } catch (error) { next(error); }
});

export default router;