import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { calendarDayWindow, calendarEventsKey, calendarVisibleWindow, fetchCalendarEvents } from "../lib/calendar-events";
import { calendarMonthKey, fetchCalendarMonthPreviews } from "../lib/calendar-month-previews";

const selected = new Date(2026, 9, 4);
const params = {
  ...calendarVisibleWindow("month", selected, selected), timeZone: "America/New_York",
  category: "all", badge: null as boolean | null, search: "", order: "now" as const,
};
const preview = { id: 1, title: "Gathering", category: "social", badgeRequired: false,
  startDate: "2026-10-04T14:00:00Z", endDate: "2026-10-04T15:00:00Z" };
const summary = { days: { "2026-10-04": { total: 6, previews: [preview, { ...preview, id: 2 }, { ...preview, id: 3 }] } } };
const options = (userId?: number, extra = {}) => {
  const p = { ...params, ...extra };
  return { queryKey: calendarMonthKey(userId, p), queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchCalendarMonthPreviews(p, signal), placeholderData: undefined, staleTime: 60_000, retry: false as const };
};
const waitFor = async (condition: () => boolean) => {
  for (let i = 0; i < 200; i++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("Query did not reach expected state.");
};
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, placeholderData: () => [] } } });

describe("month summary requests and query isolation", () => {
  it("includes spillover boundaries, local timezone and every filter with credentials/cancellation", async t => {
    let call: any;
    t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      call = { url, init }; return new Response(JSON.stringify(summary));
    });
    const signal = new AbortController().signal;
    assert.deepEqual(await fetchCalendarMonthPreviews({ ...params, badge: false, search: " dance " }, signal), summary);
    const url = new URL(call.url, "https://example.com");
    assert.equal(url.pathname, "/api/events/month-previews");
    assert.equal(url.searchParams.get("start"), params.start.toISOString());
    assert.equal(url.searchParams.get("end"), params.end.toISOString());
    assert.equal(url.searchParams.get("timeZone"), "America/New_York");
    assert.equal(url.searchParams.get("badge"), "false");
    assert.equal(url.searchParams.get("search"), "dance");
    assert.equal(url.searchParams.get("order"), "now");
    assert.equal(call.init.signal, signal);
    assert.equal(call.init.credentials, "include");
  });
  it("keeps full-day and summary caches distinct while including every request-affecting parameter", () => {
    const key = calendarMonthKey(1, params);
    assert.equal(key[0], "/api/events");
    assert.notDeepEqual(key, calendarEventsKey(1, calendarDayWindow(selected)));
    assert.notDeepEqual(key, calendarMonthKey(2, params));
    for (const extra of [{ category: "social" }, { badge: false }, { search: "dance" }, { order: "asc" as const },
      { timeZone: "UTC" }, { end: new Date(2026, 11, 1) }]) {
      assert.notDeepEqual(key, calendarMonthKey(1, { ...params, ...extra }));
    }
  });
  it("fails explicitly on HTTP and malformed summaries, including missing totals or more than three previews", async t => {
    t.mock.method(globalThis, "fetch", async () => new Response('{"message":"Unavailable"}', { status: 500 }));
    await assert.rejects(fetchCalendarMonthPreviews(params), /500.*Unavailable/);
    for (const data of [[], null, { days: [] }, { days: { "2026-10-04": { previews: [] } } },
      { days: { "2026-10-04": { total: 4, previews: [preview, preview, preview, preview] } } }]) {
      t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(data)));
      await assert.rejects(fetchCalendarMonthPreviews(params), /invalid summary response/);
    }
    t.mock.method(globalThis, "fetch", async () => new Response('{"days":{}}'));
    assert.deepEqual(await fetchCalendarMonthPreviews(params), { days: {} });
  });
  it("does not substitute global empty placeholders or an earlier account while pending, and supports Retry", async t => {
    let release: (response: Response) => void = () => {};
    t.mock.method(globalThis, "fetch", () => new Promise<Response>(resolve => { release = resolve; }));
    const cache = client();
    const observer = new QueryObserver(cache, options(1));
    const unsubscribe = observer.subscribe(() => {});
    try {
      assert.equal(observer.getCurrentResult().isLoading, true);
      assert.equal(observer.getCurrentResult().data, undefined);
      release(new Response('{"message":"Unavailable"}', { status: 500 }));
      await waitFor(() => observer.getCurrentResult().isError);
      t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(summary)));
      await observer.refetch();
      assert.deepEqual(observer.getCurrentResult().data, summary);
      t.mock.method(globalThis, "fetch", () => new Promise<Response>(resolve => { release = resolve; }));
      observer.setOptions(options(2));
      assert.equal(observer.getCurrentResult().data, undefined);
      assert.equal(observer.getCurrentResult().isLoading, true);
      release(new Response('{"days":{}}'));
      await waitFor(() => observer.getCurrentResult().isSuccess);
      assert.deepEqual(observer.getCurrentResult().data, { days: {} });
    } finally { unsubscribe(); cache.clear(); }
  });
  it("invalidates both previews/counts and complete day cards without mixing their shapes", async t => {
    const calls: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify(url.includes("month-previews") ? summary :
        [{ ...preview, description: "Full details", mediaUrls: ["/image"], id: 99 }]));
    });
    const cache = client();
    const month = new QueryObserver(cache, options(1));
    const day = new QueryObserver(cache, {
      queryKey: calendarEventsKey(1, calendarDayWindow(selected)),
      queryFn: ({ signal }) => fetchCalendarEvents(calendarDayWindow(selected), signal),
      placeholderData: undefined, staleTime: 60_000,
    });
    const stopMonth = month.subscribe(() => {});
    const stopDay = day.subscribe(() => {});
    try {
      await waitFor(() => month.getCurrentResult().isSuccess && day.getCurrentResult().isSuccess);
      assert.equal(calls.length, 2);
      assert.equal(day.getCurrentResult().data![0].description, "Full details");
      await cache.invalidateQueries({ queryKey: ["/api/events"] });
      assert.equal(calls.length, 4);
      assert.deepEqual(month.getCurrentResult().data, summary);
      assert.deepEqual(day.getCurrentResult().data![0].mediaUrls, ["/image"]);
    } finally { stopMonth(); stopDay(); cache.clear(); }
  });
  it("cancels stale filter/month requests instead of letting them replace a newer summary", async t => {
    let aborted = false;
    t.mock.method(globalThis, "fetch", (_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); }, { once: true });
    }));
    const cache = client();
    const observer = new QueryObserver(cache, options());
    const stop = observer.subscribe(() => {});
    observer.setOptions(options(undefined, { category: "social" }));
    await waitFor(() => aborted);
    assert.equal(observer.getCurrentResult().data, undefined);
    stop(); cache.clear();
  });
  it("wires month-only summaries and complete selected-day retrieval, counts and local navigation", () => {
    const page = readFileSync(new URL("../pages/calendar-page.tsx", import.meta.url), "utf8");
    assert.match(page, /needsSelectedQuery = viewType === "month"/);
    assert.match(page, /enabled: viewType !== "month"/);
    assert.match(page, /enabled: viewType === "month"/);
    assert.match(page, /monthPreviewsQuery\.data\?\.days\[calendarDayKey\(date\)\]/);
    assert.match(page, /summary\?\.total/);
    assert.match(page, /monthPreviewsQuery\.isError/);
    assert.match(page, /monthPending \?/);
    assert.match(page, /new Date\(`\$\{dateFromUrl\}T00:00:00`\)/);
    assert.match(page, /urlParams\.set\('date', calendarDayKey\(newDate\)\)/);
    assert.match(page, /selectedEventId, selectedDayQuery\.data/);
    assert.doesNotMatch(page, /(?:summary|previews).*as Event\[\]|coastal.*loader/i);
  });
});