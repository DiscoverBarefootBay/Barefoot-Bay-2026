---
name: Calendar email watchdog false "missed day" alerts
description: Why false "calendar digest didn't go out" alerts happen and the rule for manual sends counting as the daily run
---

# Calendar email watchdog false "missed day" alerts

## Root cause of false alerts is usually a stale deployed build, not the repo logic
When a "calendar email did not go out" alert fires for a day that DID send cleanly, suspect an
older deployed build first. The watchdog's "expected day" is the most recent FULLY-ELAPSED
send+grace window: if checked the next day BEFORE that day's send time, the expected day is
*yesterday*, and a recorded run for yesterday makes it correctly stay silent.
**Why:** A production alert (received before the day's own send time) blamed a missed prior day
that had actually sent; git history showed the scheduler file was unchanged and the app had been
republished after the alert — i.e. the buggy build was already gone.
**How to apply:** Before "fixing" the watchdog, confirm the live build matches the repo and check
prod `recent_runs` / `last_sent_at` for the day in question. Lock correct behavior with regression
tests rather than rewriting logic that is already correct.

## A manual /day send counts as the canonical daily run only when its audience matches the schedule
The manual `POST /api/admin/send-calendar-events/day` records the run + stamps `lastSentAt` (which
suppresses that day's automatic send) ONLY when its `notifyPreference` equals the schedule's
configured `notifyPreference`. A narrower send (e.g. `justme` test send) must NOT stamp `lastSentAt`.
**Why:** Stamping `lastSentAt` on a `justme` test send would wrongly suppress the real broadcast
scheduled later that day.
**How to apply:** Any new manual/ad-hoc send path that could set `lastSentAt` must gate on
audience-matches-schedule, or it can silently cancel the real digest.
