import { and, eq, gte, ilike, inArray, isNull, lt, sql } from "drizzle-orm";
import { events, type Event } from "@workspace/db";
import type { db } from "./db";

export interface EventReadOptions {
  start?: Date;
  end?: Date;
  search?: string;
}

/** Date windows are half-open; an event ending at the start still overlaps. */
export function parseEventReadOptions(query: Record<string, unknown>): EventReadOptions {
  const { start, end, search } = query;
  const options: EventReadOptions = {};
  if (start !== undefined || end !== undefined) {
    const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
    if (typeof start !== "string" || typeof end !== "string" || !instant.test(start) || !instant.test(end)) {
      throw new Error("Provide both start and end as ISO timestamps with a timezone.");
    }
    options.start = new Date(start);
    options.end = new Date(end);
    const duration = options.end.getTime() - options.start.getTime();
    if (!Number.isFinite(duration) || duration <= 0 || duration > 93 * 86400000) {
      throw new Error("The event date range must be positive and no longer than 93 days.");
    }
  }
  if (search !== undefined) {
    if (typeof search !== "string" || search.length > 200 || !search.trim()) {
      throw new Error("Search must contain between 1 and 200 characters.");
    }
    options.search = search.trim();
  }
  return options;
}

export function addChildCounts<T extends Pick<Event, "id" | "isRecurring" | "parentEventId">>(
  rows: T[], counts: Map<number, number>,
): Array<T & { childCount?: number }> {
  return rows.map(event => event.isRecurring && !event.parentEventId
    ? { ...event, childCount: counts.get(event.id) ?? 0 }
    : event);
}

/** Never issue a query per recurring parent: at most two queries per list. */
export async function readEvents(executor: Pick<typeof db, "select">, options: EventReadOptions = {}): Promise<Event[]> {
  const predicates = [];
  if (options.start && options.end) {
    predicates.push(lt(events.startDate, options.end), gte(events.endDate, options.start));
  }
  if (options.search) {
    // User-entered % and _ are literals, not SQL wildcards.
    predicates.push(ilike(events.title, `%${options.search.replace(/[\\%_]/g, "\\$&")}%`));
  }
  const rows = await executor.select().from(events).where(and(...predicates));
  const counts = new Map<number, number>();
  if (predicates.length === 0) {
    // Legacy full-collection consumers already have all the children in memory.
    for (const row of rows) {
      if (row.parentEventId != null) counts.set(row.parentEventId, (counts.get(row.parentEventId) ?? 0) + 1);
    }
  } else {
    const parentIds = rows.filter(row => row.isRecurring && !row.parentEventId).map(row => row.id);
    if (parentIds.length) {
      const grouped = await executor.select({
        parentId: events.parentEventId,
        count: sql<number>`count(*)`.mapWith(Number),
      }).from(events).where(inArray(events.parentEventId, parentIds)).groupBy(events.parentEventId);
      for (const row of grouped) counts.set(row.parentId!, row.count);
    }
  }
  return addChildCounts(rows, counts);
}

/** Sponsor widgets must not fetch/count the entire event archive. */
export async function readActiveSponsors(executor: Pick<typeof db, "select">, now = new Date()): Promise<Event[]> {
  return executor.select().from(events).where(and(
    eq(events.category, "platinum_sponsor"),
    isNull(events.parentEventId),
    sql`${events.startDate} <= ${now}`,
    gte(events.endDate, now),
    // Match the legacy visibility helper's treatment of NULL/empty status.
    sql`coalesce(nullif(${events.visibilityStatus}, ''), 'published') = 'published'`,
  )).orderBy(events.createdAt).limit(3);
}