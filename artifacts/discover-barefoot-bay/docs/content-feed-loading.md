# Extra!!! and Community loading

Measured October 6, 2026 (America/Chicago).

## What changed

- Guest category counts use two fixed queries; signed-in categories use a category read and one grouped count query. Total unread badges use one grouped query. None load post/comment bodies, authors or per-post detail queries just to count.
- Badge counts include published stories, matching the story feed; hidden/removed stories no longer contribute unreachable unread badges. Existing comment-ID badge rules and timestamp-based story-card rules remain distinct.
- Load More requests only the next 12 stories, with an ID tie-breaker under all six sort modes. A lightweight ordered metadata revision detects changed membership/order; an actual 409 restarts at the first page rather than silently skipping moved stories.
- Comment count and latest-comment aggregation are shared within each feed query instead of separate correlated COUNT/MAX queries for every story.
- Story cards no longer wait for category-count or description requests. First-page and next-page errors have retry paths; a failed next batch leaves already displayed stories visible.
- Community category directories fetch only their viewer-visible card summaries. Hidden-before-dedup and category-after-dedup precedence match the old full-pages path. Existing snippets, links, metadata and content-media fixing are preserved; executable/inline-base64 thumbnail URLs are excluded.
- Feed/category/badge/Community caches are scoped to identity and effective role. CMS and forum edits invalidate the corresponding summaries.
- No schema migrations, new services, new indexes, publish operations or changes to original image files.

## Request sizes and timings

These are anonymous **development preview** measurements, not published-site guarantees.
Browser requests ran sequentially with builds/tests/screenshots idle, using new browser profiles, disabled HTTP caches and blocked non-read API calls.

| Read | Before | After |
| --- | --- | --- |
| Community Information cards | `/api/pages`: 628,820 bytes, 43 ms in browser | `/api/community-directory?category=community`: 178 bytes, 11–17 ms |
| First 12 stories | 7,827 bytes, 26–37 ms | 7,921 bytes, 25–29 ms in compiler-warm samples |
| More stories | Repeated the growing first batch; capped at 50 | Next 12 only; all 192 reached under all six sorts |

The added 94 bytes on the first story response provide the revision and next offset.
Community body transfer fell by over 99.9% for the sampled category; this is **not** a claim that whole-page startup became 99.9% faster.

Separate initial curl samples: old full-pages response 281 ms; new Community Information/safety summaries 35/32 ms including proxy overhead. These individual observations are not repeated-sample medians.

## First visible content

Seconds from navigation until a real card/link appears; compiler-warm means the Vite compiler had already served the changed modules, not that the new browser had cached the page.

| Preview route/device | Before cold direct | After compiler-warm cold direct | Before cached return | After cached return |
| --- | --- | --- | --- | --- |
| Extra!!! desktop | 1.746 | 1.343 | 0.163–0.186 | 0.176–0.196 |
| Extra!!! phone viewport | 1.316 | 1.360 | 0.178–0.181 | 0.175–0.200 |
| Community Information desktop | 1.898 | 1.649 | 0.136–0.144 | 0.136–0.154 |
| Community Information phone viewport | 1.508 | 1.505 | 0.145–0.178 | 0.156–0.163 |

Keep the first post-restart compiler-cold observations separate: Extra!!! desktop 3.023 s, phone 1.788 s; Community desktop 2.189 s, phone 1.404 s. In those samples the story request itself still took 25–29 ms; most extra time preceded the request. A non-comparable initial Community phone return was 0.471–0.521 s. These outliers are retained, not discarded as if they never occurred.

First-ever in-app entries after starting at the homepage: Extra!!! 0.552 s; Community Information 0.774 s. No matching pre-change first-ever entry sample exists for these routes, so these are not before/after gains. Cached-return samples are not first-ever entry.

Community sometimes makes a second tiny directory GET following existing generic-CMS invalidation. This does not re-download unrelated CMS HTML.

## Database work, not signed-in browser timings

A read-only development SQL model with 192 published stories and a nonexistent viewer compared the legacy per-post comment work with the new grouped query:

- Old modeled work: 426 queries, 214 ms.
- New grouped count: one query, 2 ms; identical modeled never-read total.
- Nine SQL SELECT fixtures verified never-read posts, creation after last-read, absent/zero comment markers, newer comment IDs, equal markers and deleted newer comments.

This model intentionally excludes real session authorization, full legacy post-body loading and category-query overhead. It demonstrates reduced query work, **not** measured resident/admin UI speed.
Existing database indexes were inspected; no speculative index migration was needed at this data size.

## Verification

- All 179 web tests passed, including account/consent isolation and infinite-query pagination/cache invalidation checks.
- Eight targeted API tests passed for counts, Community visibility/projection and existing Vendor summaries.
- API and web production builds passed; API contract generation and shared-library typecheck passed. The initial manual web-build command needed the artifact's required PORT/BASE_PATH supplied; no configuration changes were necessary.
- Public endpoint checks loaded all 192 stories once under all six sorts, checked invalid pagination and revision conflicts, and matched card membership/snippets against legacy output across seven Community categories. Guest `includeHidden=true` cannot elevate access.
- A real guest browser clicked Load More to 72 unique cards, confirmed only offsets 0/12/24/36/48/60 were requested, recovered from an actual server revision conflict, retained cards through a temporary next-page failure, retried successfully, reset on a category URL change, and recovered a Community failure. Failed category-count responses did not block the story grid.
- Desktop Extra!!! and phone Community screenshots rendered correctly.
- Repository-wide TypeScript checking still reports the existing error baseline (558 web diagnostic lines and 2,003 API diagnostic lines). There were no diagnostics in the changed forum-feed range or the new count, Community-summary, pagination and cache-helper modules. These checks are not a claim that the whole repository typechecks.

## Remaining limits

The verified published URL is https://barefootbay.com. This work has **not** been published; signed-in resident/admin/view-as browser screens and post-publish timings were not verified. Tests cover cache isolation and central visibility fixtures without bypassing live authentication or borrowing log cookies.

Existing Extra!!! lazy-loaded card images still downloaded 6,341,015 bytes across seven image requests in the initial desktop and phone samples, including one 2.13 MB image. Sized, sharp responsive derivatives are a separate opportunity; no originals or upload limits were changed here.

Full story bodies are still read server-side for the selected 12 rows when deriving excerpts/inline-image fallbacks. Their already-small client summaries and 25–29 ms request times did not justify a new persisted-preview schema or potentially lossy HTML truncation. Ordered revision metadata grows with matching story count; profile again before choosing a cursor/aggregate-revision replacement at larger scale.

On The Market remains a candidate to measure, not a confirmed defect or implementation change.

## Reproduce

- `scripts/measure-live-page-loading.mjs <preview-https-url> --routes=/forum,/community/community [--mobile]`
- For first-ever entry: use one route and add `--first-in-app`.
- `scripts/verify-story-pages.mjs <preview-https-url>`
- `scripts/verify-content-browsing.mjs <preview-https-url>`
- API: `node --import tsx scripts/verify-content-reads.ts` (read-only development SQL).
