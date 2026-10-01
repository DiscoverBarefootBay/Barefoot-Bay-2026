import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Event } from "@shared/schema";
import {
  bucketCalendarEvents, calendarDayKey, calendarDayWindow, calendarEventsKey,
  calendarSearchKey, calendarVisibleWindow, fetchCalendarEvents,
  filterCalendarEvents, sortCalendarEvents, windowContains,
} from "../lib/calendar-events";

const event = (id: number, overrides: Partial<Event> = {}) => ({
  id, title: "Community gathering", category: "social", badgeRequired: false,
  startDate: new Date(2026, 4, 12, 10), endDate: new Date(2026, 4, 12, 11),
  mediaUrls: ["/uploads/gathering.jpg"], description: "<p>Details</p>",
  ...overrides,
} as Event);

describe("calendar windows and cache identity", () => {
  it("includes both month spillovers using an exclusive next-day boundary", () => {
    const selected = new Date(2026, 4, 12);
    const range = calendarVisibleWindow("month", selected, selected);
    assert.equal(calendarDayKey(range.start), "2026-04-26");
    assert.equal(calendarDayKey(range.end), "2026-06-07");
    assert.ok(windowContains(range, calendarDayWindow(new Date(2026, 5, 6))));
    assert.ok(!windowContains(range, calendarDayWindow(new Date(2026, 5, 7))));
    assert.ok(!windowContains(range, calendarDayWindow(new Date(2020, 1, 1))));
    assert.ok(range.end.getTime() - range.start.getTime() < 93 * 86400000);
  });

  it("bounds week/day requests to selected dates even when displayed month is far away", () => {
    const selected = new Date(2020, 1, 12);
    const month = new Date(2030, 8, 1);
    const week = calendarVisibleWindow("week", month, selected);
    assert.equal(calendarDayKey(week.start), "2020-02-09");
    assert.equal(calendarDayKey(week.end), "2020-02-16");
    assert.deepEqual(calendarVisibleWindow("day", month, selected), calendarDayWindow(selected));
  });

  it("isolates users, windows and search under the existing invalidation prefix", () => {
    const window = calendarDayWindow(new Date(2026, 4, 12));
    assert.equal(calendarEventsKey(1, window)[0], "/api/events");
    assert.notDeepEqual(calendarEventsKey(1, window), calendarEventsKey(2, window));
    assert.notDeepEqual(calendarEventsKey(1, window), calendarEventsKey(undefined, window));
    assert.notDeepEqual(calendarSearchKey(1, "dance"), calendarEventsKey(1, window));
    assert.notDeepEqual(calendarSearchKey(1, "dance"), calendarSearchKey(2, "dance"));
  });

  it("uses local midnight boundaries over Eastern DST transitions, not fixed 24-hour durations", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const spring = calendarDayWindow(new Date(2026, 2, 8, 12));
      const fall = calendarDayWindow(new Date(2026, 10, 1, 12));
      assert.equal(spring.start.toISOString(), "2026-03-08T05:00:00.000Z");
      assert.equal(spring.end.toISOString(), "2026-03-09T04:00:00.000Z");
      assert.equal(fall.end.getTime() - fall.start.getTime(), 25 * 3600000);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});

describe("calendar buckets preserve display rules and complete event objects", () => {
  it("groups by local start date, not overlap, and retains media/card fields", () => {
    const multiDay = event(1, { endDate: new Date(2026, 4, 14) });
    const nextDay = event(2, { startDate: new Date(2026, 4, 13, 0) });
    const buckets = bucketCalendarEvents([multiDay, nextDay], "asc", 0);
    assert.deepEqual(buckets.get("2026-05-12"), [multiDay]);
    assert.deepEqual(buckets.get("2026-05-13"), [nextDay]);
    assert.equal(buckets.get("2026-05-12")?.[0], multiDay);
    assert.equal(buckets.has("2026-05-14"), false);
  });

  it("applies category, badge and trimmed case-insensitive title filters once", () => {
    const events = [event(1), event(2, { title: "DANCE class", badgeRequired: true }), event(3, { category: "government", title: "Dance meeting", badgeRequired: true })];
    assert.deepEqual(filterCalendarEvents(events, "social", true, " dance ").map(e => e.id), [2]);
    assert.equal(filterCalendarEvents(events, "all", null, "").length, 3);
  });

  it("keeps platinum then promotions first and now/later before ended ordinary events", () => {
    const now = new Date(2026, 4, 12, 12).getTime();
    const events = [
      event(1), event(2, { startDate: new Date(2026, 4, 12, 14), endDate: new Date(2026, 4, 12, 15) }),
      event(3, { category: "promotional" }), event(4, { category: "platinum_sponsor" }),
    ];
    assert.deepEqual(sortCalendarEvents(events, "now", now).map(e => e.id), [4, 3, 2, 1]);
    assert.deepEqual(sortCalendarEvents(events, "asc", now).map(e => e.id), [4, 3, 1, 2]);
    assert.deepEqual(sortCalendarEvents(events, "desc", now).map(e => e.id), [4, 3, 2, 1]);
    assert.deepEqual(events.map(e => e.id), [1, 2, 3, 4]);
  });
});

describe("calendar API requests", () => {
  it("sends bounded ISO instants or search-only historical requests with credentials and cancellation", async (t) => {
    const calls: { url: string; options?: RequestInit }[] = [];
    const expected = event(9);
    t.mock.method(globalThis, "fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      return new Response(JSON.stringify([expected]), { status: 200 });
    });
    const range = calendarDayWindow(new Date(2026, 4, 12));
    const signal = new AbortController().signal;
    const data = await fetchCalendarEvents(range, signal);
    const params = new URL(calls[0].url, "https://example.com").searchParams;
    assert.equal(params.get("start"), range.start.toISOString());
    assert.equal(params.get("end"), range.end.toISOString());
    assert.equal(calls[0].options?.credentials, "include");
    assert.equal(calls[0].options?.signal, signal);
    assert.deepEqual(data[0].mediaUrls, expected.mediaUrls);
    await fetchCalendarEvents({ search: "historic dance" });
    const search = new URL(calls[1].url, "https://example.com").searchParams;
    assert.equal(search.get("search"), "historic dance");
    assert.equal(search.has("start"), false);
    assert.equal(search.has("end"), false);
  });

  it("throws HTTP, malformed JSON and non-array errors instead of treating them as empty", async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response('{"message":"Access denied"}', { status: 403 }));
    await assert.rejects(fetchCalendarEvents({ search: "dance" }), /403.*Access denied/);
    t.mock.method(globalThis, "fetch", async () => new Response("not json", { status: 200 }));
    await assert.rejects(fetchCalendarEvents({ search: "dance" }), SyntaxError);
    t.mock.method(globalThis, "fetch", async () => new Response('{"data":[]}', { status: 200 }));
    await assert.rejects(fetchCalendarEvents({ search: "dance" }), /expected an event array/);
  });

  it("distinguishes a successful empty result", async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response("[]", { status: 200 }));
    assert.deepEqual(await fetchCalendarEvents({ search: "no match" }), []);
  });

  it("locks page wiring for explicit queries, debounce, separate selected-day fetch and empty/error states", () => {
    const page = readFileSync(new URL("../pages/calendar-page.tsx", import.meta.url), "utf8");
    assert.equal((page.match(/placeholderData: undefined/g) ?? []).length, 3);
    assert.match(page, /enabled: needsSelectedQuery/);
    assert.match(page, /setDebouncedSearch\(searchQuery\.trim\(\)\), 300/);
    assert.match(page, /fetchCalendarEvents\(\{ search: debouncedSearch \}, signal\)/);
    assert.match(page, /updateSelectedDate\(new Date\(event\.startDate\)\)/);
    assert.match(page, /selectedDayQuery\.isError/);
    assert.match(page, /visibleEventsQuery\.isError/);
    assert.match(page, /searchEventsQuery\.isError/);
    assert.doesNotMatch(page, /isLoading \|\| .*length === 0/);
    assert.doesNotMatch(page, /isSameDay|useQuery<Event\[\]>\(\{\s*queryKey: \["\/api\/events"\]/);
  });
});