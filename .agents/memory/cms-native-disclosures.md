---
name: CMS native disclosures
description: Preserve visitor-toggled native details elements when database-provided HTML is refreshed.
---

When CMS HTML rendered through `dangerouslySetInnerHTML` includes native `<details>/<summary>` controls, preserve only the state of the individual disclosure a visitor activates across a later HTML replacement or transient child remount.

**Why:** Replacing injected HTML recreates browser-managed `<details>` nodes and resets their `open` state. Native `toggle` can be queued until after the old node is replaced, so a toggle-only listener can miss the first click. Recording every disclosure would also override unrelated CMS-authored defaults.

**How to apply:** Record the intended state synchronously from the native summary click without preventing or manually toggling it, then let `toggle` confirm the result. Reconcile cancelled clicks after propagation, hoist state above any transiently remounted renderer, and restore only recorded keys before paint.