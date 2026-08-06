---
name: Featured listings kill switch
description: Semantics of the global featured_listings feature flag and the server-side rules protecting featured status.
---

# Featured listings kill switch

- The `featured_listings` feature flag is a GLOBAL on/off — only `isActive` matters, roles are ignored, no dev admin override. Absent flag or load error = enabled (fail open), both server-side and in the web `useFlags().isFeaturedListingsEnabled()` helper. Seeded at API-server boot with all roles so role-filtered GET /api/feature-flags always includes it.
- **Why:** the flag must hide a paid feature for everyone when off, but a missing seed or fetch error must never hide it for paying users.
- `featured`/`featuredAt` must NEVER be accepted from client payloads on listing create or PATCH — the general update route once forwarded the shared insert schema wholesale, letting owners self-feature for free and bypass the kill switch. Feature status may only change via the guarded feature/unfeature endpoints (which 403 when the flag is off; unfeature stays open).
- **How to apply:** any new listing write path must strip/ignore featured fields; any new feature-granting path must check the flag helper server-side, not just hide UI.
- Weekly email: `renderWeeklyListingsEmail(..., { featuredEnabled: false })` de-features listings before category grouping, so no gold border/ribbon/badge or `[FEATURED]` text appears and listings fall into natural categories.
