---
name: Loading feedback ownership
description: Avoid false browser-test failures when shared branding spans successive loading phases.
---

Scope assertions about loading completion to the status that owns the pending operation, rather than to the shared decorative mark alone.

**Why:** Finishing the anonymous account check can immediately mount a lazy route whose download shows the same mark. A global assertion that the mark vanished can wrongly report that the account check still blocks content.

**How to apply:** In browser verification, wait separately for account-check completion and route-download completion. Hold actual page-module requests when checking route feedback, without fabricating authenticated users or changing consent responses.