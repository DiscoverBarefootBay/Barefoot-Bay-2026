---
name: API server background jobs / scheduling
description: How recurring/background work runs in artifacts/api-server, and the once-per-day calendar email scheduler design.
---

# Background jobs in artifacts/api-server

There is **no cron/scheduler framework** in this API server. `runScheduledTasks`
exists but is only ever invoked manually (e.g. an admin POST route), never on a timer.

**Exception — real-estate listing expiration self-runs.** `checkExpiredListings`
(in `listing-expiration-service.ts`) is also bundled inside the manual
`runScheduledTasks`, but it additionally runs on its own boot scheduler
(`listing-expiration-scheduler.ts`, started from `index.ts`): a catch-up run ~30s
after boot, then hourly. **Why:** before this, listing `status` drifted stale —
listings stayed `ACTIVE` in the DB long after their `expiration_date` passed, so
the public For Sale page (which filters by actual date) showed nothing while the
admin "My Listings" badge still said ACTIVE. Don't add a second timer for this,
and don't assume listing statuses go stale anymore. The frontend listing card /
detail page also compute an `effectiveStatus` (past-`expirationDate` non-draft →
EXPIRED) so the badge is correct even in the gap before the hourly tick flips it.

**Schema gotcha:** `real_estate_listings` has **no `isApproved` column** — do not
pass `isApproved` to `storage.updateListing` (it was removed; older code did and
would fail at runtime now that the job runs automatically).

**How to add a recurring job:** self-start a `setInterval` at boot, called once from
`src/index.ts` after `server.listen(...)`. Guard it with a module-level
`started` boolean (idempotent), a `ticking` boolean (no overlapping runs), and
`timer.unref()` so it never keeps the process alive on shutdown. Use `logger`
(never `console.log`) in server code.

## Calendar auto-email scheduler

The admin "Automatic Schedule" panel writes to the `calendar_email_schedule`
table. The scheduler (`src/calendar-email-scheduler.ts`) reads it on a 60s tick.

**Once-per-day, restart-safe semantics chosen = at-most-once.** It persists
`lastSentAt` (compared in Florida ET day) and writes it **before** sending, then
clears the one-shot `customEventOrder`/`attachImageEventIds` fields in that same
write. This guarantees a community-wide blast never double-fires across restarts
or partial failures, at the cost of possibly skipping a day if the send throws
after the mark.

**Why:** double-sending a digest to every resident is far worse than a rare
missed day, so the tradeoff favors no-duplicates.

**Cross-process safety (implemented):** beyond the in-process overlap guard,
sends and escalations are each gated by a DB-level compare-and-swap
(`storage.claimCalendarEmailSend` / `claimCalendarEmailEscalation`): a
conditional UPDATE that only the instance whose observed `lastSentAt` /
`lastEscalationAt` still matches wins, so concurrent instances send/escalate at
most once per day.

**On-time / catch-up timing:** the tick sends at-or-after `sendTime` (ET) within
a `CATCHUP_GRACE_MINUTES = 120` window (inclusive of the 120-min boundary).
Inside the window it waits for events/recipients to appear; past it the day is
*finalized* — `missed_window` (events existed → alert admins) or `no_events`
(info). It will NOT fire a digest hours late. Terminal statuses block re-eval
until the next ET day. This grace-then-escalate behavior is a deliberate product
choice — do not "fix" a missed send by removing the cutoff.

**Production runtime:** this app is published as an **always-on `vm`** deployment
(barefootbay.com), NOT autoscale — the `.replit` `deploymentTarget` value can be
stale/misleading; trust `getDeploymentInfo().deploymentType` instead. The
in-process scheduler depends on this always-on runtime. **Scheduler code changes
only take effect in production after the user re-publishes.** A vm redeploy
restart that spans the entire send+grace window is the main remaining way a day
can be missed.

**Schedule is one shared app-wide row.** `getCalendarEmailSchedule()` reads the
single row (no per-admin keying); the PUT route stamps `adminUserId` to whoever
last saved (only used to resolve the "justme" recipient). The admin UI refetches
on window focus so one admin sees another's saved changes.

Recipient/event selection lives in `src/calendar-notification-helpers.ts`
(`resolveScheduledCalendarRecipients`, `selectCalendarEventsForTomorrow`) and
mirrors the manual `/day` send + `context=schedule` recipients-preview logic.
Manual send endpoints were intentionally left unchanged.

## Missed-day watchdog needs an out-of-process trigger, not just a timer

The minute tick only catches problems while the process is up; the gap it can't
close is an outage spanning the whole send+grace window AND past end-of-day, after
which the day rolls over and is silently forgotten. The watchdog
(`runCalendarEmailWatchdog`) closes it by re-checking whether the most-recent
fully-elapsed expected-send day recorded any run and escalating via the existing
admin path if not.

**Key design decision:** an in-process timer alone is in the same failure domain
as the scheduler, so it is only a *secondary* net. The *independent* trigger is a
public verifier endpoint (`GET /api/system/calendar-email-watchdog`) meant to be
polled by an external monitor / scheduled job on its own clock; it returns 200
healthy / 503 missed and fires the alert on a miss. Total app outage shows up as
the monitor's request failing.
**Why:** the original review rejected an in-process-only check as not satisfying
"alert if the daily email stops" — the alerting must not depend solely on the
same process that might be down.
**How to apply:** keep both paths; dedup is per missed day via `lastWatchdogAt`
CAS, and the watchdog requires a prior baseline run so fresh installs don't
false-alarm.

## drizzle-kit push is UNSAFE in this repo — use direct SQL for additive columns

`pnpm --filter db run push` (or `@workspace/db`) triggers drizzle-kit's
**interactive table-rename prompts** (e.g. "rename table → analytics_segment_filters")
from pre-existing drift between the Drizzle schema and the live DB. It hangs on
the prompt (and on a closed stdin in post-merge it can skip the change), so a new
column may never land — verified a blocked push left key tables intact but did NOT
add the intended column.
**Why:** the drift makes push's auto-detect unreliable and potentially
destructive.
**How to apply:** for additive columns, run an idempotent
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` directly (and add it to
`scripts/post-merge.sh` so it lands in every environment), then rebuild the
composite db lib so `@workspace/db` re-emits declarations.
