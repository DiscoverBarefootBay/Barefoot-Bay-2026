---
name: Send progress retention
description: Why visual expiry and dismissal must not remove durable email submission records
---

Treat recent-send progress expiry and admin dismissal as display-only. Keep the durable send request and attempt states even after entries are hidden.

**Why:** SendGrid acceptance can be uncertain and cannot safely be retried automatically. Deleting an old request would also erase its idempotency key, allowing an uncertain repeat submission to create a duplicate message or email.

**How to apply:** Restrict the progress read path by age and dismissal state, but do not apply those filters or deletes to the worker, replay checks, or queue claims. Any future privacy retention policy must preserve safe duplicate prevention while retiring address-level data.