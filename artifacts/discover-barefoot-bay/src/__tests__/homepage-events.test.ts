import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import { calendarDayWindow, calendarEventsKey, fetchCalendarEvents } from "../lib/calendar-events";
import { homepageClockDelay, homepageEventsOptions, selectHomepageEvents } from "../lib/homepage-events";
import { shouldLoadBannerMedia } from "../lib/banner-media-window";

const today = new Date(2026, 9, 4, 12);
const event = (id: number, overrides: Partial<Event> = {}) => ({
  id, category: "social", title: "Gathering",
  startDate: new Date(2026, 9, 4, 13), endDate: new Date(2026, 9, 4, 14),
  mediaUrls: ["/event.jpg"], ...overrides,
} as Event);
const waitFor = async (predicate: () => boolean) => {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("Query did not reach the expected state");
};
const client = () => new QueryClient({
  defaultOptions: { queries: { gcTime: 0, retry: false, placeholderData: () => [] } },
});

describe("homepage bounded events", () => {
  it("sends local-day ISO boundaries, credentials and cancellation, with no archive request", async t => {
    const calls: { url: string; options?: RequestInit }[] = [];
    t.mock.method(globalThis, "fetch", async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      return new Response(JSON.stringify([event(1)]));
    });
    const options = homepageEventsOptions(10, today);
    const signal = new AbortController().signal;
    const rows = await options.queryFn({ signal });
    const params = new URL(calls[0].url, "https://example.com").searchParams;
    const window = calendarDayWindow(today);
    assert.equal(params.get("start"), window.start.toISOString());
    assert.equal(params.get("end"), window.end.toISOString());
    assert.equal(calls[0].options?.credentials, "include");
    assert.equal(calls[0].options?.signal, signal);
    assert.deepEqual(rows[0].mediaUrls, ["/event.jpg"]);
    assert.equal(calls.length, 1);
  });

  it("keeps the key stable during a day, shared with the calendar, isolated by account and changed at midnight", () => {
    const window = calendarDayWindow(today);
    assert.deepEqual(homepageEventsOptions(10, today).queryKey, calendarEventsKey(10, window));
    assert.deepEqual(homepageEventsOptions(10, today).queryKey, homepageEventsOptions(10, new Date(2026, 9, 4, 23)).queryKey);
    assert.notDeepEqual(homepageEventsOptions(10, today).queryKey, homepageEventsOptions(11, today).queryKey);
    assert.notDeepEqual(homepageEventsOptions(10, today).queryKey, homepageEventsOptions(undefined, today).queryKey);
    assert.notDeepEqual(homepageEventsOptions(10, today).queryKey, homepageEventsOptions(10, new Date(2026, 9, 5)).queryKey);
  });

  it("wakes after local midnight, including 23/25-hour DST days, without changing queries every minute", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      for (const [month, day, duration] of [[2, 8, 23], [10, 1, 25]]) {
        const date = new Date(2026, month, day, 12);
        const key = homepageEventsOptions(10, date).queryKey;
        assert.equal((Date.parse(key[4]) - Date.parse(key[3])) / 3_600_000, duration);
        assert.equal(homepageClockDelay(date), 60_000);
        assert.equal(homepageClockDelay(new Date(2026, month, day, 23, 59, 59, 999)), 26);
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("preserves start-day semantics, promotion server order, now/past order and sponsor exclusion without mutating data", () => {
    const rows = [
      event(1, { startDate: new Date(2026, 9, 4, 8), endDate: new Date(2026, 9, 4, 9) }),
      event(2), event(3, { category: "promotional", startDate: new Date(2026, 9, 4, 17) }),
      event(4, { category: "promotional", startDate: new Date(2026, 9, 4, 6) }),
      event(5, { category: "platinum_sponsor" }),
      event(6, { startDate: new Date(2026, 9, 3, 10), endDate: new Date(2026, 9, 4, 14) }),
      event(7, { startDate: new Date(2026, 9, 5) }),
      event(8, { startDate: new Date(2026, 9, 4, 11), endDate: today }),
    ];
    assert.deepEqual(selectHomepageEvents(rows, "all", today).map(e => e.id), [3, 4, 8, 2, 1]);
    assert.deepEqual(selectHomepageEvents(rows, "social", today).map(e => e.id), [8, 2, 1]);
    assert.deepEqual(selectHomepageEvents(rows, "promotional", today).map(e => e.id), [3, 4]);
    assert.deepEqual(selectHomepageEvents(rows, "platinum_sponsor", today), []);
    assert.deepEqual(selectHomepageEvents(rows, "government", today), []);
    assert.deepEqual(rows.map(e => e.id), [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("shows real pending/error/success-empty states despite the global placeholder, and retries successfully", async t => {
    let release: () => void = () => {};
    t.mock.method(globalThis, "fetch", () => new Promise<Response>(resolve => {
      release = () => resolve(new Response('{"message":"Unavailable"}', { status: 500 }));
    }));
    const cache = client();
    const observer = new QueryObserver(cache, homepageEventsOptions(undefined, today));
    const unsubscribe = observer.subscribe(() => {});
    try {
      assert.equal(observer.getCurrentResult().isLoading, true);
      assert.equal(observer.getCurrentResult().isPlaceholderData, false);
      assert.equal(observer.getCurrentResult().data, undefined);
      release();
      await waitFor(() => observer.getCurrentResult().isError);
      assert.match(observer.getCurrentResult().error!.message, /500.*Unavailable/);
      assert.equal(observer.getCurrentResult().isLoading, false);
      t.mock.method(globalThis, "fetch", async () => new Response("[]"));
      await observer.refetch();
      assert.equal(observer.getCurrentResult().isSuccess, true);
      assert.deepEqual(observer.getCurrentResult().data, []);
    } finally { unsubscribe(); cache.clear(); }
  });

  it("never substitutes one account's rows while the next account is pending", async t => {
    let resolveNext: (response: Response) => void = () => {};
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      if (++calls === 1) return new Response(JSON.stringify([event(10)]));
      return new Promise<Response>(resolve => { resolveNext = resolve; });
    });
    const cache = client();
    const observer = new QueryObserver(cache, homepageEventsOptions(10, today));
    const unsubscribe = observer.subscribe(() => {});
    try {
      await waitFor(() => observer.getCurrentResult().isSuccess);
      observer.setOptions(homepageEventsOptions(11, today));
      assert.equal(observer.getCurrentResult().data, undefined);
      assert.equal(observer.getCurrentResult().isLoading, true);
      resolveNext(new Response(JSON.stringify([event(11)])));
      await waitFor(() => observer.getCurrentResult().isSuccess);
      assert.equal(observer.getCurrentResult().data![0].id, 11);
    } finally { unsubscribe(); cache.clear(); }
  });

  it("reuses a fresh day on calendar navigation and refreshes on existing event-mutation invalidation", async t => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify([event(++calls)])));
    const cache = client();
    let unsubscribe = () => {};
    try {
      await cache.fetchQuery(homepageEventsOptions(10, today));
      const window = calendarDayWindow(today);
      const observer = new QueryObserver(cache, {
        queryKey: calendarEventsKey(10, window),
        queryFn: ({ signal }) => fetchCalendarEvents(window, signal),
        placeholderData: undefined, staleTime: 60_000,
      });
      unsubscribe = observer.subscribe(() => {});
      assert.equal(observer.getCurrentResult().data![0].id, 1);
      assert.equal(calls, 1);
      await cache.invalidateQueries({ queryKey: ["/api/events"] });
      assert.equal(observer.getCurrentResult().data![0].id, 2);
      assert.equal(calls, 2);
    } finally { unsubscribe(); cache.clear(); }
  });

  it("aborts in-flight day requests when their observer unmounts", async t => {
    let aborted = false;
    t.mock.method(globalThis, "fetch", (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    }));
    const cache = client();
    const observer = new QueryObserver(cache, homepageEventsOptions(10, today));
    const unsubscribe = observer.subscribe(() => {});
    unsubscribe();
    await waitFor(() => aborted);
    cache.clear();
  });

  it("wires distinct UI states, retry and cleaned-up clock listeners without reintroducing a loader animation", () => {
    const page = readFileSync(new URL("../pages/home-page.tsx", import.meta.url), "utf8");
    const clock = readFileSync(new URL("../hooks/use-homepage-clock.ts", import.meta.url), "utf8");
    assert.match(page, /useQuery\(homepageEventsOptions\(user\?\.id, today\)\)/);
    assert.match(page, /eventsQuery\.isError/);
    assert.match(page, /eventsQuery\.isLoading/);
    assert.match(page, /sortedTodaysEvents\.length === 0/);
    assert.match(page, /eventsQuery\.refetch\(\)/);
    assert.doesNotMatch(page, /isLoading \|\|.*length|queryKey: \["\/api\/events"\]|coastal|micro.?animation/i);
    assert.match(clock, /setTimeout\(tick, homepageClockDelay\(current\)\)/);
    assert.match(clock, /removeEventListener\("focus", tick\)/);
    assert.match(clock, /removeEventListener\("visibilitychange", onVisible\)/);
    assert.match(clock, /clearTimeout\(timer\)/);
  });

  it("does not start search archives before typing and does not label unfinished or failed search as empty", () => {
    const search = readFileSync(new URL("../components/home/unified-search.tsx", import.meta.url), "utf8");
    assert.match(search, /const hasSearch = query\.trim\(\)\.length > 0/);
    assert.equal((search.match(/enabled: hasSearch,/g) ?? []).length, 5);
    assert.match(search, /enabled: hasSearch && !!category\.id/);
    assert.equal((search.match(/placeholderData: undefined/g) ?? []).length, 5);
    assert.match(search, /results\.length === 0 && !searchLoading && !searchFailed/);
    assert.match(search, /filter\(result => result\.isError\)\.forEach\(result => result\.refetch\(\)\)/);
  });
});

