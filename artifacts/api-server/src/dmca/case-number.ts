/**
 * Human-readable DMCA case numbers: BB-DMCA-<YEAR>-<6-digit sequence>,
 * e.g. BB-DMCA-2026-000142. The sequence restarts each calendar year and is
 * allocated atomically (upsert … RETURNING) so concurrent submissions never
 * collide.
 */
import { sql } from "drizzle-orm";
import type { DbExecutor } from "./audit";

export const CASE_NUMBER_RE = /^BB-DMCA-(\d{4})-(\d{6,})$/;

export function formatCaseNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new Error(`invalid year ${year}`);
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`invalid sequence ${seq}`);
  return `BB-DMCA-${year}-${String(seq).padStart(6, "0")}`;
}

export function parseCaseNumber(value: string): { year: number; seq: number } | null {
  const m = CASE_NUMBER_RE.exec(value);
  return m ? { year: Number(m[1]), seq: Number(m[2]) } : null;
}

export async function allocateCaseNumber(executor: DbExecutor, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const r = await executor.execute(sql`
    INSERT INTO dmca_case_counters (year, last_value) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET last_value = dmca_case_counters.last_value + 1
    RETURNING last_value`);
  return formatCaseNumber(year, Number((r.rows[0] as any).last_value));
}
