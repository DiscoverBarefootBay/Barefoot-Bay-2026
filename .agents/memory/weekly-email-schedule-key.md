---
name: Weekly email schedule-key overlap rule
description: How the weekly listings email decides whether an overlapping past campaign blocks a new send.
---

Rule: a terminal weekly campaign only blocks a new overlapping send when it was sent under the SAME schedule key (`<sendDay>@<HH:mm>`) or has a NULL key (legacy — blocks for safety). `sending` rows always block. Sends are serialized with an in-process mutex because the DB claim is unique only on `week_start`, which doesn't cover two different overlapping windows.

**Why:** An admin schedule change is an explicit request for the next configured send to fire even if a digest already went out that week (July 2026 incident: Friday send silently skipped after a Monday send). Duplicate protection must survive restarts when the schedule is unchanged.

**How to apply:** Any new send path (manual, API, future scheduler) must record the schedule key at claim time and pass it to the overlap check; skips/failures must be logged to the admin activity table (`weekly_listings_email_activity`) with dedupe-once semantics enforced by the partial unique index. New DDL is in `lib/db/sql/2026-08-01-weekly-email-activity.sql` and must be run on prod at Publish (never drizzle push).
