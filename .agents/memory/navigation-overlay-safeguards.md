---
name: Navigation overlay safeguards
description: Preserve consent ownership and verify real menu layering rather than just DOM presence.
---

Keep the mobile menu under the same consent-controlled navigation boundary when fixing overlay layering. Any portal must independently preserve consent interaction blocking and scoped account readiness.

**Why:** Navigation-first loading must remain usable for unknown accounts, but retained consent rechecks must block an already-open menu. Moving an overlay outside its inert ancestor can accidentally remove that protection.

**How to apply:** Prefer correcting the parent stacking relationship while retaining the existing boundary. Verify that mandatory policy prompts retain focus ownership and that retained rechecks block the open menu before approving a portal or other structural change.

Verify overlay hit targets in a real browser; menu existence alone is insufficient.

**Why:** The navigation-first regression passed checks for an existing menu while loaded homepage headings, search, and cards still painted above it and intercepted taps.

**How to apply:** Check topmost panel and backdrop targets across a populated, scrolled page, then dispatch actual browser input for expand, close, backdrop, and link interactions. Validate that the regression check rejects the actual previous broken state, not merely an assumed test mutation.
