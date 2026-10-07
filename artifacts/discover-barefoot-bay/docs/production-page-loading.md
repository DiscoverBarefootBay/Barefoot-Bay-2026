# Production page-loading investigation

Measured October 6, 2026 (America/Chicago). These are individual, anonymous
Chromium samples, not medians, cellular-device measurements or service guarantees.
No resident/admin credentials, copied session cookies or authentication bypasses
were used. The probe blocks non-read API requests to avoid creating visits or
analytics records during diagnostics.

## Confirmed faults and changes

- Live access settings allow Vendors guests. The old frontend disabled the
  directory query without a user, while its API required authentication. Guests
  could stay on “Loading vendors…” indefinitely without issuing a directory GET.
  The query now starts after the account check, and the API honors the same
  `nav-vendors`-before-`vendors` guest policy as the route guard.
- The global empty placeholder made the feature-settings query look resolved
  before authoritative settings arrived. Cold permitted pages could incorrectly
  redirect guests to login. That query now has no fabricated placeholder and
  bounds headers/body to ten seconds.
- The Clubs menu read every CMS page's full HTML/media to return only club
  titles. Live samples took roughly 1–6 seconds for this small response.
  It now reads social-club metadata only, preserving duplicate ordering and
  applying public visibility after duplicate selection.
- Directory headers/body have a ten-second abort deadline with a visible retry
  message. Query cancellation is preserved. Existing cards remain visible on a
  failed refresh; an initial error is not presented as an empty directory.

Hidden-content, DMCA/moderation visibility, account-scoped cache separation,
legal-consent ownership, private badges and signed-in visit writes are preserved.
No schema, feature-setting or production-data changes were made.

## Production baseline: existing published build

Measured from real unmodified reads at the verified `https://barefootbay.com`.
Scripts/assets and account/access checks are included in cold first-content time.

| Route | Desktop first content | Phone-sized first content | Observation |
| --- | ---: | ---: | --- |
| Home | 3.32 s | 1.78 s | Event content rendered; warm desktop returns 0.14–0.17 s |
| Calendar | 1.32 s | 1.43 s (corrected detector repeat) | Real calendar content rendered; warm desktop returns 0.27–0.38 s |
| Vendors | No directory content | No directory content | Cold entry intermittently redirected; revisits stayed on the skeleton with **zero directory requests** |
| Community | Cold entry redirected | 4.11 s | Phone sample successfully rendered; `/api/pages` took 2.90 s and returned about 898 KB |

No minute-long homepage/calendar server response was reproduced. This does not
rule out intermittent or signed-in delays. In particular, the Vendors fault was
a disabled query, not a measured 60-second API request.

## Updated preview: actual anonymous data, not auth/network fixtures

Desktop viewport 1365×900; phone-sized viewport 390×844. Builds/tests/screenshots
were not running concurrently with the sequential timing samples.

| Route | Desktop cold content | Phone-sized cold content |
| --- | ---: | ---: |
| Home | 1.98 s | 1.58 s |
| Calendar | 1.82 s | 1.24 s |
| Vendors | 1.41 s | 1.45 s |
| Community | 1.96 s | 1.49 s |

Vendors warm returns took about 0.22 s on each viewport, without another directory
request. Its anonymous directory GET completed in 32 ms desktop / 26 ms phone
and returned about 53 KB. Club-menu requests completed in 27–105 ms in preview.
First-ever in-app Vendors entry from a fresh homepage took 0.62 s desktop and
0.59 s phone; those runs had not previously visited Vendors.
The different preview database/network means these numbers must **not** be
reported as production before/after improvements.

## Verification

- Full web test suite: 176 passing tests.
- Targeted API tests: six passing tests covering guest policy precedence,
  denied/inactive guest settings, admin/view-as hidden scope, owner/DMCA and
  moderation visibility, projected response fields, duplicate precedence,
  metadata-only club choices and explicit backend failure.
- Real UI/component tests cover loading, true empty, initial error/retry, failed
  refresh retention, guest allowed/denied and account/role cache transitions.
- Deadline tests cover both stalled headers and stalled bodies, cancellation,
  401 and successful reads. The real feature hook is tested against a query
  client with the global empty placeholder to catch premature access decisions.
- OpenAPI regenerated with library type validation; frontend production build
  passed. API workflow rebuilt successfully and both workflows are running.
- Anonymous preview HTTP checks returned 200 for directory/Clubs. Even when
  requesting `includeHidden=true`, guests received zero hidden entries.
- Preview screenshots confirmed rendered guest Vendors cards at desktop and
  phone widths, and guest Community cards at phone width. Signed-in UI was not
  screenshot-verified.

## Measurement limits and publishing

The initial phone Calendar detector did not match its day-view event links;
rendered content was present, so a missing timestamp is not a loading failure.
The repeatable probe now recognizes those links and distinguishes cold direct
entry, first-ever in-app entry and subsequent returns.
The corrected production phone Calendar repeat measured 1.43 s cold and
0.07–0.08 s on returns.

Signed-in production/UI timing was not verified: no authorized resident/admin
sessions were available. Synthetic identities in isolated tests prove behavior,
not live signed-in performance. The new implementation has **not** been published
by this task; production-after-publish confirmation remains necessary.

Publish both the web and API changes, then verify guest/resident/admin cold and
warm navigation on the live site with legitimate sessions. There is no database
migration for these changes. Large event/banner photographs (roughly 1–4 MB
each in the samples) remain a separate opportunity to reduce phone bandwidth
and image decoding work without lowering original-upload limits.

## Repeatable anonymous probe

`scripts/measure-live-page-loading.mjs` accepts a verified HTTPS production or
preview origin. Optional flags: `--mobile`, `--first-in-app` (fresh homepage then
first Vendors entry), and `--routes=/calendar` to check a single route.

The first-content detector measures rendered text/cards, not completion of every
image. The normal two in-app samples are **returns after a cold visit**, not
first-ever entries. Warm observation lasts 1.2 seconds; missing timestamps are
unresolved observations, not proof of an indefinite wait. Guest cold observation
lasts 12 seconds for Vendors and 6.5 seconds for the other routes.
