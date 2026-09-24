import type { Request } from "express";
import { DmcaPermission, getUserDmcaPermissions } from "./permissions";

export class PermanentDeletePermissionError extends Error {
  readonly statusCode = 403;
  constructor() {
    super("Missing permission: dmca.permanent_delete");
  }
}

/**
 * Owners retain the existing ability to delete their own single item.
 * Every non-owner delete, and every bulk delete, needs the explicit grant.
 */
export async function assertCanPermanentDelete(req: Request, immutableOwnerId?: number | null): Promise<void> {
  const user = req.user as any;
  if (immutableOwnerId != null && Number(immutableOwnerId) === Number(user?.id)) return;
  if (!(await getUserDmcaPermissions(user)).has(DmcaPermission.PERMANENT_DELETE)) {
    throw new PermanentDeletePermissionError();
  }
}