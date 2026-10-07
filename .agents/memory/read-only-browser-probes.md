---
name: Read-only browser probes
description: Browser diagnostics in Plan mode need all browser support files outside the read-only workspace.
---

In Plan mode, run diagnostic browsers with their profile, HOME, XDG_CONFIG_HOME and XDG_CACHE_HOME under `/tmp`.

**Why:** A temporary Chromium profile alone does not keep the browser read-only with respect to the workspace. Chromium still creates crash-report settings in its default configuration directory, which can be inside the read-only workspace and prevent startup.

**How to apply:** Redirect all browser support directories into `/tmp` for read-only browsing checks. Keep application files untouched, and block non-read API requests when probing the live site.
