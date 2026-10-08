---
name: CMS native disclosures
description: Preserve visitor-toggled details state and respect disclosure defaults in automatic previews.
---

When CMS HTML rendered through `dangerouslySetInnerHTML` includes native `<details>/<summary>` controls, preserve only the state of the individual disclosure a visitor activates across a later HTML replacement or transient child remount.

**Why:** Replacing injected HTML recreates browser-managed `<details>` nodes and resets their `open` state. Native `toggle` can be queued until after the old node is replaced, so a toggle-only listener can miss the first click. Recording every disclosure would also override unrelated CMS-authored defaults.

**How to apply:** Record the intended state synchronously from the native summary click without preventing or manually toggling it, then let `toggle` confirm the result. Reconcile cancelled clicks after propagation, hoist state above any transiently remounted renderer, and restore only recorded keys before paint.

Never fetch CMS content, write the query cache, or dispatch refresh events while deriving a slug during render. Queries keyed as `["/api/pages", slug]` need an explicit query function for the slug endpoint because the shared default fetcher requests only the first key element.

**Why:** A render-time fetch/refresh cycle repeatedly replaced native disclosure nodes immediately after their trusted toggle. Removing it without an explicit slug query also left the page empty because the shared fetcher requested the page collection instead of the detail endpoint.

**How to apply:** Keep route-to-slug calculation pure, let one declarative query own the detail request, and verify real browser node identity plus request counts after the page settles.

Directory previews should reflect the CMS author's initial disclosure state, not flatten every disclosure into a summary.

**Why:** Legacy club pages use disclosures as explicit reveal affordances. Including their control labels and concealed content in excerpts replaces useful introductory text and defeats that reading experience. This is a preview policy, not an access-control guarantee.

**How to apply:** Exclude closed disclosure bodies and summary-control labels from automatic previews; retain useful prose in disclosures authored open. Do not change the underlying page or a visitor's later toggled state.