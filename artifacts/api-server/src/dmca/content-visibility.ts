/**
 * Central content-visibility policy.
 *
 * EVERY public loader (lists, details, comments, search, sitemap, OG/share
 * previews, homepage widgets) must route its results through this module.
 *
 *   - Public (anonymous or unrelated user): only `published` rows exist. Any
 *     other status (dmca_hidden, moderation_hidden, user_deleted, ...) is a
 *     plain 404 "no longer available" — we never reveal why.
 *   - The owner of the item: sees their own hidden item, flagged with
 *     `contentVisibility` so the UI can show a "removed" banner.
 *   - Admins holding dmca.view: see hidden items flagged on detail routes and
 *     on admin/owner list routes (never mixed into public lists).
 *
 * Existing listing lifecycle statuses (DRAFT/ACTIVE/EXPIRED) are separate and
 * keep working; this policy is layered on top of them.
 */
import type { Request, Response } from "express";
import { sql, eq, type SQL, type AnyColumn } from "drizzle-orm";
import { ContentVisibility } from "@workspace/db";
import { getRequestDmcaPermissions, DmcaPermission } from "./permissions";
import { db } from "../db";
import { getContentTypeDef, type DmcaContentType } from "./content-registry";

export const PUBLISHED = ContentVisibility.PUBLISHED;

type AnyRow = Record<string, any>;

export function visibilityOf(row: AnyRow | null | undefined): string {
  if (!row) return PUBLISHED;
  const v = row.visibilityStatus ?? row.visibility_status;
  return typeof v === "string" && v ? v : PUBLISHED;
}

export function isPubliclyVisible(row: AnyRow | null | undefined): boolean {
  return !!row && visibilityOf(row) === PUBLISHED;
}

/** Drop every non-published row. Use for public lists/feeds/search/sitemap. */
export function publicOnly<T extends AnyRow>(rows: readonly T[] | null | undefined): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => isPubliclyVisible(r));
}

/** Raw-SQL predicate: `<alias>.visibility_status = 'published'`. */
export function publicVisibilitySql(alias?: string): SQL {
  if (alias && !/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`invalid alias: ${alias}`);
  return alias ? sql.raw(`${alias}.visibility_status = 'published'`) : sql.raw(`visibility_status = 'published'`);
}

/** Drizzle predicate for a visibilityStatus column. */
export function publicVisibilityCondition(column: AnyColumn): SQL {
  return eq(column, PUBLISHED);
}

export interface ViewerContext {
  userId: number | null;
  /** holds dmca.view — may see hidden content (flagged) */
  canViewHidden: boolean;
}

export const ANONYMOUS_VIEWER: ViewerContext = { userId: null, canViewHidden: false };

export async function getViewerContext(req: Request): Promise<ViewerContext> {
  const authed = typeof req.isAuthenticated === "function" && req.isAuthenticated() && req.user;
  if (!authed) return ANONYMOUS_VIEWER;
  const userId = typeof (req.user as any).id === "number" ? (req.user as any).id : null;
  const perms = await getRequestDmcaPermissions(req);
  return { userId, canViewHidden: perms.has(DmcaPermission.VIEW) };
}

export interface ContentVisibilityFlag {
  status: string;
  removed: true;
  dmcaCaseId: number | null;
  hiddenAt: string | null;
  reason: string | null;
  legalHold: boolean;
}

export function withVisibilityFlag<T extends AnyRow>(row: T): T & { contentVisibility?: ContentVisibilityFlag } {
  if (isPubliclyVisible(row)) return row;
  const hiddenAt = row.hiddenAt ?? row.hidden_at ?? null;
  return {
    ...row,
    contentVisibility: {
      status: visibilityOf(row),
      removed: true,
      dmcaCaseId: row.dmcaCaseId ?? row.dmca_case_id ?? null,
      hiddenAt: hiddenAt ? new Date(hiddenAt).toISOString() : null,
      reason: row.hiddenReason ?? row.hidden_reason ?? null,
      legalHold: Boolean(row.legalHold ?? row.legal_hold ?? false),
    },
  };
}

/**
 * May this viewer see this row? Published → yes. Otherwise only the owner or
 * a dmca.view admin (who then get a flagged copy).
 */
export function canViewerSee(row: AnyRow, viewer: ViewerContext, ownerId: number | null | undefined): boolean {
  if (isPubliclyVisible(row)) return true;
  if (viewer.canViewHidden) return true;
  return viewer.userId != null && ownerId != null && Number(ownerId) === viewer.userId;
}

/**
 * List filter. Public viewers get published rows only. The owner also gets
 * their own hidden rows (flagged). Privileged admins get every row flagged
 * ONLY when `includeHiddenForAdmins` (admin/owner-management lists); public
 * surfaces never mix hidden rows in for admins.
 */
export function filterForViewer<T extends AnyRow>(
  rows: readonly T[] | null | undefined,
  viewer: ViewerContext,
  ownerOf: (row: T) => number | null | undefined,
  opts: { includeHiddenForAdmins?: boolean; includeOwnHidden?: boolean } = {},
): T[] {
  if (!Array.isArray(rows)) return [];
  const includeOwn = opts.includeOwnHidden ?? true;
  const out: T[] = [];
  for (const row of rows) {
    if (isPubliclyVisible(row)) {
      out.push(row);
      continue;
    }
    if (opts.includeHiddenForAdmins && viewer.canViewHidden) {
      out.push(withVisibilityFlag(row));
      continue;
    }
    const owner = ownerOf(row);
    if (includeOwn && viewer.userId != null && owner != null && Number(owner) === viewer.userId) {
      out.push(withVisibilityFlag(row));
    }
  }
  return out;
}

