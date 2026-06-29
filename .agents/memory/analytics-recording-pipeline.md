---
name: Analytics recording pipeline
description: How visitor/session/page-view data is recorded, the double-session pitfall, and how to read a "traffic drop" before assuming tracking broke.
---

# Analytics recording pipeline (Barefoot Bay)

Two recording entry points feed the same tables: a server middleware (records on non-skipped requests) and the client `AnalyticsProvider` (POSTs to the track endpoints for SPA navs). In production the SPA HTML is a separate static artifact and the middleware skips `/api`, so **real visitor recording depends almost entirely on the client POST path**, not the middleware. `analytics-tracker.ts` is dead code.

The dashboard read path applies NO bot filter and excludes no real users (`liveDataOnly` defaults false). So "undercounting" complaints are almost never a query-filter problem — investigate the recording path and the traffic shape first.

## The double-session pitfall (fixed, keep fixed)
A cookie set via `res.cookie(...)` is NOT visible on `req.cookies` within the same request. If the middleware starts a session (cookie on res) and then records a page view via the get-or-create path (reads `req.cookies`), the second read sees no cookie and creates a SECOND session; the first stays at `pages_viewed=0` forever.
**Symptom:** sessions ≈ 2× page views, ~40% of sessions with zero page views, depressed pv/session.
**Note:** phantom and real session share the same IP+UA fingerprint, so this inflates session counts but does NOT change unique-visitor counts.
**Fix + Why:** after starting a session, also mutate `req.cookies` so the same-request page view reuses it. Never trust a session id from the client request body (spoofable). Guarded by a middleware regression test.

## Reading a "traffic drop" before blaming tracking
**Rule:** before concluding tracking regressed, compare page-views-per-session and check for an outage gap; a healthy live signal (endpoints returning 2xx, sessions+page views arriving now) means recording works and the "drop" is a baseline change, not a break.
**Why:** in mid-2026 a large before/after "drop" was actually a one-time multi-day outage plus an architecture change (server-rendered → static SPA + `/api`) that stopped counting non-JS bot hits the old middleware used to record. Pre-period sat near ~1.0 pv/session (single-hit, non-JS signature); after, ~1.8 pv/session (human browsing). Restoring the old volume would mean re-counting bots — wrong.
**How to apply:** the visitor fingerprint began populating only in 2026-06; for older data the unique metric falls back to distinct-IP, which undercounts multiple devices/people behind a shared NAT. Fingerprint-first metric redesign + bot-IP exclusion are deliberate follow-ups, not part of the recording fix.
