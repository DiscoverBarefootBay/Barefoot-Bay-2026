---
name: Email unsubscribe flag policy
description: Which send paths must honor email_notifications_enabled and how each does it
---

Rule: every NOTIFICATION email (forum posts/comments, calendar, private messages, weekly listings, listing-expiration seller reminders) must exclude users with `email_notifications_enabled = false`. Transactional email (password reset, welcome, order confirmations, listing-contact inquiries) intentionally ignores the flag. Legacy `null`/`undefined` counts as opted IN.

**Why:** an unsubscribed resident still receiving mail is a spam-complaint/deliverability risk; the flag lives on users and is treated as unsubscribed only when explicitly false.

**How to apply:** filtering happens per-path, not centrally in sendEmail — forum uses a DB-level filter in the subscriptions query and inline user filters; calendar/weekly/listing-expiration use pure resolver helpers; private-message routes filter inline via `canReceiveNotificationEmail` (shared helper in sendgrid-service, alongside `partitionRecipientsByEmailPreference`). Any NEW notification sender must add its own check — nothing catches it downstream. Recipient-filter regressions are locked by `src/__tests__/email-recipient-preferences.test.ts`.
