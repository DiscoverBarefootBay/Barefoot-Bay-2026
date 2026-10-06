# Vendors loading: verification and measurements

## Scope and limitations

Measured on the **development preview**, sequentially, without starting builds or
verification checks in parallel with the probes. A pre-existing test workflow was
later found still alive; perfectly idle isolation therefore cannot be confirmed.
Chromium used fresh browser profiles at 1365×900 and 390×844. Account/consent
responses and writes were intercepted, using synthetic resident/admin identities.
The CMS/category fixtures were actual development reads. Both simulated roles used
the same 78 public cards for comparable browser measurements; separate read-only DB
checks covered 103 admin-visible cards. No resident account was impersonated, no
real visits/emails were sent, and no database rows or schema were changed.

**These are controlled browser comparisons, not real signed-in or published-site
results.** Auth was given a fixed 100 ms delay, page/summary requests 165 ms, and
category/main-content requests 130 ms. The observed request durations include
fixture serialization/transfer overhead. They do not establish real network
throughput, resident-specific badge timing, or production latency.

Real resident/admin sessions were unavailable. Real-account desktop/mobile cold
entry, first-ever in-app entry, and published-site before/after timings remain
unverified. The “in-app” samples below are transitions after an initial visit, not
first-ever in-app entry. Warm revisits were already fast before this change and
did **not** improve substantially.

## Comparable browser results

Time to first card DOM insertion (ms), same data/delays:

| Viewer / viewport | Cold before | Cold after | In-app return before → after | Warm revisit before → after |
|---|---:|---:|---:|---:|
| Resident desktop | 2819 | 1536 | 185 → 165 | 170 → 174 |
| Resident phone | 2039 | 1814 | 191 → 158 | 163 → 162 |
| Admin desktop | 2277 | 1480 | 184 → 162 | 177 → 182 |
| Admin phone | 2148 | 1535 | 240 → 178 | 179 → 173 |

Cold total improved 11–46% in these samples. Server-side development compilation
and JS startup vary, so also isolate time **after the user response completes**
(still includes consent/feature checks, lazy route, directory request and render):

| Viewer / viewport | After-auth before | After-auth after |
|---|---:|---:|
| Resident desktop | 1670 | 751 |
| Resident phone | 1292 | 744 |
| Admin desktop | 1514 | 733 |
| Admin phone | 1350 | 761 |

This authorized-path comparison improved 42–55%. It is not a measured production
authentication speedup.

The before trace downloaded `/api/pages` twice (628,820 bytes each) and
`/api/pages/vendors-main` twice. The directory mounted only after that generic
lookup. The after trace has **zero** full page-list or `vendors-main` requests:
one summary plus one shared navigation-metadata response. Both warm transitions
have **zero directory requests**.

Main cold display-critical request:

| Viewer / viewport | Full page-list duration before | Summary duration after |
|---|---:|---:|
| Resident desktop | 202 ms | 169 ms |
| Resident phone | 190 ms | 167 ms |
| Admin desktop | 187 ms | 168 ms |
| Admin phone | 187 ms | 171 ms |

After summary response end to first card: 153/148/128/139 ms respectively.
Auth fixture responses remained 101–104 ms. The page/summary fixture delay itself
was identical; reduced transfer/serialization work and removed serial dependencies
account for the difference, not a claim that the network became faster.

Intermediate samples are intentionally not used as final comparison results:
the first probe after source/library changes had a 2983 ms phone cold entry
(1908 ms before the user request even began). Earlier probes still contained the
mobile menu's full page-list request; those exposed the dependency and were fixed.
Rendering all offscreen cards initially produced 260–326 ms warm returns.
Vendors-only `content-visibility: auto` reduced that layout cost; it is opt-in,
so the shared Community browse component's behavior is unchanged.

## Payload and database boundary

| Response | Before bytes | After bytes | Reduction |
|---|---:|---:|---:|
| Resident directory data | 628820 | 52951 | 91.6% |
| Admin directory data | 704167 | 67136 | 90.5% |
| Navigation menu data | 628820 | 13646 | 97.8% |

