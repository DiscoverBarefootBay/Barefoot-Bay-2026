---
name: Analytics session-derived metrics
description: Why session durations and "active users" counts go wrong in this analytics pipeline and how to compute them safely.
---

# Analytics session-derived metrics

## Session duration must be clamped
`analytics_sessions.end_timestamp` is bumped to NOW() on every pageview/event, so a
returning visitor's single row can span days. Any metric averaging
`EXTRACT(EPOCH FROM (end_timestamp - start_timestamp))` will be wildly inflated
(observed prod avg ~51,531s / ~859m).

**Rule:** when computing avg/typical session duration, clamp each row with
`AVG(LEAST(EXTRACT(EPOCH FROM (end - start)), 1800))` (30-min session timeout) and
require `end_timestamp >= start_timestamp`. Lives in `analytics-service.ts`
`getEnhancedOverview` (the `durQ`).

**Why:** the 30-min cap matches the documented session-inactivity timeout, so a
clamped session ≈ real engaged time, not "tab left open for 3 days".

## "Active users" is a 15-minute, site-wide concept here
The admin site-wide active-users feed is `GET /api/analytics/activeusers`
(`getActiveUsers`, 15-minute window). It is distinct from the page-scoped
`getActiveUsersForPage` (5-minute window, `/api/active-users?path=...`).

**Why this bites:** the page-scoped `useActiveUsers(path: string)` hook and the
site-wide need look interchangeable but are not. Passing a poll interval as the
`path` arg silently produces a wrong/zeroed feed. Dashboard widgets must use the
site-wide hook/endpoint; keep UI copy on the 15-minute window to match the backend.

## google.maps usage in geo views
`@react-google-maps/api` loads `google.maps` lazily, so it is `undefined` on the
first renders. Guard every `google.maps.*` read (LatLng, SymbolPath, markers) with
`typeof google !== 'undefined' && google.maps`, and declare derived consts
(filtered data) ABOVE any useMemo that references them to avoid a TDZ ReferenceError
that surfaces as the tab's error-boundary "Something went wrong".
