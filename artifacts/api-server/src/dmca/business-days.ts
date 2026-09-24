/**
 * Business-day calculator for DMCA deadlines (e.g. the 10–14 business-day
 * restoration window after a valid counter-notice, 17 U.S.C. §512(g)(2)(C)).
 *
 * Business days exclude Saturdays, Sundays, and US federal holidays using
 * the OPM "observed" rule (a holiday falling on Saturday is observed on the
 * preceding Friday; on Sunday, the following Monday).
 *
 * All arithmetic is done on calendar dates in UTC. Deadlines are day-level
 * precision; the time-of-day of the start instant is preserved on the result.
 * This module is intentionally dependency-free and pure so it can be unit
 * tested exhaustively.
 */

function ymd(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateKey(d: Date): string {
  return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** nth (1-based) weekday (0=Sun) of a month, in UTC. */
function nthWeekday(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month0, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month0, 1 + offset + (n - 1) * 7));
}

function lastWeekday(year: number, month0: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month0 + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month0, last.getUTCDate() - offset));
}

function observed(d: Date): Date {
  const dow = d.getUTCDay();
  if (dow === 6) return new Date(d.getTime() - 86400000);
  if (dow === 0) return new Date(d.getTime() + 86400000);
  return d;
}

const holidayCache = new Map<number, Set<string>>();

/**
 * Observed US federal holidays for a calendar year, as YYYY-MM-DD strings.
 * Includes the observed date for next year's New Year's Day when Jan 1 falls
 * on a Saturday (observed Dec 31 of this year).
 */
export function usFederalHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const days: Date[] = [
    observed(new Date(Date.UTC(year, 0, 1))), // New Year's Day
    nthWeekday(year, 0, 1, 3), // Birthday of Martin Luther King, Jr.
    nthWeekday(year, 1, 1, 3), // Washington's Birthday
    lastWeekday(year, 4, 1), // Memorial Day
    observed(new Date(Date.UTC(year, 5, 19))), // Juneteenth
    observed(new Date(Date.UTC(year, 6, 4))), // Independence Day
    nthWeekday(year, 8, 1, 1), // Labor Day
    nthWeekday(year, 9, 1, 2), // Columbus Day
    observed(new Date(Date.UTC(year, 10, 11))), // Veterans Day
    nthWeekday(year, 10, 4, 4), // Thanksgiving Day
    observed(new Date(Date.UTC(year, 11, 25))), // Christmas Day
    observed(new Date(Date.UTC(year + 1, 0, 1))), // next New Year's (may land Dec 31)
  ];
  const set = new Set<string>();
  for (const d of days) {
    if (d.getUTCFullYear() === year) set.add(dateKey(d));
  }
  holidayCache.set(year, set);
  return set;
}

export function isFederalHoliday(d: Date): boolean {
  return usFederalHolidays(d.getUTCFullYear()).has(dateKey(d));
}

export function isBusinessDay(d: Date): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !isFederalHoliday(d);
}

/**
 * Add `n` business days to `start`. The start day itself is never counted
 * (day 1 is the first business day AFTER start), matching how statutory
 * "not less than 10, nor more than 14, business days following receipt"
 * windows are counted.
 */
export function addBusinessDays(start: Date, n: number): Date {
  if (!Number.isInteger(n) || n < 0) throw new Error(`addBusinessDays: n must be a non-negative integer, got ${n}`);
  let d = new Date(start.getTime());
  let remaining = n;
  while (remaining > 0) {
    d = new Date(d.getTime() + 86400000);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

/**
 * Number of business days strictly after `from` up to and including `to`.
 * Returns 0 when `to` is on or before `from`.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  const end = dateKey(to);
  let d = new Date(from.getTime());
  let count = 0;
  if (dateKey(d) >= end) return 0;
  while (dateKey(d) < end) {
    d = new Date(d.getTime() + 86400000);
    if (isBusinessDay(d)) count++;
  }
  return count;
}

export interface RestorationWindow {
  /** Earliest restoration date: 10 business days after counter-notice receipt. */
  eligibleAt: Date;
  /** Latest restoration date: 14 business days after counter-notice receipt. */
  deadlineAt: Date;
}

export function computeRestorationWindow(
  counterNoticeReceivedAt: Date,
  eligibleBusinessDay = 10,
  deadlineBusinessDay = 14,
): RestorationWindow {
  return {
    eligibleAt: addBusinessDays(counterNoticeReceivedAt, eligibleBusinessDay),
    deadlineAt: addBusinessDays(counterNoticeReceivedAt, deadlineBusinessDay),
  };
}
