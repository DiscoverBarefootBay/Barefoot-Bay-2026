/**
 * Wires the legal-hold delete guard into every permanent-delete method of the
 * storage layer in one place, so no delete path can be forgotten:
 *
 *   installLegalHoldGuards(storage)  // called once where storage is created
 *
 * Each wrapped method first runs its hold check (throws LegalHoldError → 423)
 * and additionally translates the database backstop trigger error (SQLSTATE
 * BBLH1, raised for held rows reached through FK cascades or raw SQL) into a
 * LegalHoldError.
 *
 * `legalHoldResponseMiddleware` makes routes that catch errors generically
 * and answer 500 still return a clear 423 "under legal hold" response.
 */
import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  assertContentDeletable,
  assertMessageDeletable,
  assertTableDeletable,
  assertUserDeletable,
  isLegalHoldError,
  LegalHoldError,
  legalHoldContext,
} from "./legal-hold";

export const LEGAL_HOLD_SQLSTATE = "BBLH1";

type Guard = (...args: any[]) => Promise<void>;

async function idsWhere(query: ReturnType<typeof sql>): Promise<number[]> {
  const r = await db.execute(query);
  return (r.rows as any[]).map((row) => Number(row.id));
}

/** Method name → pre-delete hold check (receives the method's arguments). */
export const STORAGE_DELETE_GUARDS: Record<string, Guard> = {
  deleteUser: (id: number) => assertUserDeletable(Number(id)),

  deleteEvent: async (id: number) => {
    const children = await idsWhere(sql`SELECT id FROM events WHERE parent_event_id = ${id}`);
    await assertContentDeletable("event", [Number(id), ...children]);
  },
  deleteEventSeries: async (eventId: number) => {
    const r = await db.execute(sql`SELECT COALESCE(parent_event_id, id) AS pid FROM events WHERE id = ${eventId}`);
    const pid = (r.rows[0] as any)?.pid;
    if (pid == null) return;
    const ids = await idsWhere(sql`SELECT id FROM events WHERE id = ${pid} OR parent_event_id = ${pid}`);
    await assertContentDeletable("event", ids);
  },
  deleteChildEvents: async (parentEventId: number) => {
    const ids = await idsWhere(sql`SELECT id FROM events WHERE parent_event_id = ${parentEventId}`);
    await assertContentDeletable("event", ids);
  },
  deleteAllEvents: () => assertTableDeletable("event"),
  deleteEventComment: (id: number) => assertContentDeletable("event_comment", Number(id)),

  deleteListing: (id: number) => assertContentDeletable("listing", Number(id)),
  deleteAllListings: () => assertTableDeletable("listing"),

  deletePageContent: (id: number) => assertContentDeletable("page", Number(id)),
  deleteCommunityPages: () => assertTableDeletable("page"),
  deleteAllCommunityPages: () => assertTableDeletable("page"),
  deleteAllVendors: () => assertTableDeletable("page"),
  deleteVendorComment: (id: number) => assertContentDeletable("vendor_comment", Number(id)),

  deleteForumPost: (id: number) => assertContentDeletable("forum_post", Number(id)),
  deleteForumComment: (id: number) => assertContentDeletable("forum_comment", Number(id)),
  deleteForumCategory: async (id: number) => {
    const ids = await idsWhere(sql`SELECT id FROM forum_posts WHERE category_id = ${id}`);
    await assertContentDeletable("forum_post", ids);
  },
  deleteAllForumContent: () => assertTableDeletable("forum_post"),
  deleteAllForumComments: () => assertTableDeletable("forum_comment"),

  deleteMessage: (id: number) => assertMessageDeletable(Number(id)),
};

export function isLegalHoldDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as any;
  if (e.code === LEGAL_HOLD_SQLSTATE || e.cause?.code === LEGAL_HOLD_SQLSTATE) return true;
  return typeof e.message === "string" && e.message.includes("LEGAL_HOLD:");
}

export function toLegalHoldError(err: unknown): unknown {
  if (isLegalHoldError(err)) return err;
  if (isLegalHoldDbError(err)) return new LegalHoldError("This item (or content that would be deleted with it)");
  return err;
}

const GUARDED = Symbol.for("bb.legalHoldGuarded");

export function installLegalHoldGuards<T extends object>(target: T, guards: Record<string, Guard> = STORAGE_DELETE_GUARDS): T {
  const t = target as any;
  if (t[GUARDED]) return target;
  for (const [name, guard] of Object.entries(guards)) {
    const original = t[name];
    if (typeof original !== "function") continue;
    t[name] = async function guardedDelete(this: unknown, ...args: any[]) {
      await guard(...args);
      try {
        return await original.apply(this ?? target, args);
      } catch (err) {
        throw toLegalHoldError(err);
      }
    };
  }
  Object.defineProperty(t, GUARDED, { value: true });
  return target;
}

// ---------------------------------------------------------------------------
// Response translation
// ---------------------------------------------------------------------------
/**
 * If a legal-hold refusal happened during this request but the route's own
 * catch block answers with a generic 5xx, send a 423 with the hold message.
 */
export function legalHoldResponseMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const store: { error: LegalHoldError | null } = { error: null };
    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);
    const translate = (): boolean => {
      if (!store.error || res.statusCode < 500 || res.headersSent) return false;
      res.status(423);
      origJson({ error: "legal_hold", message: store.error.message, heldIds: store.error.heldIds });
      return true;
    };
    res.json = ((body: unknown) => (translate() ? res : origJson(body))) as any;
    res.send = ((body: unknown) => (translate() ? res : origSend(body))) as any;
    legalHoldContext.run(store, () => next());
  };
}
