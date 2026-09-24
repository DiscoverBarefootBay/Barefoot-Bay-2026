/**
 * DMCA role-based permissions.
 *
 * Grants live in dmca_permission_grants (one row per user+permission).
 * Being a site admin does NOT implicitly grant DMCA powers — existing admins
 * received the Legal Admin bundle at rollout (see the DMCA foundation SQL),
 * and later grants are managed explicitly and audited.
 *
 * Moderators implicitly hold `dmca.flag` (they can flag content for DMCA
 * review) so the default Moderator bundle needs no per-user rows.
 */
import type { Request, Response, NextFunction } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { dmcaPermissionGrants } from "@workspace/db";
import { db } from "../db";
import { writeDmcaAudit, type DbExecutor } from "./audit";

export const DmcaPermission = {
  FLAG: "dmca.flag",
  VIEW: "dmca.view",
  CREATE: "dmca.create",
  REVIEW: "dmca.review",
  TAKEDOWN: "dmca.takedown",
  RESTORE: "dmca.restore",
  MANAGE_HOLDS: "dmca.manage_holds",
  MANAGE_REPEAT_INFRINGER: "dmca.manage_repeat_infringer",
  VIEW_PRIVATE_FILES: "dmca.view_private_files",
  PERMANENT_DELETE: "dmca.permanent_delete",
  MANAGE_PERMISSIONS: "dmca.manage_permissions",
} as const;
export type DmcaPermission = typeof DmcaPermission[keyof typeof DmcaPermission];

export const ALL_DMCA_PERMISSIONS: readonly DmcaPermission[] = Object.values(DmcaPermission);

export function isDmcaPermission(v: unknown): v is DmcaPermission {
  return typeof v === "string" && (ALL_DMCA_PERMISSIONS as readonly string[]).includes(v);
}

const P = DmcaPermission;

export const DMCA_ROLE_BUNDLES = {
  /** Can flag content for DMCA review; cannot see or act on cases. */
  moderator: [P.FLAG],
  /** Day-to-day case handling: review, takedown, restore, repeat-infringer records. */
  dmca_admin: [P.FLAG, P.VIEW, P.CREATE, P.REVIEW, P.TAKEDOWN, P.RESTORE, P.MANAGE_REPEAT_INFRINGER, P.VIEW_PRIVATE_FILES],
  /** Everything, including legal holds, permanent deletion and permission management. */
  legal_admin: [...ALL_DMCA_PERMISSIONS],
} as const satisfies Record<string, readonly DmcaPermission[]>;
export type DmcaRoleBundle = keyof typeof DMCA_ROLE_BUNDLES;

export interface DmcaViewer {
  id: number;
  role?: string | null;
}

/** Permissions implied by the site role, without any grant rows. */
export function implicitPermissionsForRole(role: string | null | undefined): DmcaPermission[] {
  if (role === "moderator") return [...DMCA_ROLE_BUNDLES.moderator];
  return [];
}

export async function getUserDmcaPermissions(user: DmcaViewer | null | undefined, executor: DbExecutor = db): Promise<Set<DmcaPermission>> {
  const perms = new Set<DmcaPermission>();
  if (!user || typeof user.id !== "number") return perms;
  for (const p of implicitPermissionsForRole(user.role)) perms.add(p);
  const rows = await executor
    .select({ permission: dmcaPermissionGrants.permission })
    .from(dmcaPermissionGrants)
    .where(eq(dmcaPermissionGrants.userId, user.id));
  for (const r of rows) if (isDmcaPermission(r.permission)) perms.add(r.permission);
  return perms;
}

/** Per-request memoised permission lookup. */
export async function getRequestDmcaPermissions(req: Request): Promise<Set<DmcaPermission>> {
  const anyReq = req as any;
  if (anyReq._dmcaPermissions) return anyReq._dmcaPermissions;
  const user = typeof req.isAuthenticated === "function" && req.isAuthenticated() ? (req.user as any) : null;
  const perms = await getUserDmcaPermissions(user);
  anyReq._dmcaPermissions = perms;
  return perms;
}

export async function hasDmcaPermission(user: DmcaViewer | null | undefined, permission: DmcaPermission): Promise<boolean> {
  return (await getUserDmcaPermissions(user)).has(permission);
}

/** Express middleware: authenticated user holding ALL listed permissions. */
export function requireDmcaPermission(...required: DmcaPermission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (typeof req.isAuthenticated !== "function" || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated", message: "You must be logged in to access this resource" });
      }
      const perms = await getRequestDmcaPermissions(req);
      const missing = required.filter((p) => !perms.has(p));
      if (missing.length > 0) {
        return res.status(403).json({ error: "DMCA permission required", message: `Missing permission: ${missing.join(", ")}`, missing });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function grantDmcaPermissions(
  opts: { userId: number; permissions: readonly DmcaPermission[]; grantedBy: number | null; ipAddress?: string | null },
  executor: DbExecutor = db,
): Promise<void> {
  const permissions = opts.permissions.filter(isDmcaPermission);
  if (permissions.length === 0) return;
  await executor
    .insert(dmcaPermissionGrants)
    .values(permissions.map((permission) => ({ userId: opts.userId, permission, grantedBy: opts.grantedBy })))
    .onConflictDoNothing();
  await writeDmcaAudit(
    {
      event: "permissions_granted",
      actorType: opts.grantedBy ? "admin" : "system",
      actorId: opts.grantedBy,
      targetType: "user",
      targetId: opts.userId,
      ipAddress: opts.ipAddress ?? null,
      newValue: { permissions },
    },
    executor,
  );
}

export async function revokeDmcaPermissions(
  opts: { userId: number; permissions: readonly DmcaPermission[]; revokedBy: number; ipAddress?: string | null },
  executor: DbExecutor = db,
): Promise<void> {
  const permissions = opts.permissions.filter(isDmcaPermission);
  if (permissions.length === 0) return;
  await executor
    .delete(dmcaPermissionGrants)
    .where(and(eq(dmcaPermissionGrants.userId, opts.userId), inArray(dmcaPermissionGrants.permission, permissions as string[])));
  await writeDmcaAudit(
    {
      event: "permissions_revoked",
      actorType: "admin",
      actorId: opts.revokedBy,
      targetType: "user",
      targetId: opts.userId,
      ipAddress: opts.ipAddress ?? null,
      previousValue: { permissions },
    },
    executor,
  );
}

export async function grantDmcaBundle(
  opts: { userId: number; bundle: DmcaRoleBundle; grantedBy: number | null; ipAddress?: string | null },
  executor: DbExecutor = db,
): Promise<void> {
  await grantDmcaPermissions({ userId: opts.userId, permissions: DMCA_ROLE_BUNDLES[opts.bundle], grantedBy: opts.grantedBy, ipAddress: opts.ipAddress }, executor);
}
