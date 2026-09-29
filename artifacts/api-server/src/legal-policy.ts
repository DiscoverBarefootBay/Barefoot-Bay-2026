import { Router, type Request, type Response, type NextFunction, type Express } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { users } from "@workspace/db";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { DEFAULT_DMCA_POLICY_SECTIONS } from "./dmca/policy-defaults";
import { logger } from "./lib/logger";
import { canonicalizeAvatarUrl } from "./lib/avatar-url";

type Executor = Pick<typeof db, "execute">;
export const acceptanceSchema = z.array(z.object({
  key: z.enum(["terms", "privacy", "dmca"]),
  versionId: z.number().int().positive(),
  accepted: z.literal(true),
}).strict()).min(1).max(3).refine(a => new Set(a.map(p => p.key)).size === a.length);
export class LegalError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function legalFailure(res: Response, error: unknown) {
  res.set("Cache-Control", "no-store");
  if (error instanceof LegalError) return res.status(error.status).json({ code: error.code, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ code: "INVALID_POLICY_ACCEPTANCE", message: "Explicit acceptance of exact policy versions is required." });
  // Drizzle errors can contain bound registration fields; never log query params.
  logger.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Legal policy store unavailable");
  return res.status(503).json({ code: "POLICY_STORE_UNAVAILABLE", message: "Legal policies are temporarily unavailable. Please retry." });
}
let defaultsReady = false;
let defaultsInitialization: Promise<void> | undefined;
export async function initializeLegalDefaults() {
  defaultsReady = false;
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(736201)`);
    await tx.execute(sql`INSERT INTO legal_policy_defaults(id,sections) VALUES(1,${JSON.stringify(DEFAULT_DMCA_POLICY_SECTIONS)}::jsonb)
      ON CONFLICT(id) DO UPDATE SET sections=excluded.sections`);
    await tx.execute(sql`SELECT legal_publish_dmca()`);
  });
  defaultsReady = true;
}
export async function ensureLegalDefaults() {
  if (defaultsReady) return;
  if (!defaultsInitialization) {
    defaultsInitialization = initializeLegalDefaults().finally(() => { defaultsInitialization = undefined; });
  }
  await defaultsInitialization;
}
export async function currentPolicies(executor: Executor = db) {
  await ensureLegalDefaults();
  const rows = (await executor.execute(sql`SELECT v.* FROM legal_policy_current c JOIN legal_policy_versions v ON v.id=c.version_id ORDER BY CASE v.policy_key WHEN 'terms' THEN 1 WHEN 'privacy' THEN 2 ELSE 3 END`)).rows as any[];
  if (rows.length !== 3) throw new Error("All three published legal policies are required");
  return rows.map(v => ({
    key: v.policy_key as "terms" | "privacy" | "dmca", versionId: Number(v.id), title: v.title,
    url: v.url, publishedAt: new Date(v.published_at).toISOString(),
    contentHtml: sanitizeHtml(v.content_html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2"]),
      allowedAttributes: { a: ["href", "title"], div: ["style"] },
      allowedStyles: { div: { "white-space": [/^pre-wrap$/] } },
    }),
    changeNotes: v.change_notes as string | null,
  }));
}
export async function consentStatus(userId: number, executor: Executor = db) {
  const policies = await currentPolicies(executor);
  const records = (await executor.execute(sql`SELECT version_id FROM legal_policy_acceptances WHERE user_id=${userId}`)).rows as any[];
  const accepted = new Set(records.map(r => Number(r.version_id)));
  const outstanding = policies.filter(p => !accepted.has(p.versionId));
  return { policies, outstanding, requiresAcceptance: outstanding.length > 0 };
}
export async function recordAcceptance(executor: Executor, userId: number, input: unknown, source: "signup" | "subsequent") {
  const acceptances = acceptanceSchema.parse(input);
  const policies = await currentPolicies(executor);
  if (source === "signup" && acceptances.length !== 3) throw new LegalError(400, "INVALID_POLICY_ACCEPTANCE", "Accept all three current policies.");
  for (const acceptance of acceptances) {
    if (!policies.some(p => p.key === acceptance.key && p.versionId === acceptance.versionId)) {
      throw new LegalError(409, "POLICY_VERSION_CHANGED", "Policies changed. Refresh and review the current text.");
    }
  }
  for (const a of acceptances) {
    await executor.execute(sql`INSERT INTO legal_policy_acceptances(user_id,policy_key,version_id,source)
      VALUES(${userId},${a.key},${a.versionId},${source}) ON CONFLICT(user_id,version_id) DO NOTHING`);
  }
}
export async function registerWithConsent(user: typeof users.$inferInsert, input: unknown) {
  await ensureLegalDefaults();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(736201)`);
    return createAccountWithConsent(tx, user, input);
  });
}
// Caller must hold the publication lock inside the same transaction.
export async function createAccountWithConsent(executor: Pick<typeof db, "execute" | "insert">, user: typeof users.$inferInsert, input: unknown) {
  acceptanceSchema.parse(input);
  const [created] = await executor.insert(users).values({
    ...user,
    isResident: user.isResident ?? false,
    avatarUrl: canonicalizeAvatarUrl(user.avatarUrl ?? null),
  }).returning();
  await recordAcceptance(executor, created.id, input, "signup");
  return created;
}
export function legalException(method: string, path: string) {
  if (method === "GET" && ["/api/legal/policies", "/api/legal/consent", "/api/user", "/api/auth/status", "/api/auth/check", "/api/dmca/policy", "/api/pages/terms-and-agreements", "/api/pages/privacy-policy"].includes(path)) return true;
  if (method === "POST" && ["/api/legal/consent", "/api/logout", "/api/auth/logout", "/api/login", "/api/auth/login", "/api/register", "/api/password-reset/request", "/api/password-reset/validate", "/api/password-reset/reset", "/api/dmca/notices"].includes(path)) return true;
  if (method === "GET" && /^\/api\/dmca\/status\/[^/]+$/.test(path)) return true;
  if (method === "GET" && /^\/api\/dmca\/my-cases(?:\/[^/]+)?$/.test(path)) return true;
  return method === "POST" && /^\/api\/dmca\/my-cases\/[^/]+\/counter-notice$/.test(path);
}
export async function legalGate(req: Request, res: Response, next: NextFunction) {
  // Some legacy message handlers authenticate from session.user after this boundary.
  const userId = req.user?.id ?? (req.session as any)?.user?.id;
  if (!userId || legalException(req.method, req.path)) return next();
  res.set("Cache-Control", "no-store");
  try {
    const status = await consentStatus(Number(userId));
    if (status.requiresAcceptance) return res.status(428).json({ code: "POLICY_ACCEPTANCE_REQUIRED", message: "Please review and accept current legal policies.", ...status });
    next();
  } catch (error) { legalFailure(res, error); }
}
export function mountLegalRoutes(app: Express) {
  const router = Router();
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.get("/policies", async (_req, res) => {
    try { res.json({ policies: await currentPolicies() }); } catch (e) { legalFailure(res, e); }
  });
  router.use((req, res, next) => req.user?.id ? next() : res.status(401).json({ message: "Authentication required" }));
  router.get("/consent", async (req, res) => {
    try { res.json(await consentStatus(Number(req.user!.id))); } catch (e) { legalFailure(res, e); }
  });
  router.post("/consent", async (req, res) => {
    try {
      await ensureLegalDefaults();
      const status = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(736201)`);
        await recordAcceptance(tx, Number(req.user!.id), req.body.acceptances, "subsequent");
        return consentStatus(Number(req.user!.id), tx);
      });
      res.json(status);
    } catch (e) { legalFailure(res, e); }
  });
  router.get("/history", async (req, res) => {
    if (!["admin", "super_admin"].includes(req.user!.role)) return res.status(403).json({ message: "Administrator access required" });
    try {
      const pageSize = Number(req.query.pageSize ?? 50);
      const page = Number(req.query.page ?? 1);
      const policyKey = req.query.policyKey || null;
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isInteger(page) || page < 1 || page > 1000 || (policyKey !== null && !["terms", "privacy", "dmca"].includes(String(policyKey)))) {
        return res.status(400).json({ message: "Use page 1–1000, pageSize 1–100 and an optional valid policyKey." });
      }
      const offset = (page - 1) * pageSize;
      const filter = policyKey ? sql`WHERE policy_key=${String(policyKey)}` : sql``;
      const versions = (await db.execute(sql`SELECT id AS "versionId",policy_key AS key,title,url,content_html AS "contentHtml",published_at AS "publishedAt",change_notes AS "changeNotes" FROM legal_policy_versions ${filter} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`)).rows;
      const acceptances = (await db.execute(sql`SELECT user_id AS "userId",policy_key AS "policyKey",version_id AS "versionId",accepted_at AS "acceptedAt",source FROM legal_policy_acceptances ${filter} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${offset}`)).rows;
      const versionTotal = Number((await db.execute(sql`SELECT count(*) AS n FROM legal_policy_versions ${filter}`)).rows[0].n);
      const acceptanceTotal = Number((await db.execute(sql`SELECT count(*) AS n FROM legal_policy_acceptances ${filter}`)).rows[0].n);
      return res.json({ versions: versions.map((v: any) => ({ ...v, contentHtml: sanitizeHtml(v.contentHtml) })), acceptances, page, pageSize, total: Math.max(versionTotal, acceptanceTotal), versionTotal, acceptanceTotal });
    } catch (e) { return legalFailure(res, e); }
  });
  app.use("/api/legal", router);
}