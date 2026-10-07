# Homepage banner loading verification

## Scope and ownership

The banner owned a timestamp-busted metadata read and separate media downloads.
Account/consent checking and lazy-route downloading have their own pending states.
Those global states and their normal navigation/consent protections are unchanged;
visible loading and retry feedback added here belongs only to the banner.
The supplied black screenshot alone could not identify a banner delay.

The banner now uses an eight-second cancellable, viewer-scoped metadata query:
30 seconds of freshness, five minutes of inactive retention, and a visible-tab
30-second refresh. There is no persistent slide fallback, invented empty-state
content, or public-read CMS write. A missing/empty configuration stays empty.
Admin mutations invalidate all banner snapshots and read confirmed server state.
The editor awaits the save promise, and retains the existing versioned writes.

Only the appropriate phone/desktop media tree mounts. The active image loads
first, with neighbors enabled 150 ms after readiness. Cached neighbors notify
readiness when selected. Existing video playback/posters remain in use.

Supported local raster images get 480/960/1440/1920-width WebP options, quality
85, with orientation/aspect ratio preserved and no enlargement. Original source
URLs, uploads, the 200 MB upload allowance, and original files are unchanged.
Untransformable/external images retain original delivery. Variant failures try
the original once; subsequent failures expose a manual retry.

The API rechecks the current page publication/hidden state, revision, and slide
membership before cached bytes or a 304. Derived bytes are disposable RAM cache
(20 MB, 96 entries, five minutes); two transforms maximum are coalesced, with
bounded response and processing deadlines. Derivatives are not CMS content or
local persistent files. Requests after a process restart must derive bytes again.

## Measurements (2026-10-06 America/Chicago)

Sequential anonymous Chromium runs against the development preview. Same
1365×900 desktop / 390×844 phone, DPR 1, no artificial network throttle, fresh
browser profiles, browser cache disabled for cold entry, and enabled for in-app
returns via `/terms`. All non-read API methods were blocked. Builds, tests,
screenshots, and probes were not run concurrently.

These are single paired samples, not statistically significant production
benchmarks. The after cold samples include first-time server derivation for
that size. Vite startup and unrelated page work vary; do not attribute their
differences to banner optimization.

| Metric | Desktop before | Desktop after | Phone before | Phone after |
|---|---:|---:|---:|---:|
| Document TTFB | 32 ms | 70 ms | 36 ms | 39 ms |
| DOMContentLoaded | 2,411 ms | 2,384 ms | 843 ms | 1,194 ms |
| Normal navigation first observed | 2,776 ms | 2,677 ms | 941 ms | 1,331 ms |
| Banner metadata request starts | 4,125 ms | 3,740 ms | 1,668 ms | 2,433 ms |
| Metadata request duration | 20 ms | 21 ms | 23 ms | 84 ms |
| Banner metadata rendered | 4,561 ms | 4,178 ms | 1,953 ms | 2,599 ms |
| First loaded banner image observed | 5,417 ms | 4,975 ms | 3,231 ms | 3,394 ms |
| Media wait after banner metadata rendered | 856 ms | 797 ms | 1,278 ms | 795 ms |
| First image response bytes | 2,133,041 | 224,690 | 2,133,041 | 52,242 |
| Banner image bytes during 7-second sample | 4,020,775 | 506,360 | 4,020,775 | 225,298 |
| In-app return first image | 333 ms | 346 ms | 419 ms | 319 ms |
| Slide-list reads on in-app return | 1 | 0 | 1 | 0 |

The first-image byte reduction is 89.5% desktop / 97.6% phone. Phone banner-media
wait improved approximately 38% in these samples. Desktop first-time variant
network duration itself increased (901 to 1,010 ms), despite smaller bytes and
slightly shorter post-render media wait; cold derivation remains a limitation.
Whole-page phone first-image time did **not** improve in this pair, because
startup/metadata began later. No whole-page or production speedup is claimed.

## Verification

- Frontend production build and API build pass (existing size/legacy warnings).
- Shared-library typecheck passes after generated API schema/type export
  disambiguation. Full artifact typechecks have existing large error baselines;
  an attempted full check exceeded the time budget, so they are not claimed
  green.
- Focused metadata/variant tests cover validation, cancellation, real empty
  data, viewer keys, original preservation, resize/aspect/no-upscale, coalescing,
  cache reuse, conditional delivery, hidden/DMCA/revision/membership rejection,
  and recovery from failed storage reads. Existing homepage-event tests also run.
- Anonymous browser checks pass for desktop dots, phone swipes, current-slide
  priority, failed/malformed/eight-second-timeout metadata and retry, independent
  homepage events, empty data, failed derivative + failed original and retry.
- Mixed-media checks on desktop and phone use a test-only WebM response fixture:
  a single video element reaches a playable state. Authentication and consent
  responses remain genuine; no authenticated identities were fabricated.
- Signed-in resident/admin browser flows, real uploads/crops, edit/add/delete/
  reorder persistence, and cross-browser editing remain **unverified** without
  legitimate sessions. Source contracts were checked; no production writes,
  credential reuse, authentication bypass, or publishing was performed.

Reproduce against the running preview:

```sh
node artifacts/discover-barefoot-bay/scripts/measure-banner-loading.mjs "https://$REPLIT_DEV_DOMAIN"
node artifacts/discover-barefoot-bay/scripts/measure-banner-loading.mjs "https://$REPLIT_DEV_DOMAIN" --mobile
node artifacts/discover-barefoot-bay/scripts/verify-banner-browser.mjs "https://$REPLIT_DEV_DOMAIN"
```
