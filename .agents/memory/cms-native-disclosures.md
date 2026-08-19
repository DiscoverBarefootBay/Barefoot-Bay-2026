---
name: CMS native disclosures
description: Preserve visitor-toggled native details elements when database-provided HTML is refreshed.
---

When CMS HTML rendered through `dangerouslySetInnerHTML` includes native `<details>/<summary>` controls, preserve only the state of the individual disclosure a visitor toggled across a later HTML replacement.

**Why:** Replacing injected HTML recreates browser-managed `<details>` nodes and resets their `open` state. Recording every disclosure during one toggle would also override unrelated CMS-authored `open` defaults after content changes.

**How to apply:** Listen for the native `toggle` event in capture phase, record the target disclosure under a stable key, and restore only recorded keys in a layout effect after injected HTML changes. Leave untouched disclosures governed by the current CMS markup.