import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { parseMonthPreviewOptions, readMonthPreviewRows, summarizeMonthPreviews, type PreviewRow } from "../event-month-previews";
import { ANONYMOUS_VIEWER, filterForViewer } from "../dmca/content-visibility";

const options = (extra = {}) => parseMonthPreviewOptions({
  start: "2026-10-01T04:00:00Z", end: "2026-11-01T04:00:00Z", timeZone: "America/New_York", ...extra,
});
const row = (id: number, extra = {}) => ({
  id, title: "Community event", category: "social", badgeRequired: false,
  startDate: new Date("2026-10-04T14:00:00Z"), endDate: new Date("2026-10-04T15:00:00Z"),
  visibilityStatus: "published", createdBy: 1, ...extra,
} as PreviewRow);
const now = Date.parse("2026-10-04T16:00:00Z");

describe("month preview input and narrow database read", () => {
  it("requires bounded instants, validates timezone/filters and preserves false badges", () => {
    assert.equal(options({ badge: "false" }).badge, false);
    assert.equal(options({ search: " DANCE " }).search, "dance");
    for (const change of [
      { start: undefined, end: undefined }, { start: "bad" }, { end: "2027-02-01T00:00:00Z" },
      { timeZone: "Moon/Sea" }, { timeZone: [] }, { order: "bad" }, { badge: "yes" },
      { category: [] }, { search: "x".repeat(201) }, { search: [] },
    ]) assert.throws(() => options(change));
  });
  it("selects only preview/policy fields in one bounded start-day query", async () => {
    let calls = 0;
    let fields: any;
    let query: any;
    const chain: any = { from: () => chain, where: (predicate: any) => {
      query = new PgDialect().sqlToQuery(predicate); return Promise.resolve([row(1)]);
    } };
    const result = await readMonthPreviewRows({ select: (projection: any) => { calls++; fields = projection; return chain; } } as any, options());
    assert.equal(calls, 1);
    assert.equal(result.length, 1);
    assert.equal(fields.description, undefined);
    assert.equal(fields.mediaUrls, undefined);
    assert.equal(fields.parentEventId, undefined);
    assert.ok(fields.visibilityStatus && fields.createdBy && fields.hiddenReason);
    assert.match(query.sql, /"start_date" >= .*"start_date" </);
  });
});
describe("month summary semantics", () => {
  it("uses the same central list policy for anonymous, owner, unrelated resident and privileged staff before counts/limits", () => {
    const rows = [row(1), row(2, { visibilityStatus: "dmca_hidden", createdBy: 7 }),
      row(3, { visibilityStatus: "moderation_hidden", createdBy: 7 }),
      row(4, { visibilityStatus: "user_deleted", createdBy: 9 }), row(5)];
    const counts = (viewer: any) => summarizeMonthPreviews(filterForViewer(rows, viewer, r => r.createdBy), options(), now).days["2026-10-04"];
    assert.equal(counts(ANONYMOUS_VIEWER).total, 2);
    assert.equal(counts({ userId: 8, canViewHidden: false }).total, 2);
    assert.equal(counts({ userId: 7, canViewHidden: false }).total, 3);
    assert.equal(counts({ userId: 8, canViewHidden: true, canViewModerated: true }).total, 2);
    assert.equal(counts({ userId: 7, canViewHidden: true, canViewModerated: true }).total, 3);
    assert.ok(counts({ userId: 7, canViewHidden: false }).previews.find(r => r.id === 2)?.contentVisibility?.removed);
  });
  it("counts all authorized matches, returns three previews and excludes full fields", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, { description: "large private card", mediaUrls: ["/image"] }));
    const result = summarizeMonthPreviews(rows, options(), now).days["2026-10-04"];
    assert.equal(result.total, 12);
    assert.equal(result.previews.length, 3);
    assert.equal("description" in result.previews[0], false);
    assert.equal("createdBy" in result.previews[0], false);
    assert.equal("mediaUrls" in result.previews[0], false);
  });
  it("filters before counting/limiting, including literal search and null badges", () => {
    const rows = [row(1), row(2, { title: "Dance 100%", badgeRequired: true }),
      row(3, { title: "Dance 100%", badgeRequired: false }), row(4, { badgeRequired: null })];
    const summary = summarizeMonthPreviews(rows, options({ badge: "false", search: " 100% " }), now);
    assert.equal(summary.days["2026-10-04"].total, 1);
    assert.equal(summary.days["2026-10-04"].previews[0].id, 3);
    assert.deepEqual(summarizeMonthPreviews(rows, options({ category: "government" }), now), { days: {} });
  });
  it("preserves priorities, promotion input order, ascending/descending and now/past", () => {
    const rows = [row(1), row(2, { startDate: new Date("2026-10-04T18:00:00Z"), endDate: new Date("2026-10-04T19:00:00Z") }),
      row(3, { category: "promotional" }), row(4, { category: "platinum_sponsor" })];
    const ids = (change: object) => summarizeMonthPreviews(rows, options(change), now).days["2026-10-04"].previews.map(r => r.id);
    assert.deepEqual(ids({ order: "asc" }), [4, 3, 1]);
    assert.deepEqual(ids({ order: "desc" }), [4, 3, 2]);
    assert.deepEqual(ids({ order: "now" }), [4, 3, 2]);
    assert.deepEqual(summarizeMonthPreviews([row(5, { category: "promotional" }), row(6, { category: "promotional" })], options(), now).days["2026-10-04"].previews.map(r => r.id), [5, 6]);
  });
  it("uses the requested local start-day across DST and midnight, never overlap days", () => {
    const opts = parseMonthPreviewOptions({ start: "2026-11-01T04:00:00Z", end: "2026-11-03T05:00:00Z", timeZone: "America/New_York" });
    const rows = [row(1, { startDate: new Date("2026-11-01T05:30:00Z") }),
      row(2, { startDate: new Date("2026-11-01T06:30:00Z") }),
      row(3, { startDate: new Date("2026-11-02T04:59:59Z"), endDate: new Date("2026-11-03T10:00:00Z") }),
      row(4, { startDate: new Date("2026-11-02T05:00:00Z") }),
      row(5, { startDate: new Date("2026-11-03T05:00:00Z") })];
    const summary = summarizeMonthPreviews(rows, opts, now).days;
    assert.equal(summary["2026-11-01"].total, 3);
    assert.equal(summary["2026-11-02"].total, 1);
    assert.equal(summary["2026-11-03"], undefined);
  });
  it("preserves authorized hidden-content flags without spreading internal policy fields", () => {
    const flag = { removed: true, status: "dmca_hidden", reason: "notice" };
    const preview = summarizeMonthPreviews([row(1, { contentVisibility: flag })], options(), now).days["2026-10-04"].previews[0];
    assert.deepEqual(preview.contentVisibility, flag);
    assert.equal("hiddenReason" in preview, false);
  });
});