describe("homepage banner media budget", () => {
  it("loads current/adjacent slides with wraparound and preserves all slides for navigation", () => {
    const loaded = (current: number, count: number) => Array.from({ length: count }, (_, i) => i).filter(i => shouldLoadBannerMedia(i, current, count));
    assert.deepEqual(loaded(0, 14), [0, 1, 13]);
    assert.deepEqual(loaded(7, 14), [6, 7, 8]);
    assert.deepEqual(loaded(13, 14), [0, 12, 13]);
    assert.deepEqual(loaded(0, 1), [0]);
    assert.deepEqual(loaded(0, 2), [0, 1]);
    assert.equal(shouldLoadBannerMedia(0, 0, 0), false);
  });
  it("gates both image/video layouts and avoids preloading every image or timestamp remounts", () => {
    const showcase = readFileSync(new URL("../components/home/community-showcase.tsx", import.meta.url), "utf8");
    assert.equal((showcase.match(/!shouldLoadBannerMedia\(index, current, communityImages\.length\)/g) ?? []).length, 2);
    assert.doesNotMatch(showcase, /prefetchCriticalMedia|new Image|forceRerender|canvas\.toDataURL/);
    assert.match(showcase, /CarouselItem key=\{`\$\{index\}-\$\{image\.src\}`\}/);
    assert.match(showcase, /api\.scrollNext\(\)/);
  });
});