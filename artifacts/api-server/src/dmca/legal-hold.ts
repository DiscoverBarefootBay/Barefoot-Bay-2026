/**
 * Legal-hold delete guard.
 *
 * Every permanent-delete path (single, bulk, "delete all", cascades, and user
 * account deletion) must call one of the assert* functions BEFORE deleting.
 * A hold blocks deletion for everyone — including full admins — until an
 * audited hold release (dmca-service.releaseLegalHold).
 *
 * An item is held when its own `legal_hold` column is true, an unreleased
 * row in `legal_holds` points at it, or it is currently `dmca_hidden` (a
 * takedown is evidence and must stay reversible — never hard-deleted).
 */
import { AsyncLocalStorage } from "async_hooks";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { CONTENT_TYPES, type DmcaContentType } from "./content-registry";
import type { DbExecutor } from "./audit";

/** Per-request context so a generic 5xx route response can be turned into a 423 (see storage-guards). */
export const legalHoldContext = new AsyncLocalStorage<{ error: LegalHoldError | null }>();

export class LegalHoldError extends Error {
  override readonly name = "LegalHoldError";
  readonly statusCode = 423;
  readonly code = "LEGAL_HOLD";
  constructor(readonly what: string, readonly heldIds: number[] = []) {
    super(`${what} is under legal hold and cannot be permanently deleted. An authorized legal admin must release the hold first.`);
    const store = legalHoldContext.getStore();
    if (store) store.error = this;
  }
}

export function isLegalHoldError(err: unknown): err is LegalHoldError {
  return err instanceof Error && (err as any).code === "LEGAL_HOLD";
}

/** Express helper: turn a LegalHoldError into a 423 response. Returns true when handled. */
export function respondIfLegalHold(err: unknown, res: { status: (n: number) => { json: (b: unknown) => unknown }; headersSent?: boolean }): boolean {
  if (!isLegalHoldError(err)) return false;
  if (!res.headersSent) {
    res.status(423).json({ error: "legal_hold", message: err.message, heldIds: err.heldIds });
  }
  return true;
}

const LABELS: Record<DmcaContentType, string> = {
  forum_post: "This forum post",
  forum_comment: "This forum comment",
  listing: "This listing",
  event: "This event",
  event_comment: "This event comment",
  page: "This page",
  vendor_comment: "This comment",
  avatar: "This avatar",
};

function idArray(ids: readonly number[]): number[] {
  return [...new Set(ids.map(Number).filter((n) => Number.isInteger(n)))];
}

/** Drizzle does not serialize a JS array interpolated into raw SQL as a pg int[]. */
export function pgIntArray(ids: readonly number[]) {
  return sql`ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::int[]`;
}

/** Ids (from the given set) that are held, for a content type. */
export async function findHeldContentIds(type: DmcaContentType, ids: readonly number[], executor: DbExecutor = db): Promise<number[]> {
  const list = idArray(ids);
  if (list.length === 0) return [];
  const def = CONTENT_TYPES[type];
  const held = new Set<number>();
  if (def.hasVisibilityColumns) {
    const r = await executor.execute(
      sql`SELECT id FROM ${sql.identifier(def.table)} WHERE id = ANY(${pgIntArray(list)}) AND (legal_hold = true OR visibility_status = 'dmca_hidden')`,
    );
    for (const row of r.rows as any[]) held.add(Number(row.id));
  }
  const h = await executor.execute(
    sql`SELECT DISTINCT content_id FROM legal_holds WHERE released_at IS NULL AND content_type = ${type} AND content_id = ANY(${pgIntArray(list)})`,
  );
  for (const row of h.rows as any[]) held.add(Number(row.content_id));
  return [...held];
}

/**
 * Child rows that are destroyed along with a parent (cascading deletes) must
 * be checked too, otherwise deleting a post would silently destroy a held
 * comment.
 */
async function heldCascadeChildren(type: DmcaContentType, ids: number[], executor: DbExecutor): Promise<string | null> {
  if (ids.length === 0) return null;
  if (type === "forum_post") {
    const r = await executor.execute(sql`
      SELECT c.id FROM forum_comments c
      WHERE c.post_id = ANY(${pgIntArray(ids)})
        AND (c.legal_hold = true OR c.visibility_status = 'dmca_hidden' OR EXISTS (
          SELECT 1 FROM legal_holds h WHERE h.released_at IS NULL AND h.content_type = 'forum_comment' AND h.content_id = c.id))
      LIMIT 1`);
    if (r.rows.length) return "A comment on this post";
  }
  if (type === "event") {
    const r = await executor.execute(sql`
      SELECT 'x' AS k FROM events e
      WHERE e.parent_event_id = ANY(${pgIntArray(ids)})
        AND (e.legal_hold = true OR e.visibility_status = 'dmca_hidden' OR EXISTS (
          SELECT 1 FROM legal_holds h WHERE h.released_at IS NULL AND h.content_type = 'event' AND h.content_id = e.id))
      UNION ALL
      SELECT 'x' FROM event_comments c
      WHERE c.event_id = ANY(${pgIntArray(ids)})
        AND (c.legal_hold = true OR c.visibility_status = 'dmca_hidden' OR EXISTS (
          SELECT 1 FROM legal_holds h WHERE h.released_at IS NULL AND h.content_type = 'event_comment' AND h.content_id = c.id))
      LIMIT 1`);
    if (r.rows.length) return "An occurrence or comment of this event";
  }
  if (type === "page") {
    const r = await executor.execute(sql`
      SELECT c.id FROM vendor_comments c
      JOIN page_contents p ON p.slug = c.page_slug
      WHERE p.id = ANY(${pgIntArray(ids)})
        AND (c.legal_hold = true OR c.visibility_status = 'dmca_hidden' OR EXISTS (
          SELECT 1 FROM legal_holds h WHERE h.released_at IS NULL AND h.content_type = 'vendor_comment' AND h.content_id = c.id))
      LIMIT 1`);
    if (r.rows.length) return "A comment on this page";
  }
  return null;
}

