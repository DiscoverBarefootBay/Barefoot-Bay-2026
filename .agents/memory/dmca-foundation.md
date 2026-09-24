---
name: DMCA foundation decisions
description: Durable evidence-preservation and quarantine rules for DMCA work — read before touching delete paths, public loaders, or file storage moves.
---
- A takedown is a reversible visibility change, never a delete, and a dmca_hidden item is protected from permanent deletion exactly like a legal hold (app guards AND the DB delete trigger, including cascades and account deletion). Only one active takedown per item.
  **Why:** owner stated every legal point is mandatory; takedown content is evidence and must be restorable to the exact original URL.
  **How to apply:** any new delete path, cleanup job, or test cleanup must respect this — republish/release first; never add a trigger bypass.
- Physical quarantine must be verified BEFORE a takedown commits (files leave their public keys so direct storage URLs die too); a failed move aborts the takedown, and file moves are compensated whenever the surrounding DB transaction fails (takedown and restore). Bytes must always match committed DB state.
- Every new public surface (route, email, OG, sitemap, scheduler, auto-delete job) must go through the central visibility policy; duplicate slug rows exist (e.g. banner-slides), so hide/filter by slug-returned row, not by an assumed single id.
- Drizzle's `sql` template does NOT turn a JS array into a PG array (`ANY(${arr}::int[])` → 22P02); use an ARRAY[...] builder.
- Schema ships as idempotent SQL in lib/db/sql and must be applied to the prod DB at Publish.
- DMCA permission grants are explicit data, not site-admin-role powers. Production may have the DMCA schema and current frontend yet hide all legal tools because rollout grant rows from development were not copied by Publish. Verify permission counts in each environment before blaming the bundle.
  **Why:** a production rollout had the same frontend bytes and tables as development but zero DMCA-view grants for site admins; a controlled, owner-approved production grant restored the admin menu.
  **How to apply:** after schema publication, verify production grant data separately. Use a narrowly scoped, auditable bootstrap approved by the owner; never overwrite production data or silently make site admins legal admins in code.
- DMCA status links (/dmca/status/<token>) are bearer credentials: every place that logs or stores URLs (pino req serializer, error logs, analytics pageviews/events/referrers, active-users) must pass them through the shared redact-path helper; the status page also sets referrer=no-referrer.
  **Why:** tokens in request logs or analytics_page_views would be readable by site admins.
  **How to apply:** any new logger/analytics sink or any new tokenized public URL must redact the same way.
- Client IP for audit/rate-limit must come from req.ip (app sets trust proxy=1), never the raw X-Forwarded-For header, which the client controls. express-rate-limit keyGenerator must wrap it in ipKeyGenerator.
- Private DMCA documents (original notices, court docs) go to object storage under the `dmca-quarantine/` prefix (blocked by the quarantine gate on every public proxy route), served only through HMAC-signed ≤5-min admin links. Never local disk.
  **Why:** deployment disks are ephemeral, so legal evidence on local disk would vanish on republish.
- DMCA legal rules (restore eligibility, holds, one active case per item, what may appear in emails) are enforced in the service layer, never only in routes or UI; every case-level hold must leave a releasable hold record.
  **Why:** route-only checks are bypassable, and a hold without a record can never be released.
- A case that can receive an uploader counter-notice must cover one identifiable uploader only; separate mixed-owner and unattributed targets into different cases before takedown. Do not solve this by letting one uploader submit for all case targets.
  **Why:** the counter-notice and restoration window are case-wide, so one uploader could otherwise trigger restoration of someone else's or unattributed content.
  **How to apply:** preserve this boundary if case creation, target attachment, or counter-notice routing changes.
- Restoration eligibility is an exact timestamp on the tenth business day, not merely the start of that calendar day. A bad case must not stop other scheduler cases or the exposure check.
  **Why:** the business-day counter reaches day ten before a time-preserving eligibility timestamp; a transition too early rejects and can abort the batch.
  **How to apply:** compare the eligibility timestamp and isolate per-case scheduler errors when changing reminder cadence.
