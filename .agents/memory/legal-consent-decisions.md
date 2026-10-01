---
name: Legal acceptance scope
description: Owner-approved publication and rollout boundaries for versioned legal acceptance.
---
Every actual published change to Terms, Privacy, or Copyright/DMCA requires renewed explicit acceptance, including minor wording changes and restoring older wording. Do not add a discretionary "material changes only" threshold or exempt privileged accounts.

**Why:** The owner approved all published changes and active sessions as the enforcement boundary, not only new registrations or substantive revisions. Legacy booleans are not evidence that a user reviewed an exact version.

**How to apply:** Keep acceptance separate from marketing/cookie consent. Do not infer prior acceptance during migrations. Preserve statutory notice/counter-notice access independently of normal account access.

Publication timestamps identify the technical publication event, not a newly assigned legal effective date.

**Why:** Initial snapshots may contain existing legal text with its own dates; technical rollout is not authorization to rewrite that text or determine its legal effective date.

**How to apply:** Label snapshot timestamps "Published"; preserve dates inside the approved source text.

Statutory exceptions must include a discoverable route through the uploader's own case list and detail, not just the final counter-notice form.

**Why:** An uploader without email may otherwise receive the case link only in the blocked site inbox. A technically exempt direct URL is not accessible if the user cannot discover it.

**How to apply:** Keep the owned copyright-case navigation reachable from both the consent prompt and its error screen, without exempting ordinary inbox or administrative features.

Optimize consent checks by reducing the data read, not by caching authorization across requests.

**Why:** Performance work must preserve the owner's requirement that every newly published version immediately requires renewed acceptance; a short-lived acceptance cache would still create an unauthorized grace period.

**How to apply:** Routine accepted requests need fresh current-version/acceptance metadata, while review screens need complete documents. Batch redundant client triggers only if protected content remains blocked until the fresh result arrives.