The old list selected 227/252 deduplicated CMS pages. The focused query selects
only 92/117 vendor records before summary/category projection. It keeps the old
hidden-before-dedup semantics and ordering by slug, order, descending update date,
then descending ID. Central viewer visibility runs before snippets/images are
projected. Private moderation reasons, case IDs, owners, and full HTML are omitted.
No full-detail route or existing page-list response contract was changed.

Read-only development comparison, repeated sequentially:

| Scope/sample | Old DB read | Vendor + category read | Old total | New total |
|---|---:|---:|---:|---:|
| Resident initial connection | 62 | 19 | 64 | 39 |
| Resident hot 1 | 9 | 3 | 10 | 18 |
| Resident hot 2 | 6 | 2 | 7 | 8 |
| Admin 1 | 5 | 3 | 7 | 25 |
| Admin 2 | 9 | 3 | 11 | 23 |
| Admin 3 | 5 | 2 | 6 | 10 |

All values in ms. Summary preparation trades some server CPU for substantially
less transferred data and browser work. Do not describe every server request as
faster: hot total pipeline time is sometimes higher. The endpoint provides
`Server-Timing` for read versus projection when real-account timings are collected.
Anonymous `/api/vendors/directory?includeHidden=true` returned 401; actual preview
navigation metadata returned 200, about 57 ms, 13,646 bytes.

## Correctness checks

- Five API tests: focused SQL boundary/duplicate ordering, default visibility and
  owner-only flags, safe field projection, aliases/space slugs, HTTP authorization,
  privileged hidden scope, View As false scope, response shape, and retryable 500.
- Four cache/URL tests: user + effective-role keys, local placeholder override,
  delayed real empty success, fresh cache reuse, initial error, retained cards on
  refresh error, editor/category/moderation invalidation, and legacy detail URLs.
- Real-component delayed-response integration: initial skeleton, failed request,
  successful retry, actual empty result, badge failure without card loss, warm
  remount, admin/resident transitions, and background-refresh error.
- Existing real consent/navigation regression test still passes with the scoped
  metadata key. Authentication, feature and consent guards remain unchanged.
- Four real-Chromium fixture runs: search/clear, desktop grid/dual/single views,
  phone filter drawer, category selection, all four sort choices, both disclaimer
  dialogs, slow/error/retry/empty responses, independent category/badge failures.
  No runtime exceptions or horizontal overflow. The phone keeps its existing
  single-column controls; desktop view preference behavior is unchanged.
- Production frontend build and generated shared-library typecheck passed.
  The repository-wide web/API typecheck has known pre-existing failures; it was
  not represented as green.
- All 174 frontend tests passed in the final configured validation attempt. Two
  original route-loading assertions were updated specifically for the new Vendors
  skeleton while preserving the neutral fallback on all other routes and the
  gate-owned header/layout. `pnpm run test` itself did not terminate: its API test
  child remained open until validation stopped the run after 30 minutes.
  Completion records an audited full-suite exception, not a passing full-suite
  claim. The five focused Vendors API tests terminated and passed independently.

Cards are derived synchronously with memoized transformations. Badge updates never
reparse HTML. Thumbnail loading remains lazy. Summary/badge caches are scoped by
account and effective role, unrelated scopes are removed on transitions, data is
fresh for 60 seconds and refreshed on focus/stale remount plus a 60-second interval.
Existing vendor/category/page/moderation invalidations also invalidate summaries.
Cached cards remain visible during safe refreshes; failures never become empty
successes.

## Reproduce

1. Save development GET `/api/pages` and `/api/vendor-categories` responses as
   `/tmp/vendors-before-pages.json` and `/tmp/vendors-before-cats.json`.
2. From `artifacts/api-server`, run
   `node --import tsx scripts/measure-vendor-directory.ts`.
   This read-only script writes `/tmp/vendors-after-summary.json`.
3. With the workspace otherwise idle, run
   `node artifacts/discover-barefoot-bay/scripts/measure-vendors-speed.mjs after`
   with optional `mobile`, `admin`, or `--timings-only`.
4. For before measurements, use the pre-change application checkpoint and the
   `before` probe argument. Do not run a before-labelled probe against the new UI.
   Never replace live auth or consent guards to get a timing sample.
