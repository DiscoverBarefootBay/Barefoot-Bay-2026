/**
 * Append-only DMCA audit writer. The dmca_audit_log table rejects UPDATE and
 * DELETE at the database level (trigger), so this module only ever inserts.
 * Pass the transaction handle as `executor` to make the audit row part of the
 * same atomic operation it describes.
 */
import { dmcaAuditLog } from "@workspace/db";
import { db } from "../db";

export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AuditActorType = "admin" | "user" | "system" | "public";

export interface DmcaAuditInput {
  event: string;
  actorType: AuditActorType;
  actorId?: number | null;
  dmcaCaseId?: number | null;
  targetType?: string | null;
  targetId?: number | null;
  ipAddress?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  notes?: string | null;
}

export async function writeDmcaAudit(entry: DmcaAuditInput, executor: DbExecutor = db): Promise<void> {
  await executor.insert(dmcaAuditLog).values({
    event: entry.event,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    dmcaCaseId: entry.dmcaCaseId ?? null,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    ipAddress: entry.ipAddress ?? null,
    previousValue: (entry.previousValue ?? null) as any,
    newValue: (entry.newValue ?? null) as any,
    notes: entry.notes ?? null,
  });
}

/** Best-effort client IP for audit rows. */
export function requestIp(req: { ip?: string; headers?: Record<string, any>; socket?: { remoteAddress?: string } }): string | null {
  const fwd = req.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}
