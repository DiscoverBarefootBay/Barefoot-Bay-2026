---
name: Analytics schema index constants are declarative-only
description: Why the analyticsSessions/Events/PageViews *Indexes exported objects do not create DB indexes, and how analytics event tracking is actually wired.
---

# Analytics schema index constants are declarative-only

The `analyticsSessionsIndexes` / `analyticsEventsIndexes` / `analyticsPageViewsIndexes`
exported objects used to exist in the three analytics-schema copies (`lib/db`, frontend
`shared/`, api `shared-compat/`) but have been **removed** — they were never consumed at
runtime (not Drizzle `pgTable` index defs, nothing imported them to create indexes) and
were redundant with the real Drizzle `index(...)` defs that live in the third `pgTable`
arg (session_id/path/timestamp/user_id on page_views; +event_type on events;
visitor_fingerprint on sessions). Do not re-introduce them. If you see them in older
branches, treat them as dead code.

**Why:** Adding a "new index" by extending those constants gives false confidence —
it changes no actual DB index. There is no migration runner that applies them.

**How to apply:** To add a real analytics DB index, use a proper Drizzle index
definition (third arg of `pgTable`) plus a migration, and confirm it is applied to
the **production** DB (prod schema/index changes only take effect on publish/manual
migration). Do not edit the `*Indexes` constants expecting a runtime effect.

# Where analytics tracking actually lives

- The live dashboard path is `routes/analytics.ts` (mounted `/api/analytics`) →
  `analytics-service.ts`. `analytics-tracker.ts` / `analytics-public.ts` are NOT it.
- Frontend event tracking is in the `AnalyticsProvider` (`src/lib/analytics.tsx`),
  NOT `initAnalytics` (commented out in `App.tsx`). The provider must wire its own
  document click/submit listeners or the Events panels stay empty.
