/**
 * DMCA quarantine storage.
 *
 * Takedown moves every stored file belonging to a content item to a private
 * location keyed by case number (`dmca-quarantine/<CASE>/<original key>` in
 * object storage, or `<cwd>/dmca-quarantine/<CASE>/...` for legacy local
 * files). Restore moves them back to the EXACT original key/path so original
 * URLs keep working.
 *
 * Independently of where the bytes are, every quarantined file is recorded in
 * dmca_quarantined_objects. `quarantineGateMiddleware` (mounted before every
 * media-serving route) 404s any request whose file name is registered, so an
 * old bookmarked URL — in any of the many legacy URL shapes — stops working
 * the moment the takedown commits, even before the bytes are moved.
 *
 * Admin evidence access goes only through short-lived HMAC-signed links
 * (5–15 minutes) and every issuance/access is audited.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { pgIntArray } from "./legal-hold";
import { db } from "../db";
import { logger } from "../lib/logger";
import { fileBasename } from "./content-registry";
import type { DbExecutor } from "./audit";

export const QUARANTINE_PREFIX = "dmca-quarantine";

// ---------------------------------------------------------------------------
// Storage adapter (injectable for tests)
// ---------------------------------------------------------------------------
export interface QuarantineStorageAdapter {
  /** Returns the bytes, or null when the key does not exist. */
  get(key: string): Promise<Buffer | null>;
  put(key: string, data: Buffer): Promise<void>;
  del(key: string): Promise<void>;
}

async function defaultObjectStorageAdapter(): Promise<QuarantineStorageAdapter> {
  const { objectStorageService } = await import("../object-storage-service");
  const client: any = objectStorageService.client;
  return {
    async get(key) {
      try {
        const r = await client.downloadAsBytes(key);
        if (!r?.ok) return null;
        const buf: Buffer | undefined = r.value?.[0];
        return buf && buf.length > 0 ? buf : null;
      } catch {
        return null;
      }
    },
    async put(key, data) {
      const r = await client.uploadFromBytes(key, data);
      if (!r?.ok) throw new Error(`upload failed for ${key}: ${r?.error?.message ?? "unknown error"}`);
    },
    async del(key) {
      const r = await client.delete(key);
      if (!r?.ok) throw new Error(`delete failed for ${key}: ${r?.error?.message ?? "unknown error"}`);
    },
  };
}

let adapterOverride: QuarantineStorageAdapter | null = null;
let localRootOverride: string | null = null;

/** Test hook: inject a fake object-storage adapter and local-fs root. */
export function __setQuarantineTestHooks(opts: { adapter?: QuarantineStorageAdapter | null; localRoot?: string | null }): void {
  if (opts.adapter !== undefined) adapterOverride = opts.adapter;
  if (opts.localRoot !== undefined) localRootOverride = opts.localRoot;
}

async function getAdapter(): Promise<QuarantineStorageAdapter> {
  return adapterOverride ?? defaultObjectStorageAdapter();
}

/**
 * Private DMCA documents (original notices, court documents) live in object
 * storage under the quarantine prefix, which quarantineGateMiddleware already
 * refuses to serve on any public route. Never the local disk: deployments
 * have an ephemeral filesystem, and these files are legal evidence.
 */
export const PRIVATE_DOCUMENT_PREFIX = `${QUARANTINE_PREFIX}/_documents`;
export async function putPrivateDocument(name: string, data: Buffer): Promise<void> {
  await (await getAdapter()).put(`${PRIVATE_DOCUMENT_PREFIX}/${name}`, data);
}
export async function getPrivateDocument(name: string): Promise<Buffer | null> {
  return (await getAdapter()).get(`${PRIVATE_DOCUMENT_PREFIX}/${name}`);
}

function localRoot(): string {
  return localRootOverride ?? process.cwd();
}

// ---------------------------------------------------------------------------
// URL → candidate storage keys
// ---------------------------------------------------------------------------
const DIRECT_PREFIX_MAP: Record<string, string[]> = {
  "direct-forum": ["forum"],
  "direct-vendors": ["vendors", "vendor-media"],
  "direct-realestate": ["real-estate-media"],
  "direct-banner": ["banner-slides"],
  "direct-community": ["community", "community-media"],
  "direct-content": ["content-media"],
  "direct-avatars": ["avatars"],
  "direct-events": ["events"],
};

