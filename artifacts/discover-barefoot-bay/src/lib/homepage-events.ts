import { isSameDay } from "date-fns";
import type { Event } from "@shared/schema";
import { calendarDayWindow, calendarEventsKey, fetchCalendarEvents } from "./calendar-events";

export function homepageEventsOptions(userId: number | undefined, today: Date) {
  const window = calendarDayWindow(today);
  return {
    queryKey: calendarEventsKey(userId, window),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchCalendarEvents(window, signal),
    // The global empty-array placeholder otherwise disguises pending requests.
    placeholderData: undefined,
    staleTime: 60_000,
    retry: false as const,
  };
}

/** Refresh ordering each minute, and change the query just after local midnight. */
export function homepageClockDelay(now: Date) {
  return Math.min(60_000, calendarDayWindow(now).end.getTime() - now.getTime() + 25);
}

export function selectHomepageEvents(events: Event[], category: string, today: Date) {
  // The bounded endpoint returns overlaps. Preserve the homepage's start-day
  // rule, rather than accidentally adding events that began on an earlier day.
  const todaysEvents = events.filter(event =>
    event.category !== "platinum_sponsor" &&
    (category === "all" || event.category === category) &&
    isSameDay(new Date(event.startDate), today),
  );
  const promotional = todaysEvents.filter(event => event.category === "promotional");
  const ordinary = todaysEvents.filter(event => event.category !== "promotional");
  const byStart = (a: Event, b: Event) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  const current = ordinary.filter(event => new Date(event.endDate).getTime() >= today.getTime()).sort(byStart);
  const past = ordinary.filter(event => new Date(event.endDate).getTime() < today.getTime()).sort(byStart);
  // Promotion order intentionally follows the server, as it did previously.
  return [...promotional, ...current, ...past];
}