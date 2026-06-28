---
name: Analytics schema index constants are declarative-only
description: Why the analyticsSessions/Events/PageViews *Indexes exported objects do not create DB indexes, and how analytics event tracking is actually wired.
---

# Analytics schema index constants are declarative-only

The `analyticsSessionsIndexes` / `analyticsEventsIndexes` / `analyticsPageViewsIndexes`
exported objects in the three analytics-schema copies (`lib/db`, frontend `shared/`,
api `shared-compat/`) are **never consumed at runtime** — they are not Drizzle
`pgTable` index definitions and nothing imports them to create indexes. They are now
**redundant**: `analyticsSessions`, `analyticsPageViews`, and `analyticsEvents` all carry
real Drizzle `index(...)` defs in their third `pgTable` arg (session_id/path/timestamp/
user_id on page_views; +event_type on events; visitor_fingerprint on sessions). The dead
constants are still exported/re-exported (via the schema barrels) but should be ignored.

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
