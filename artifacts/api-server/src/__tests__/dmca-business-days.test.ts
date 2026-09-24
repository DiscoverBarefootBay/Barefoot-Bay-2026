import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessDays,
  businessDaysBetween,
  computeRestorationWindow,
  isBusinessDay,
  isFederalHoliday,
  usFederalHolidays,
} from "../dmca/business-days";

const utc = (s: string) => new Date(`${s}T15:30:00.000Z`);

describe("DMCA business-day arithmetic", () => {
  it("skips Saturday and Sunday and preserves the time of day", () => {
    const result = addBusinessDays(utc("2026-06-05"), 1);
    assert.equal(result.toISOString(), "2026-06-08T15:30:00.000Z");
    assert.equal(businessDaysBetween(utc("2026-06-05"), result), 1);
  });

  it("recognizes federal holidays and their observed dates", () => {
    assert.equal(isFederalHoliday(utc("2026-07-03")), true);
    assert.equal(isBusinessDay(utc("2026-07-03")), false);
    assert.equal(isBusinessDay(utc("2026-07-04")), false);
    assert.ok(usFederalHolidays(2026).has("2026-07-03"));
    assert.equal(addBusinessDays(utc("2026-07-02"), 1).toISOString(), "2026-07-06T15:30:00.000Z");
  });

  it("includes the prior-year observation of a Saturday New Year's Day", () => {
    assert.ok(usFederalHolidays(2021).has("2021-12-31"));
  });

  it("computes the statutory 10–14 business-day restoration window", () => {
    const start = utc("2026-06-30");
    const window = computeRestorationWindow(start);
    assert.equal(window.eligibleAt.toISOString(), "2026-07-15T15:30:00.000Z");
    assert.equal(window.deadlineAt.toISOString(), "2026-07-21T15:30:00.000Z");
    assert.equal(businessDaysBetween(start, window.eligibleAt), 10);
    assert.equal(businessDaysBetween(start, window.deadlineAt), 14);
  });

  it("rejects negative and fractional business-day counts", () => {
    assert.throws(() => addBusinessDays(utc("2026-01-01"), -1));
    assert.throws(() => addBusinessDays(utc("2026-01-01"), 1.5));
  });
});