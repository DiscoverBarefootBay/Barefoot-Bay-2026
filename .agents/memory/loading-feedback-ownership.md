---
name: Loading feedback ownership
description: Silent account/route pending feedback and checks scoped to the operation that owns them.
---

Keep account-check and generic page-download states visually silent; do not reintroduce the coastal wave, another animation, a loading card, or visible account-loading copy.

**Why:** The owner rejected the branded microanimation after seeing it and explicitly asked to remove it entirely, rather than replace it with another design.

**How to apply:** Preserve screen-reader status, the public-only initial shell, and the transparent interaction blocker during consent rechecks. This applies to these two pending surfaces, not every unrelated page-specific loader.

Scope assertions about loading completion to the status that owns the pending operation, rather than to a global loading decoration or status.

**Why:** Finishing the anonymous account check can immediately mount a lazy route whose download has its own pending status. A global loading assertion can wrongly report that the account check still blocks content. The shared navigation header also appears before page-owned requests finish; clicking it too soon produced a false homepage/calendar cache-sharing failure.

**How to apply:** In browser verification, wait separately for account-check completion and route-download completion. Before timing a transition or checking cache reuse, await the current page's successful-content or confirmed-empty marker, not merely a shared header link. Hold actual page-module requests when checking route feedback, without fabricating authenticated users or changing consent responses.