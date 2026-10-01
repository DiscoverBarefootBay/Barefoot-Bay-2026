---
name: Completion validation timeouts
description: Distinguishing an unfinished project-wide completion check from failing targeted regression tests.
---

The configured project-wide test command has repeatedly failed to reach a terminal status before completion validation exhausts its polling budget. Do not interpret that outcome as a failed assertion or claim the entire suite passed.

**Why:** Independent client and focused API tests can finish successfully while the project-wide command continues running without a final test summary. Identical completion retries have repeated the long wait. The underlying reason for the unfinished full run has not been established.

**How to apply:** Inspect the affected run's log for real assertion failures and verify the changed behavior with independently terminating checks. If the configured check genuinely cannot finish, use an audited completion-validation skip explaining that limitation and the independent checks performed. State the limitation in the delivery summary. Do not alter unrelated tests or validation configuration merely to mark a feature complete.