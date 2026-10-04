import { and, gte, lt } from "drizzle-orm";
import { events, type Event } from "@workspace/db";
import type { db } from "./db";
import { parseEventReadOptions } from "./event-read-model";
import type { ContentVisibilityFlag } from "./dmca/content-visibility";

export type MonthPreviewOptions = {
  start: Date; end: Date; timeZone: string; category: string;
  badge: boolean | null; search: string; order: "asc" | "desc" | "now";
};
export type PreviewRow = Pick<Event,
  "id" | "title" | "category" | "startDate" | "endDate" | "badgeRequired" |
  "createdBy" | "visibilityStatus" | "hiddenAt" | "hiddenReason" | "dmcaCaseId" | "legalHold"
> & { contentVisibility?: ContentVisibilityFlag };
export type EventPreview = Pick<PreviewRow, "id" | "title" | "category" | "startDate" | "endDate" | "badgeRequired"> &
  { contentVisibility?: ContentVisibilityFlag };

export function parseMonthPreviewOptions(query: Record<string, unknown>): MonthPreviewOptions {
  const range = parseEventReadOptions({ start: query.start, end: query.end });
  if (!range.start || !range.end) throw new Error("A bounded month window is required.");
  const timeZone = query.timeZone;
  if (typeof timeZone !== "string" || timeZone.length > 100) throw new Error("A valid timeZone is required.");
  try { new Intl.DateTimeFormat("en", { timeZone }); }
  catch { throw new Error("A valid timeZone is required."); }
  const category = query.category ?? "all";
  if (typeof category !== "string" || !["all", "entertainment", "government", "social", "promotional", "bulletin", "platinum_sponsor", "other"].includes(category)) {
    throw new Error("Invalid event category.");
  }
  const order = query.order ?? "now";
  if (order !== "asc" && order !== "desc" && order !== "now") throw new Error("Invalid event order.");
  if (query.badge !== undefined && query.badge !== "true" && query.badge !== "false") throw new Error("Invalid badge filter.");
  const search = query.search ?? "";
  if (typeof search !== "string" || search.length > 200) throw new Error("Search must be at most 200 characters.");
  return { start: range.start, end: range.end, timeZone, category, order,
    badge: query.badge === undefined ? null : query.badge === "true", search: search.trim().toLowerCase() };
}

/** One narrow SELECT, no full-card fields or recurring-child count queries. */
export async function readMonthPreviewRows(executor: Pick<typeof db, "select">, options: MonthPreviewOptions): Promise<PreviewRow[]> {
  return executor.select({
    id: events.id, title: events.title, category: events.category,
    startDate: events.startDate, endDate: events.endDate, badgeRequired: events.badgeRequired,
    createdBy: events.createdBy, visibilityStatus: events.visibilityStatus,
    hiddenAt: events.hiddenAt, hiddenReason: events.hiddenReason,
    dmcaCaseId: events.dmcaCaseId, legalHold: events.legalHold,
  }).from(events).where(and(gte(events.startDate, options.start), lt(events.startDate, options.end)));
}

/** Call only AFTER the central viewer policy; counts must not reveal hidden rows. */
export function summarizeMonthPreviews(authorizedRows: PreviewRow[], options: MonthPreviewOptions, now = Date.now()) {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: options.timeZone,
    year: "numeric", month: "2-digit", day: "2-digit" });
  const days: Record<string, { total: number; previews: EventPreview[] }> = {};
  const buckets = new Map<string, PreviewRow[]>();
  for (const row of authorizedRows) {
    if ((options.category !== "all" && row.category !== options.category) ||
      (options.badge !== null && row.badgeRequired !== options.badge) ||
      (options.search && !row.title.toLowerCase().includes(options.search))) continue;
    const start = new Date(row.startDate);
    if (!Number.isFinite(start.getTime()) || start < options.start || start >= options.end) continue;
    const parts = formatter.formatToParts(start);
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    const key = `${part("year")}-${part("month")}-${part("day")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row); else buckets.set(key, [row]);
  }
  const priority = (row: PreviewRow) => row.category === "platinum_sponsor" ? 0 : row.category === "promotional" ? 1 : 2;
  for (const [key, rows] of buckets) {
    rows.sort((a, b) => {
      const categoryDifference = priority(a) - priority(b);
      if (categoryDifference) return categoryDifference;
      if (options.order === "now") {
        if (a.category === "promotional") return 0; // Preserve server order.
        if (priority(a) === 2) {
          const past = Number(new Date(a.endDate).getTime() < now) - Number(new Date(b.endDate).getTime() < now);
          if (past) return past;
        }
      }
      const difference = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      return options.order === "desc" ? -difference : difference;
    });
    days[key] = { total: rows.length, previews: rows.slice(0, 3).map(row => ({
      id: row.id, title: row.title, category: row.category, startDate: row.startDate,
      endDate: row.endDate, badgeRequired: row.badgeRequired,
      ...(row.contentVisibility ? { contentVisibility: row.contentVisibility } : {}),
    })) };
  }
  return { days };
}