/** Throws LegalHoldError when any of the ids (or their cascaded children) is held. */
export async function assertContentDeletable(type: DmcaContentType, ids: number | readonly number[], executor: DbExecutor = db): Promise<void> {
  const list = idArray(Array.isArray(ids) ? ids : [ids as number]);
  if (list.length === 0) return;
  const held = await findHeldContentIds(type, list, executor);
  if (held.length > 0) throw new LegalHoldError(list.length > 1 ? "One or more selected items" : LABELS[type], held);
  const child = await heldCascadeChildren(type, list, executor);
  if (child) throw new LegalHoldError(child, list);
}

/**
 * Guard for "delete ALL rows of this type" operations: blocked if ANY row of
 * the type (or a cascaded child type) is held.
 */
export async function assertTableDeletable(type: DmcaContentType, executor: DbExecutor = db): Promise<void> {
  const cascade: Partial<Record<DmcaContentType, DmcaContentType[]>> = {
    forum_post: ["forum_comment"],
    event: ["event_comment"],
    page: ["vendor_comment"],
  };
  for (const t of [type, ...(cascade[type] ?? [])]) {
    const def = CONTENT_TYPES[t];
    if (def.hasVisibilityColumns) {
      const r = await executor.execute(sql`SELECT id FROM ${sql.identifier(def.table)} WHERE legal_hold = true OR visibility_status = 'dmca_hidden' LIMIT 1`);
      if (r.rows.length) throw new LegalHoldError(`At least one ${t.replace("_", " ")}`, [Number((r.rows[0] as any).id)]);
    }
    const h = await executor.execute(sql`SELECT content_id FROM legal_holds WHERE released_at IS NULL AND content_type = ${t} LIMIT 1`);
    if (h.rows.length) throw new LegalHoldError(`At least one ${t.replace("_", " ")}`, [Number((h.rows[0] as any).content_id)]);
  }
}

/**
 * User account deletion cascades across dozens of tables, so it is blocked
 * when the user, any of their content, or any of their messages is held.
 */
export async function assertUserDeletable(userId: number, executor: DbExecutor = db): Promise<void> {
  const u = await executor.execute(sql`SELECT legal_hold FROM users WHERE id = ${userId}`);
  if ((u.rows[0] as any)?.legal_hold === true) throw new LegalHoldError("This user account", [userId]);
  const h = await executor.execute(sql`SELECT id FROM legal_holds WHERE released_at IS NULL AND user_id = ${userId} LIMIT 1`);
  if (h.rows.length) throw new LegalHoldError("This user account", [userId]);

  for (const def of Object.values(CONTENT_TYPES)) {
    if (!def.hasVisibilityColumns) continue;
    const r = await executor.execute(sql`
      SELECT t.id FROM ${sql.identifier(def.table)} t
      WHERE t.${sql.identifier(def.ownerColumn)} = ${userId}
        AND (t.legal_hold = true OR t.visibility_status = 'dmca_hidden' OR EXISTS (
          SELECT 1 FROM legal_holds lh WHERE lh.released_at IS NULL AND lh.content_type = ${def.type} AND lh.content_id = t.id))
      LIMIT 1`);
    if (r.rows.length) throw new LegalHoldError(`This user account (it owns held ${def.type.replace("_", " ")} content)`, [userId]);
  }
  const avatarHold = await executor.execute(
    sql`SELECT id FROM legal_holds WHERE released_at IS NULL AND content_type = 'avatar' AND content_id = ${userId} LIMIT 1`,
  );
  if (avatarHold.rows.length) throw new LegalHoldError("This user account (its avatar is held)", [userId]);
  // Any active takedown involving this user (as uploader or avatar owner) is
  // evidence: the account cannot be deleted while it is still taken down.
  const activeTakedown = await executor.execute(sql`
    SELECT id FROM dmca_targets WHERE status = 'taken_down'
      AND (uploader_user_id = ${userId} OR (content_type = 'avatar' AND content_id = ${userId}))
    LIMIT 1`);
  if (activeTakedown.rows.length) throw new LegalHoldError("This user account (it has content under an active DMCA takedown)", [userId]);
  const m = await executor.execute(sql`SELECT id FROM messages WHERE sender_id = ${userId} AND legal_hold = true LIMIT 1`);
  if (m.rows.length) throw new LegalHoldError("This user account (it has held messages)", [userId]);
}

export async function assertMessageDeletable(messageId: number, executor: DbExecutor = db): Promise<void> {
  const r = await executor.execute(sql`SELECT legal_hold FROM messages WHERE id = ${messageId}`);
  if ((r.rows[0] as any)?.legal_hold === true) throw new LegalHoldError("This message", [messageId]);
}

/** For bulk "delete everything" operations on messages. */
export async function assertNoHeldMessages(executor: DbExecutor = db): Promise<void> {
  const r = await executor.execute(sql`SELECT id FROM messages WHERE legal_hold = true LIMIT 1`);
  if (r.rows.length) throw new LegalHoldError("At least one message", [Number((r.rows[0] as any).id)]);
}
