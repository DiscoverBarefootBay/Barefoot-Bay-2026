---
name: Analytics deletion cascade
description: Whether account deletion removes analytics rows — verified DB facts for compliance work.
---
Both dev and prod DBs have `ON DELETE CASCADE` FKs from analytics_sessions/analytics_page_views/analytics_events (`user_id`) to users — verified via information_schema on 2026-07-31. So account deletion DOES delete that user's analytics rows.

**Why:** The July 2026 privacy audit (F-4) claimed deleted accounts persist in tracking records; that was wrong for user-linked rows because the schema files declare no FK (`analytics-schema.ts` has bare `integer('user_id')`) but the live DBs (built outside Drizzle) have the constraints. Never infer DB constraints from the Drizzle schema in this project.

**How to apply:** For any retention/deletion/compliance claim, query information_schema on the actual environment. Still true: no retention window (prod held ~1.2M sessions dating to 2025-05-08 as of July 2026) and anonymous rows never expire.
