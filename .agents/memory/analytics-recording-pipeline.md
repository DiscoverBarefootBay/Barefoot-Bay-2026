---
name: Analytics recording pipeline
description: How visitor/session/page-view data is recorded server-side, and the double-session pitfall that corrupts counts.
---

# Analytics recording pipeline (Barefoot Bay)

Two recording entry points feed the same tables:
- Server middleware `artifacts/api-server/src/analytics-service.ts` — records on every non-skipped request.
- Client `AnalyticsProvider` (`artifacts/discover-barefoot-bay/src/lib/analytics.tsx`) — POSTs `/api/analytics/track/pageview` for SPA navs.
- `analytics-tracker.ts` is DEAD code (no importers).

The dashboard read path (`/api/analytics/data` -> `getEnhancedOverview`) applies NO bot filter and does NOT exclude real users; `liveDataOnly` defaults false. So "undercounting" complaints are almost never a query-filter problem — look at the recording path first.

## The double-session pitfall (fixed, keep fixed)
`getOrCreateSession(req)` reads the session id from `req.cookies['analytics_session_id']`. A cookie set via `res.cookie(...)` is NOT visible on `req.cookies` within the same request. So if the middleware calls `startSession()` (sets cookie on res) and then `trackPageView()` -> `getOrCreateSession(req)`, the latter sees no cookie and creates a SECOND session; the first stays at pages_viewed=0 forever.
**Symptom:** absurdly low page-views-per-session (≈0.36) and inflated session/visitor counts.
**Fix:** after `startSession` sets the cookie, also mutate `req.cookies['analytics_session_id'] = sessionId` server-side so the same-request `getOrCreateSession` reuses it. Do NOT honor a sessionId from raw client `req.body` (the route passes unvalidated body to trackPageView -> spoofable).

## Traffic-shape reframe (prod, mid-2026)
Pre-~2026-05-25 traffic was bot-inflated (cookieless GCP crawler IPs like 35.191.x.x with generic Mozilla UAs hitting sitemap/SEO endpoints; ~119k sessions/mo at 0.36 pv/session). Post-2026-06-01 was more human-like (~4,441 sessions at 1.89 pv/session). `visitor_fingerprint` only began populating 2026-06-28. A raw before/after "drop" overstates real loss — the old numbers were partly crawler noise.

**Why:** so future analytics-number investigations don't chase a phantom drop or re-introduce the double-session bug.
