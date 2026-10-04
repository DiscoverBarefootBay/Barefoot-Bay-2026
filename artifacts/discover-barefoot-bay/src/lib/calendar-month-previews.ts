import type { Event } from "@shared/schema";
import type { CalendarSortOrder, CalendarWindow } from "./calendar-events";

// Summaries must never be passed to EventCard or recurrence/editing forms.
export type CalendarPreview = Pick<Event, "id" | "title" | "category" | "badgeRequired"> & {
  startDate: string | Date;
  endDate: string | Date;
  contentVisibility?: { removed: boolean; status: string };
};
export type CalendarMonthPreviews = {
  days: Record<string, { total: number; previews: CalendarPreview[] }>;
};
export type CalendarMonthParams = CalendarWindow & {
  timeZone: string; category: string; badge: boolean | null;
  search: string; order: CalendarSortOrder;
};
export function calendarMonthKey(userId: number | undefined, params: CalendarMonthParams) {
  return ["/api/events", userId ?? "anonymous", "month-previews",
    params.start.toISOString(), params.end.toISOString(), params.timeZone,
    params.category, params.badge, params.search.trim(), params.order] as const;
}
export async function fetchCalendarMonthPreviews(params: CalendarMonthParams, signal?: AbortSignal): Promise<CalendarMonthPreviews> {
  const query = new URLSearchParams({ start: params.start.toISOString(), end: params.end.toISOString(),
    timeZone: params.timeZone, category: params.category, order: params.order });
  if (params.badge !== null) query.set("badge", String(params.badge));
  if (params.search.trim()) query.set("search", params.search.trim());
  const response = await fetch(`/api/events/month-previews?${query}`, {
    credentials: "include", headers: { Accept: "application/json" }, signal,
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || response.statusText;
    try { message = JSON.parse(text).message || message; } catch { /* Non-JSON server errors remain explicit. */ }
    throw new Error(`Unable to load month previews (${response.status}): ${message}`);
  }
  const data = await response.json();
  if (!data || typeof data.days !== "object" || Array.isArray(data.days) || data.days === null ||
    !Object.entries(data.days).every(([key, day]: [string, any]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isInteger(day?.total) && day.total > 0 &&
      Array.isArray(day.previews) && day.previews.length === Math.min(day.total, 3) &&
      day.previews.every((event: any) => Number.isInteger(event?.id) && typeof event.title === "string" &&
        typeof event.category === "string" && Number.isFinite(Date.parse(event.startDate)) &&
        Number.isFinite(Date.parse(event.endDate))))) {
    throw new Error("Unable to load month previews: invalid summary response.");
  }
  return data;
}