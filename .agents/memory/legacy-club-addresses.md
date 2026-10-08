---
name: Legacy club address collisions
description: Why generic social-page records and membership values cannot be cleaned up indiscriminately
---

The old `social-page` address was reused for unrelated clubs, not just duplicate revisions of one club. Development and production can have different clubs winning that address.

**Why:** Read-only live investigation found a Golf Cart Club legacy record alongside older Garden Club and Bible Study records at the same generic address. Development's current generic record was different. Residents also have saved memberships using the generic address.

**How to apply:** Confirm the legacy-to-canonical relationship separately in each environment. Preserve original content, media, versions and saved membership values; never blanket-delete generic-address rows or merge all similarly titled clubs. A removed canonical club must not become public again through its legacy copy. Keep administrator visibility separate from public alias handling.
