/**
 * Short-lived, audited access to quarantined DMCA evidence files.
 *
 *   POST /api/dmca/evidence/:objectId/link  → issue a 5–15 minute signed link
 *   GET  /api/dmca/evidence/:objectId?uid&exp&sig → stream the file
 *
 * Both require a logged-in admin holding dmca.view_private_files; the GET
 * additionally requires a valid unexpired signature bound to that same admin.
 * Every issuance and every access (including refused ones) is audited.
 */
import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireDmcaPermission, DmcaPermission } from "../dmca/permissions";
import { writeDmcaAudit, requestIp } from "../dmca/audit";
import {
  createEvidenceLink,
  readQuarantinedBytes,
  verifyEvidenceSignature,
  EVIDENCE_LINK_DEFAULT_SECONDS,
} from "../dmca/quarantine";

const router = Router();

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", pdf: "application/pdf",
  mp3: "audio/mpeg", wav: "audio/wav",
};

async function objectCaseId(objectId: number): Promise<number | null> {
  const r = await db.execute(sql`SELECT dmca_case_id FROM dmca_quarantined_objects WHERE id = ${objectId}`);
  const row = r.rows[0] as any;
  return row ? Number(row.dmca_case_id) : null;
}

router.post("/evidence/:objectId/link", requireDmcaPermission(DmcaPermission.VIEW_PRIVATE_FILES), async (req: Request, res: Response) => {
  const objectId = Number(req.params.objectId);
  if (!Number.isInteger(objectId)) return res.status(400).json({ message: "Invalid object id" });
  const caseId = await objectCaseId(objectId);
  if (caseId == null) return res.status(404).json({ message: "Evidence file not found" });
  const adminId = (req.user as any).id as number;
  const ttl = Number(req.body?.ttlSeconds) || EVIDENCE_LINK_DEFAULT_SECONDS;
  const link = createEvidenceLink(objectId, adminId, ttl);
  await writeDmcaAudit({
    event: "evidence_link_issued",
    actorType: "admin",
    actorId: adminId,
    dmcaCaseId: caseId,
    targetType: "quarantined_object",
    targetId: objectId,
    ipAddress: requestIp(req),
    newValue: { expiresAt: link.expiresAt.toISOString(), ttlSeconds: link.ttlSeconds },
  });
  res.json({ url: link.path, expiresAt: link.expiresAt, ttlSeconds: link.ttlSeconds });
});

router.get("/evidence/:objectId", requireDmcaPermission(DmcaPermission.VIEW_PRIVATE_FILES), async (req: Request, res: Response) => {
  const objectId = Number(req.params.objectId);
  const uid = Number(req.query.uid);
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig ?? "");
  const adminId = (req.user as any).id as number;
  const caseId = Number.isInteger(objectId) ? await objectCaseId(objectId) : null;

  const verdict = !Number.isInteger(objectId) || uid !== adminId ? "invalid" : verifyEvidenceSignature(objectId, uid, exp, sig);
  if (verdict !== "ok" || caseId == null) {
    await writeDmcaAudit({
      event: "evidence_access_denied",
      actorType: "admin",
      actorId: adminId,
      dmcaCaseId: caseId,
      targetType: "quarantined_object",
      targetId: Number.isInteger(objectId) ? objectId : null,
      ipAddress: requestIp(req),
      notes: caseId == null ? "not found" : verdict,
    });
    return res.status(verdict === "expired" ? 410 : caseId == null ? 404 : 403).json({ message: verdict === "expired" ? "This evidence link has expired" : "Invalid evidence link" });
  }

  const file = await readQuarantinedBytes(objectId);
  await writeDmcaAudit({
    event: "evidence_accessed",
    actorType: "admin",
    actorId: adminId,
    dmcaCaseId: caseId,
    targetType: "quarantined_object",
    targetId: objectId,
    ipAddress: requestIp(req),
    newValue: { found: !!file, userAgent: req.headers["user-agent"] ?? null },
  });
  if (!file) return res.status(404).json({ message: "Evidence file bytes not found" });
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  // Uploaded files are untrusted (e.g. SVG with script): never let them run.
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'");
  res.setHeader("Content-Disposition", `inline; filename="${file.name.replace(/[^\w.\-]/g, "_")}"`);
  res.send(file.data);
});

export default router;