const FALLBACK_PREFIXES = [
  "forum", "events", "real-estate-media", "avatars", "banner-slides", "vendors",
  "vendor-media", "community", "community-media", "content-media", "attachments", "calendar",
];

function stripUrl(url: string): string {
  let p = url.split(/[?#]/)[0];
  p = p.replace(/^https?:\/\/[^/]+/i, "");
  try {
    p = decodeURI(p);
  } catch {
    /* keep raw */
  }
  return p.replace(/\/{2,}/g, "/");
}

/** Ordered, de-duplicated object-storage keys that could hold this URL's bytes. */
export function candidateObjectKeys(url: string): string[] {
  const out: string[] = [];
  const push = (k: string) => {
    const key = k.replace(/^\/+/, "").replace(/\.\.\//g, "");
    if (key && !key.startsWith(QUARANTINE_PREFIX) && !out.includes(key)) out.push(key);
  };
  const raw = url.split(/[?#]/)[0];
  const p = stripUrl(url);
  const base = fileBasename(url);
  let rest: string | null = null;
  if (/object-storage\.replit\.app/i.test(raw)) rest = p.replace(/^\/+/, "");
  else if (p.startsWith("/api/storage-proxy/")) rest = p.slice("/api/storage-proxy/".length);
  if (rest !== null) {
    const segs = rest.split("/").filter(Boolean);
    const first = segs[0] ?? "";
    if (DIRECT_PREFIX_MAP[first]) {
      for (const pre of DIRECT_PREFIX_MAP[first]) push(`${pre}/${segs.slice(1).join("/")}`);
    } else if (/^[A-Z_]+$/.test(first) && segs.length > 1) {
      // BUCKET/key → the key is everything after the bucket label
      let keySegs = segs.slice(1);
      if (keySegs[0] === first) keySegs = keySegs.slice(1); // doubled bucket label
      push(keySegs.join("/"));
      if (first === "REAL_ESTATE" || first === "SALE") push(`real-estate-media/${base}`);
      if (keySegs[0] === "forum" && keySegs[1] === "forum") push(keySegs.slice(1).join("/"));
      push(segs.join("/"));
    } else {
      push(segs.join("/"));
    }
  } else if (p.startsWith("/uploads/")) {
    push(p.slice("/uploads/".length));
  } else {
    push(p);
  }
  for (const pre of FALLBACK_PREFIXES) push(`${pre}/${base}`);
  return out;
}

/** Local files that could hold this URL's bytes (legacy /uploads etc.). */
export function candidateLocalPaths(url: string): string[] {
  const p = stripUrl(url);
  if (/^https?:/i.test(p) || p.startsWith("/api/")) return [];
  const rel = p.replace(/^\/+/, "").replace(/\.\.\//g, "");
  if (!rel) return [];
  const root = localRoot();
  return [path.join(root, rel), path.join(root, "public", rel), path.join(root, "dist", "public", rel)];
}

export function quarantineKeyFor(caseNumber: string, originalKey: string): string {
  if (!/^[A-Z0-9-]+$/.test(caseNumber)) throw new Error(`invalid case number: ${caseNumber}`);
  return `${QUARANTINE_PREFIX}/${caseNumber}/${originalKey.replace(/^\/+/, "")}`;
}

// ---------------------------------------------------------------------------
// Registry cache + public gate
// ---------------------------------------------------------------------------
let quarantinedBasenames: Set<string> = new Set();
let registryLoaded: Promise<void> | null = null;
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 30_000;

export async function refreshQuarantineRegistry(executor: DbExecutor = db): Promise<void> {
  const r = await executor.execute(sql`SELECT DISTINCT file_basename FROM dmca_quarantined_objects WHERE status = 'quarantined'`);
  quarantinedBasenames = new Set((r.rows as any[]).map((row) => String(row.file_basename).toLowerCase()));
  lastRefresh = Date.now();
}

async function ensureRegistryFresh(): Promise<void> {
  if (!registryLoaded) {
    registryLoaded = refreshQuarantineRegistry().catch((err) => {
      registryLoaded = null;
      throw err;
    });
  }
  await registryLoaded;
  if (Date.now() - lastRefresh > REFRESH_INTERVAL_MS) {
    // Background refresh for multi-instance deployments; the instance that
    // performed a takedown refreshes synchronously right after commit.
    lastRefresh = Date.now();
    void refreshQuarantineRegistry().catch((err) => logger.warn({ err }, "[DmcaQuarantine] registry refresh failed"));
  }
}

export function isQuarantinedFileName(name: string): boolean {
  return quarantinedBasenames.has(name.toLowerCase());
}

export function isQuarantinedUrl(url: string): boolean {
  const base = fileBasename(url);
  return !!base && isQuarantinedFileName(base);
}

const HAS_EXT = /\.[a-z0-9]{2,5}$/i;

/**
 * Mount BEFORE every media-serving route. Returns 404 for:
 *   - any registered quarantined file name (all URL shapes, all buckets)
 *   - any direct request for the private quarantine prefix
 */
export function quarantineGateMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const p = req.path || "";
    if (p.includes(`/${QUARANTINE_PREFIX}`)) {
      return res.status(404).send("Not found");
    }
    if (p.startsWith("/api/dmca/")) return next();
    const base = fileBasename(p);
    if (!base || !HAS_EXT.test(base)) return next();
    try {
      await ensureRegistryFresh();
    } catch (err) {
      logger.error({ err }, "[DmcaQuarantine] registry unavailable; failing closed for media request");
      return res.status(503).send("Temporarily unavailable");
    }
    if (isQuarantinedFileName(base)) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).send("Not found");
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Move to quarantine / restore
// ---------------------------------------------------------------------------
export interface QuarantineRecordInput {
  dmcaCaseId: number;
  dmcaTargetId: number;
  originalUrl: string;
}

/**
 * Register URLs as quarantined (inside the takedown transaction). The gate
 * starts blocking them as soon as the transaction commits and the registry
 * is refreshed. Returns inserted registry ids.
 */
export async function registerQuarantinedUrls(records: QuarantineRecordInput[], executor: DbExecutor): Promise<number[]> {
  const ids: number[] = [];
  for (const r of records) {
    const base = fileBasename(r.originalUrl);
    if (!base) continue;
    const ins = await executor.execute(sql`
      INSERT INTO dmca_quarantined_objects (dmca_case_id, dmca_target_id, original_url, file_basename, storage_location, status)
      VALUES (${r.dmcaCaseId}, ${r.dmcaTargetId}, ${r.originalUrl}, ${base}, 'pending', 'quarantined')
      RETURNING id`);
    ids.push(Number((ins.rows[0] as any).id));
  }
  return ids;
}

export interface MoveOutcome {
  registryId: number;
  location: "object_storage" | "local_fs" | "none" | "move_failed";
  originalKey: string | null;
  quarantineKey: string | null;
  error?: string;
}

/**
 * Physically move the bytes for registry rows into quarantine. Runs AFTER
 * the takedown transaction commits; a failure here never un-hides content —
 * the gate keeps the URL blocked and the outcome is recorded for admins.
 */
export async function moveRegisteredToQuarantine(caseNumber: string, registryIds: number[], executor: DbExecutor = db): Promise<MoveOutcome[]> {
  if (registryIds.length === 0) return [];
  const adapter = await getAdapter();
  const rows = await executor.execute(sql`SELECT id, original_url FROM dmca_quarantined_objects WHERE id = ANY(${pgIntArray(registryIds.map(Number))})`);
  const outcomes: MoveOutcome[] = [];
  for (const row of rows.rows as any[]) {
    const outcome = await moveOne(adapter, caseNumber, Number(row.id), String(row.original_url));
    outcomes.push(outcome);
    await executor.execute(sql`
      UPDATE dmca_quarantined_objects
      SET storage_location = ${outcome.location}, original_key = ${outcome.originalKey}, quarantine_key = ${outcome.quarantineKey}
      WHERE id = ${outcome.registryId}`);
  }
  return outcomes;
}

async function moveOne(adapter: QuarantineStorageAdapter, caseNumber: string, registryId: number, url: string): Promise<MoveOutcome> {
  try {
    for (const key of candidateObjectKeys(url)) {
      const buf = await adapter.get(key);
      if (!buf) continue;
      const qKey = quarantineKeyFor(caseNumber, key);
      await adapter.put(qKey, buf);
      const verify = await adapter.get(qKey);
      if (!verify || verify.length !== buf.length) throw new Error(`quarantine copy verification failed for ${key}`);
      await adapter.del(key);
      return { registryId, location: "object_storage", originalKey: key, quarantineKey: qKey };
    }
    for (const abs of candidateLocalPaths(url)) {
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
      const rel = path.relative(localRoot(), abs);
      const dest = path.join(localRoot(), QUARANTINE_PREFIX, caseNumber, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(abs, dest);
      return { registryId, location: "local_fs", originalKey: rel, quarantineKey: path.relative(localRoot(), dest) };
    }
    return { registryId, location: "none", originalKey: null, quarantineKey: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ err, registryId, url }, "[DmcaQuarantine] failed to move file into quarantine (URL stays blocked)");
    return { registryId, location: "move_failed", originalKey: null, quarantineKey: null, error };
  }
}

/**
 * Move quarantined bytes back to their exact original keys. Throws if any
 * file cannot be restored, so the caller aborts the restore BEFORE flipping
 * content back to published (restored bytes stay blocked by the gate until
 * the registry row is marked restored).
 */
export async function moveQuarantinedBack(registryIds: number[], executor: DbExecutor = db): Promise<MovedFile[]> {
  if (registryIds.length === 0) return [];
  const adapter = await getAdapter();
  const rows = await executor.execute(sql`
    SELECT id, storage_location, original_key, quarantine_key FROM dmca_quarantined_objects
    WHERE id = ANY(${pgIntArray(registryIds.map(Number))}) AND status = 'quarantined'`);
  const moved: MovedFile[] = [];
  try {
    await moveBackRows(adapter, rows.rows as any[], moved);
  } catch (err) {
    // Never leave evidence half-restored: put back whatever we already moved.
    await reverseMoves(moved);
    throw err;
  }
  return moved;
}

async function moveBackRows(adapter: QuarantineStorageAdapter, rows: any[], moved: MovedFile[]): Promise<void> {
  for (const row of rows) {
    const loc = String(row.storage_location);
    if (loc === "object_storage") {
      const buf = await adapter.get(row.quarantine_key);
      if (!buf) {
        // Already moved back by an earlier, partially-failed restore attempt?
        const existing = await adapter.get(row.original_key);
        if (existing) continue;
        throw new Error(`quarantined object missing: ${row.quarantine_key}`);
      }
      await adapter.put(row.original_key, buf);
      const verify = await adapter.get(row.original_key);
      if (!verify || verify.length !== buf.length) throw new Error(`restore verification failed for ${row.original_key}`);
      await adapter.del(row.quarantine_key);
      moved.push({ location: "object_storage", fromKey: row.quarantine_key, toKey: row.original_key });
    } else if (loc === "local_fs") {
      const src = path.join(localRoot(), row.quarantine_key);
      const dest = path.join(localRoot(), row.original_key);
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.renameSync(src, dest);
        moved.push({ location: "local_fs", fromKey: row.quarantine_key, toKey: row.original_key });
      } else if (!fs.existsSync(dest)) {
        throw new Error(`quarantined local file missing: ${row.quarantine_key}`);
      }
    } else if (loc === "pending") {
      throw new Error(`file ${row.id} is still being quarantined; retry the restore shortly`);
    }
    // "none" / "move_failed": bytes never left the original location.
  }
}

/** A completed physical move (keys are object keys, or paths relative to the local upload root). */
export interface MovedFile {
  location: "object_storage" | "local_fs";
  fromKey: string;
  toKey: string;
}

/** Physical moves performed by a quarantine outcome list (for compensation). */
export function movesFromOutcomes(outcomes: MoveOutcome[]): MovedFile[] {
  const out: MovedFile[] = [];
  for (const o of outcomes) {
    if ((o.location === "object_storage" || o.location === "local_fs") && o.originalKey && o.quarantineKey) {
      out.push({ location: o.location, fromKey: o.originalKey, toKey: o.quarantineKey });
    }
  }
  return out;
}

/**
 * Undo physical moves (toKey → fromKey), newest first. Used when the database
 * transaction that the moves belong to fails, so bytes always match the
 * committed DB state. Errors are logged loudly and rethrown as one error
 * after attempting every file.
 */
export async function reverseMoves(moves: MovedFile[]): Promise<void> {
  if (moves.length === 0) return;
  const adapter = await getAdapter();
  const errors: string[] = [];
  for (const m of [...moves].reverse()) {
    try {
      if (m.location === "object_storage") {
        const buf = await adapter.get(m.toKey);
        if (!buf) {
          if (await adapter.get(m.fromKey)) continue;
          throw new Error(`object missing at ${m.toKey}`);
        }
        await adapter.put(m.fromKey, buf);
        const verify = await adapter.get(m.fromKey);
        if (!verify || verify.length !== buf.length) throw new Error(`verification failed for ${m.fromKey}`);
        await adapter.del(m.toKey);
      } else {
        const src = path.join(localRoot(), m.toKey);
        const dest = path.join(localRoot(), m.fromKey);
        if (fs.existsSync(src)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.renameSync(src, dest);
        } else if (!fs.existsSync(dest)) {
          throw new Error(`local file missing at ${m.toKey}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${m.toKey} -> ${m.fromKey}: ${msg}`);
      logger.error({ err, move: m }, "[DmcaQuarantine] COMPENSATION FAILED — file location no longer matches DB state; manual fix required");
    }
  }
  if (errors.length) throw new Error(`quarantine compensation failed for ${errors.length} file(s): ${errors.join("; ")}`);
}

// ---------------------------------------------------------------------------
// Signed admin evidence links
// ---------------------------------------------------------------------------
export const EVIDENCE_LINK_MIN_SECONDS = 5 * 60;
export const EVIDENCE_LINK_MAX_SECONDS = 15 * 60;
export const EVIDENCE_LINK_DEFAULT_SECONDS = 10 * 60;

function signingSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required to sign DMCA evidence links");
    return "dev_session_secret";
  }
  return s;
}

function sign(objectId: number, adminId: number, exp: number): string {
  return crypto.createHmac("sha256", signingSecret()).update(`dmca-evidence:${objectId}:${adminId}:${exp}`).digest("hex");
}

export function createEvidenceLink(objectId: number, adminId: number, ttlSeconds = EVIDENCE_LINK_DEFAULT_SECONDS, now = Date.now()) {
  const ttl = Math.min(EVIDENCE_LINK_MAX_SECONDS, Math.max(EVIDENCE_LINK_MIN_SECONDS, Math.floor(ttlSeconds)));
  const exp = Math.floor(now / 1000) + ttl;
  const sig = sign(objectId, adminId, exp);
  return { path: `/api/dmca/evidence/${objectId}?uid=${adminId}&exp=${exp}&sig=${sig}`, expiresAt: new Date(exp * 1000), ttlSeconds: ttl };
}

export function verifyEvidenceSignature(objectId: number, adminId: number, exp: number, sig: string, now = Date.now()): "ok" | "expired" | "invalid" {
  if (!Number.isFinite(exp) || !sig || !/^[a-f0-9]{64}$/.test(sig)) return "invalid";
  const expected = sign(objectId, adminId, exp);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return "invalid";
  if (Math.floor(now / 1000) > exp) return "expired";
  if (exp - Math.floor(now / 1000) > EVIDENCE_LINK_MAX_SECONDS + 5) return "invalid";
  return "ok";
}

/** Read the bytes of a quarantined object (for signed evidence access). */
export async function readQuarantinedBytes(objectId: number): Promise<{ data: Buffer; name: string } | null> {
  const r = await db.execute(sql`
    SELECT storage_location, quarantine_key, original_key, original_url, file_basename, status
    FROM dmca_quarantined_objects WHERE id = ${objectId}`);
  const row = r.rows[0] as any;
  if (!row) return null;
  const adapter = await getAdapter();
  if (row.storage_location === "object_storage") {
    const key = row.status === "quarantined" ? row.quarantine_key : row.original_key;
    const data = await adapter.get(key);
    return data ? { data, name: row.file_basename } : null;
  }
  if (row.storage_location === "local_fs") {
    const rel = row.status === "quarantined" ? row.quarantine_key : row.original_key;
    const abs = path.join(localRoot(), rel);
    return fs.existsSync(abs) ? { data: fs.readFileSync(abs), name: row.file_basename } : null;
  }
  if (row.storage_location === "none" || row.storage_location === "move_failed") {
    // Bytes were never moved; try the original locations for evidence review.
    for (const key of candidateObjectKeys(row.original_url)) {
      const data = await adapter.get(key);
      if (data) return { data, name: row.file_basename };
    }
  }
  return null;
}
