/**
 * DMCA / legal-hold / visibility fields may only be written by the DMCA
 * service. Two layers keep clients from setting them:
 *
 *   1. `stripServerOnlyBodyFieldsMiddleware` removes the unambiguous DMCA
 *      keys from every JSON/form request body before any route runs.
 *   2. `installServerOnlyFieldStripping(storage)` strips the full list
 *      (including deletedAt) from the data objects passed to the storage
 *      create/update methods of the user-content tables, and legalHold from
 *      user/message writes.
 */
import type { Request, Response, NextFunction } from "express";
import { DMCA_SERVER_ONLY_FIELDS } from "@workspace/db";

/** Keys no legitimate non-DMCA client request ever sends. */
const BODY_STRIP_KEYS = new Set<string>(
  DMCA_SERVER_ONLY_FIELDS.filter((k) => k !== "deletedAt" && k !== "deleted_at"),
);

export function stripKeys<T>(value: T, keys: ReadonlySet<string>): T {
  if (!value || typeof value !== "object" || Array.isArray(value) || Buffer.isBuffer(value) || value instanceof Date) return value;
  let copy: Record<string, unknown> | null = null;
  for (const k of Object.keys(value as object)) {
    if (keys.has(k)) {
      copy ??= { ...(value as Record<string, unknown>) };
      delete copy[k];
    }
  }
  return (copy ?? value) as T;
}

export function stripServerOnlyBodyFieldsMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === "object" && !req.path.startsWith("/api/dmca/")) {
      req.body = stripKeys(req.body, BODY_STRIP_KEYS);
    }
    next();
  };
}

const CONTENT_KEYS = new Set<string>(DMCA_SERVER_ONLY_FIELDS);
const HOLD_ONLY_KEYS = new Set<string>(["legalHold", "legal_hold"]);

export const STORAGE_WRITE_METHODS: Record<string, ReadonlySet<string>> = {
  createForumPost: CONTENT_KEYS,
  updateForumPost: CONTENT_KEYS,
  createForumComment: CONTENT_KEYS,
  updateForumComment: CONTENT_KEYS,
  createListing: CONTENT_KEYS,
  updateListing: CONTENT_KEYS,
  createEvent: CONTENT_KEYS,
  updateEvent: CONTENT_KEYS,
  createEventComment: CONTENT_KEYS,
  createPageContent: CONTENT_KEYS,
  updatePageContent: CONTENT_KEYS,
  createVendorComment: CONTENT_KEYS,
  createUser: HOLD_ONLY_KEYS,
  updateUser: HOLD_ONLY_KEYS,
  createMessage: HOLD_ONLY_KEYS,
};

const STRIPPED = Symbol.for("bb.serverOnlyFieldsStripped");

export function installServerOnlyFieldStripping<T extends object>(target: T, methods: Record<string, ReadonlySet<string>> = STORAGE_WRITE_METHODS): T {
  const t = target as any;
  if (t[STRIPPED]) return target;
  for (const [name, keys] of Object.entries(methods)) {
    const original = t[name];
    if (typeof original !== "function") continue;
    t[name] = function stripServerOnly(this: unknown, ...args: any[]) {
      return original.apply(this ?? target, args.map((a) => stripKeys(a, keys)));
    };
  }
  Object.defineProperty(t, STRIPPED, { value: true });
  return target;
}
