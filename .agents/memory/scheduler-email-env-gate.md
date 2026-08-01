---
name: Scheduler email environment gate
description: Every background scheduler (or manual trigger) that sends email must be production-gated, or the dev workspace emails real users from a stale DB.
---
Rule: any code path that sends scheduler-driven email must first pass the shared production gate (see `scheduler-email-gate.ts`), which allows sending only in deployed production plus an explicit per-scheduler dev opt-in env var.

**Why:** The dev workspace runs identical code with the real SendGrid key against a stale dev database, so ungated schedulers have emailed real users false alerts more than once.

**How to apply:** Gate every trigger of an email-sending job — scheduled ticks AND manual/admin endpoints that call the same service — via an injectable check so it stays unit-testable. On the gated-off path, still clear any stale persisted tracking state (without sending) so a later opt-in can't act on misleading counters. Jobs that touch only the DB and send no email don't need the gate until they grow email.

**Prod verification (post-publish):** the gate passing shows up as normal tick activity — hourly "Found N expired listings" lines and minute-cadence `weekly_listings_email_config` reads in deployment logs — with zero "Sending is disabled in this environment" lines. The schedulers log nothing scheduler-tagged on a quiet healthy tick, so absence of `[ListingExpirationScheduler]`/`[WeeklyListingsEmail]` lines is NOT evidence of failure; grep the tick's side-effect lines instead. Unfiltered fetchDeploymentLogs returns only ~100 recent lines; regex-filtered queries scan the full retention window.