export function sendContentUnavailable(res: Response, what = "Content"): Response {
  return res.status(404).json({ message: `${what} is no longer available`, removed: true });
}

/**
 * Detail-route helper. Returns the (possibly flagged) row to send, or null
 * after having already sent the public 404.
 */
export async function resolveDetailForViewer<T extends AnyRow>(
  req: Request,
  res: Response,
  row: T,
  ownerId: number | null | undefined,
  what = "Content",
): Promise<(T & { contentVisibility?: ContentVisibilityFlag }) | null> {
  if (isPubliclyVisible(row)) return row;
  const viewer = await getViewerContext(req);
  if (canViewerSee(row, viewer, ownerId)) return withVisibilityFlag(row);
  sendContentUnavailable(res, what);
  return null;
}

/**
 * For handlers with many `res.json(...)` exits: resolve the viewer up front,
 * then every JSON payload sent by this handler is policed — a hidden single
 * row becomes the generic 404 (unless owner/dmca.view → flagged), arrays are
 * filtered with `filterForViewer`. Non-row payloads pass through untouched.
 */
export async function enforceVisibilityOnJson(
  req: Request,
  res: Response,
  ownerOf: (row: AnyRow) => number | null | undefined,
  what = "Content",
): Promise<void> {
  const viewer = await getViewerContext(req);
  const original = res.json.bind(res);
  const looksLikeRow = (v: unknown): v is AnyRow =>
    !!v && typeof v === "object" && !Array.isArray(v) && "id" in (v as AnyRow) &&
    ("visibilityStatus" in (v as AnyRow) || "visibility_status" in (v as AnyRow));
  res.json = ((body: unknown) => {
    if (res.statusCode < 300) {
      if (Array.isArray(body)) return original(filterForViewer(body as AnyRow[], viewer, ownerOf));
      if (looksLikeRow(body)) {
        if (isPubliclyVisible(body)) return original(body);
        if (canViewerSee(body, viewer, ownerOf(body))) return original(withVisibilityFlag(body));
        res.status(404);
        return original({ message: `${what} is no longer available`, removed: true });
      }
    }
    return original(body);
  }) as any;
}

// ---------------------------------------------------------------------------
// Id-based filtering for loaders whose SELECT does not carry the visibility
// columns (joined/aggregated queries, raw SQL, search, sitemap). The set of
// non-published rows is small, so we load it and filter by id.
// ---------------------------------------------------------------------------
export interface HiddenInfo {
  id: number;
  visibilityStatus: string;
  hiddenAt: Date | null;
  hiddenReason: string | null;
  dmcaCaseId: number | null;
  legalHold: boolean;
  ownerId: number | null;
}

export async function loadHiddenIndex(type: DmcaContentType): Promise<Map<number, HiddenInfo>> {
  const def = getContentTypeDef(type);
  const out = new Map<number, HiddenInfo>();
  if (!def.hasVisibilityColumns) return out;
  const r = await db.execute(sql`
    SELECT id, visibility_status, hidden_at, hidden_reason, dmca_case_id, legal_hold, ${sql.identifier(def.ownerColumn)} AS owner_id
    FROM ${sql.identifier(def.table)} WHERE visibility_status <> 'published'`);
  for (const row of r.rows as any[]) {
    out.set(Number(row.id), {
      id: Number(row.id),
      visibilityStatus: String(row.visibility_status),
      hiddenAt: row.hidden_at ?? null,
      hiddenReason: row.hidden_reason ?? null,
      dmcaCaseId: row.dmca_case_id == null ? null : Number(row.dmca_case_id),
      legalHold: !!row.legal_hold,
      ownerId: row.owner_id == null ? null : Number(row.owner_id),
    });
  }
  return out;
}

/**
 * Filter rows (matched by `idOf(row)`, default `row.id`) against the hidden
 * index. Owners keep their own hidden rows, flagged; everyone else loses them.
 * Pass `ANONYMOUS_VIEWER` for strictly public surfaces (sitemap, OG, search).
 */
export async function filterByHiddenIndex<T extends AnyRow>(
  type: DmcaContentType,
  rows: readonly T[] | null | undefined,
  viewer: ViewerContext = ANONYMOUS_VIEWER,
  idOf: (row: T) => unknown = (row) => row.id,
): Promise<T[]> {
  if (!Array.isArray(rows) || rows.length === 0) return Array.isArray(rows) ? [...rows] : [];
  const hidden = await loadHiddenIndex(type);
  if (hidden.size === 0) return [...rows];
  const out: T[] = [];
  for (const row of rows) {
    const info = hidden.get(Number(idOf(row)));
    if (!info) {
      out.push(row);
      continue;
    }
    if (viewer.userId != null && info.ownerId === viewer.userId) {
      out.push(withVisibilityFlag({ ...row, visibilityStatus: info.visibilityStatus, hiddenAt: info.hiddenAt, hiddenReason: info.hiddenReason, dmcaCaseId: info.dmcaCaseId, legalHold: info.legalHold }));
    }
  }
  return out;
}

/** Is a single content id publicly visible? (for parent checks, OG tags, etc.) */
export async function isContentIdPublic(type: DmcaContentType, id: number): Promise<boolean> {
  const def = getContentTypeDef(type);
  if (!def.hasVisibilityColumns) return true;
  const r = await db.execute(sql`SELECT visibility_status FROM ${sql.identifier(def.table)} WHERE id = ${id}`);
  const row = r.rows[0] as any;
  return !row || row.visibility_status === PUBLISHED;
}
