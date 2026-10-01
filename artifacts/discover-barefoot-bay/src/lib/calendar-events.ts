import { addDays, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import type { Event } from "@shared/schema";

export type CalendarWindow = { start: Date; end: Date };
export type CalendarSortOrder = "asc" | "desc" | "now";

// Day grouping intentionally uses browser-local dates, just as the calendar did
// with isSameDay. Event time labels remain Eastern time in the page.
export const calendarDayKey = (date: Date) => format(date, "yyyy-MM-dd");

export function calendarDayWindow(date: Date): CalendarWindow {
  const start = startOfDay(date);
  return { start, end: addDays(start, 1) };
}

export function calendarVisibleWindow(view: "month" | "week" | "day", month: Date, selected: Date): CalendarWindow {
  if (view === "day") return calendarDayWindow(selected);
  const start = startOfWeek(view === "month" ? startOfMonth(month) : selected);
  const lastDay = endOfWeek(view === "month" ? endOfMonth(month) : selected);
  return { start, end: addDays(startOfDay(lastDay), 1) };
}

export function windowContains(outer: CalendarWindow, inner: CalendarWindow) {
  return outer.start <= inner.start && outer.end >= inner.end;
}

export function calendarEventsKey(userId: number | undefined, window: CalendarWindow) {
  return ["/api/events", userId ?? "anonymous", "window", window.start.toISOString(), window.end.toISOString()] as const;
}

export function calendarSearchKey(userId: number | undefined, search: string) {
  return ["/api/events", userId ?? "anonymous", "search", search] as const;
}

export async function fetchCalendarEvents(
  params: CalendarWindow | { search: string },
  signal?: AbortSignal,
): Promise<Event[]> {
  const query = "search" in params
    ? new URLSearchParams({ search: params.search })
    : new URLSearchParams({ start: params.start.toISOString(), end: params.end.toISOString() });
  const response = await fetch(`/api/events?${query}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || response.statusText;
    try {
      const body = JSON.parse(text);
      message = body.message || body.error || message;
    } catch {
      // Preserve the actual non-JSON response rather than silently returning [].
    }
    throw new Error(`Unable to load events (${response.status}): ${message}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("Unable to load events: expected an event array.");
  return data;
}

export function filterCalendarEvents(events: Event[], category: string, badge: boolean | null, search: string) {
  const needle = search.trim().toLowerCase();
  return events.filter(event =>
    (category === "all" || event.category === category) &&
    (badge === null || event.badgeRequired === badge) &&
    (!needle || event.title.toLowerCase().includes(needle)),
  );
}

export function sortCalendarEvents(events: Event[], order: CalendarSortOrder, now: number): Event[] {
  const priority = (event: Event) => event.category === "platinum_sponsor" ? 0 : event.category === "promotional" ? 1 : 2;
  return [...events].sort((a, b) => {
    const categoryDifference = priority(a) - priority(b);
    if (categoryDifference) return categoryDifference;
    // "Now & Later" keeps promotions in their original order and puts ended
    // ordinary events after current/future events, preserving existing behavior.
    if (order === "now") {
      if (a.category === "promotional") return 0;
      if (priority(a) === 2) {
        const pastDifference = Number(new Date(a.endDate).getTime() < now) - Number(new Date(b.endDate).getTime() < now);
        if (pastDifference) return pastDifference;
      }
    }
    const difference = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    return order === "desc" ? -difference : difference;
  });
}

export function bucketCalendarEvents(events: Event[], order: CalendarSortOrder, now: number) {
  const buckets = new Map<string, Event[]>();
  for (const event of events) {
    const date = new Date(event.startDate);
    if (Number.isNaN(date.getTime())) continue;
    const key = calendarDayKey(date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(event);
    else buckets.set(key, [event]);
  }
  for (const [key, bucket] of buckets) buckets.set(key, sortCalendarEvents(bucket, order, now));
  return buckets;
}