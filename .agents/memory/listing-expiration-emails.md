---
name: Listing expiration emails & raw-row gotcha
description: Pitfalls when sending email from the real estate listing-expiration scheduler/service.
---

# Listing expiration emails

- `sendEmail()` (and every `send*Email` wrapper) in `sendgrid-service.ts` **returns `false` on
  failure — it does NOT throw**, and logs the error internally.
  **Why:** a `try/catch` around a send will never fire; failures slip past silently.
  **How to apply:** for anything idempotent/stateful (e.g. the weekly empty-page reminder),
  capture the boolean and only advance persisted cadence state (`lastReminderAt`) when at least
  one send succeeded — otherwise a SendGrid outage suppresses retries for the whole interval.

- `storage.getExpiredListings()` is a raw `SELECT *` returning **snake_case** pg rows
  (`contact_info`, `created_by`, `listing_type`, `is_subscription`, `expiration_date`), even though
  the `RealEstateListing` type claims camelCase. `checkExpiredListings()` branches on camelCase
  (`listing.isSubscription`, `listing.expirationDate`), so those are always falsy → the
  subscription-renewal branch and the >30-day delete branch are effectively dead and every expired
  row falls into the standard "mark EXPIRED" branch.
  **Why:** any new code reading these rows must read snake_case (or both forms) defensively.
  **How to apply:** expiration emails are wired into BOTH EXPIRED branches and the helper reads
  snake_case, so they fire exactly once per ACTIVE→EXPIRED transition regardless of the dead
  branching. Fixing the subscription/delete misclassification is a separate concern.
