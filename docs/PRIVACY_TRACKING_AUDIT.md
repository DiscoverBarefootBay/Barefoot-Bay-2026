# BarefootBay.com — Privacy & Website-Tracking Audit

**Date:** July 31, 2026
**Prepared for:** Site owner and legal counsel (Walters Law Group)
**Prompted by:** *D.B. et al. v. Bellesa Enterprises US, Inc.*, No. 2:25-cv-05099-JAK (MARx) (C.D. Cal. July 14, 2026) and related client alert
**Scope:** Read-only review of the application repository (`artifacts/discover-barefoot-bay` frontend, `artifacts/api-server` backend) plus limited runtime inspection of the development environment. **No application code, configuration, or production behavior was changed.**

> This is a technical and factual report. It contains no legal conclusions. Statements are labeled **Confirmed** (verified in source or at runtime), **Inferred** (reasonable inference from code), **Unknown** (could not be established), or **Needs manual verification** (requires production testing). All identifiers, sample payload values, and secrets are redacted; environment variables are referenced by name only.

---

## 1. Executive Summary

**Overall technical privacy-risk rating: HIGH**

The rating is driven by the combination of (a) an always-on first-party tracking system that records page-level activity, plaintext IP addresses, and logged-in user IDs with **no consent mechanism of any kind**, and (b) a Privacy Policy that states "We do not sell, rent, or share your personal information with third parties" while the site does transmit personal data to several third parties (Google, SendGrid/Twilio, Square, Printful, Replit/Neon) and names none of them. Per the attached order and client alert, a comparable policy-vs-practice gap was the basis on which the Bellesa court declined to dismiss on consent grounds; whether the gap here has similar significance is a question for counsel. Mitigating factors: there is **no third-party analytics or advertising SDK** (no Google Analytics, Meta Pixel, TikTok, etc.), tracking data is stored in site-controlled infrastructure, and page-view tracking captures URL paths only (query strings and fragments are deliberately stripped).

### Five most important confirmed findings
1. **No consent banner, opt-in, opt-out, DNT, or GPC handling exists anywhere in the codebase.** First-party tracking begins on first request for every visitor, logged in or not (`artifacts/api-server/src/app.ts:113-116`; no matches repo-wide for consent/GDPR/CCPA/DNT/GPC UI).
2. **The custom tracker links browsing activity to identified accounts.** `analytics_sessions`, `analytics_page_views`, and `analytics_events` store `user_id`, plaintext `ip`, `user_agent`, a persistent 30-day cookie (`analytics_session_id`), a visitor fingerprint value, and GeoIP-derived city/lat-long (`artifacts/discover-barefoot-bay/shared/analytics-schema.ts:9-89`; `artifacts/api-server/src/services/analytics-service.ts:109-236`).
3. **The Privacy Policy contradicts actual practice.** It says personal information is not sold, rented, **or shared** with third parties (except legal compliance), names no tracking tools or recipients, and describes cookies only generically — while the site sends data to Google (Maps, reCAPTCHA), SendGrid, Square, Printful, and hosts all data on Replit/Neon infrastructure (policy text retrieved at runtime from `page_contents`, slug `privacy-policy`, last updated 2026-01-04; third-party flows in §6).
4. **No analytics retention limit or deletion pipeline exists.** No cleanup job, no retention window, and no code deleting a user's analytics rows when an account is deleted; tracking rows referencing a deleted account's `user_id` persist indefinitely (repo search; `shared/analytics-schema.ts:91-133` declares relations without cascade).
5. **Admin surfaces expose per-user activity.** The active-users endpoint returns user `{id, username, fullName}` with current page, device, and location coordinates; admin dashboards include a geographic visitor map and CSV/JSON exports of events including page paths (`artifacts/api-server/src/services/analytics-service.ts:620-761`; `src/routes/analytics.ts:271-366`).

### Five most important unknowns
1. **Production runtime behavior was not tested** (cookie issuance on barefootbay.com, actual outbound requests, header behavior). Development-environment routing differs from production; see §7.
2. **Production policy text** — the policy shown here came from the development database copy; the live site's `page_contents` row should be confirmed identical. The **Terms page is boilerplate for "Tattler Media"**, not Barefoot Bay, suggesting the legal pages may not have been reviewed.
3. **Whether dormant code paths are reachable in production** — a legacy tracker (`src/lib/analytics-tracker.ts`) that calls `api.ipify.org` (a third-party IP-echo service) from the browser appears unimported/inactive, but this needs production network verification.
4. **Data-processing agreements** with SendGrid, Square, Google, Printful, Replit/Neon — none are referenced in the repository.
5. **Backup and database-hosting retention** — analytics data presumably enters Replit/Neon backups; retention and deletion behavior of those backups is outside the repository's visibility.

### Conditions warranting review before continued operation
No third-party analytics/advertising tracker was found, so there is no "suspend the pixel" emergency of the Bellesa type. However, counsel should promptly review (i) the "we do not share" policy sentence versus actual third-party flows, and (ii) operation of consent-less tracking of identified users, both of which are ongoing.

---

## 2. System Architecture

| Layer | Implementation | Evidence |
|---|---|---|
| Frontend | React + Vite SPA (`artifacts/discover-barefoot-bay`), path-routed | `src/App.tsx`, `index.html` |
| Backend | Node.js/Express API (`artifacts/api-server`) | `src/app.ts`, `src/index.ts` |
| Authentication | Session-based (Passport + `express-session`, PostgreSQL session store, cookie `connect.sid`, 30-day, httpOnly, SameSite=Lax, secure in production) | `src/app.ts:83-107`, `src/auth.ts:194-201` |
| Database | PostgreSQL via Drizzle ORM; `DATABASE_URL` (Neon-hosted per diagnostics) | `src/db.ts:6-21`, `src/routes/calendar-diagnostics.ts:120-136` |
| Hosting | Replit (dev + deployment); Replit Object Storage for media | `@replit/object-storage`, `src/lib/object-storage-client.ts` |
| Logging | `console.log` to process stdout/stderr; structured logger redacts cookies (`src/lib/logger.ts:1-10`); Square webhook/transaction file logs (`server/logs/*.log`) | see §Findings F-9 |
| Analytics/Tracking | Fully custom, first-party (see §3–4). No external analytics SDK. | `src/lib/analytics.tsx` (client), `src/analytics-service.ts` + `src/services/analytics-service.ts` (server) |
| Third-party integrations | Google Maps/reCAPTCHA/Gmail-OAuth/Gemini, SendGrid, Square, Printful, OpenWeather, ipify (dormant), Replit/Neon | §6 |
| Consent mechanism | **None** (registration-time Terms/Privacy checkboxes only; no cookie/tracking consent) | §E findings, `src/pages/auth-page.tsx:1093-1270` |

---

## 3. Tracking Inventory

| Tool/system | 1st/3rd party | Source location | Trigger | Purpose | Data collected | Identifiers | Recipient | Storage | Retention | Consent category | Fires before consent? | Fires after rejection? | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Server analytics middleware | 1st | `api-server/src/analytics-service.ts:9-112`, installed `src/app.ts:113-116` | Every non-API, non-static HTML request | Site analytics | IP (plaintext), UA, referrer, entry path + query, Accept-Language, device/browser/OS parse, GeoIP country/region/city/lat-long, visitor fingerprint | `analytics_session_id` cookie (30d), `user_id` when logged in | Own DB | `analytics_sessions`, `analytics_page_views` (Postgres/Neon) | Indefinite (no cleanup found) | Would be "analytics" | Yes (no consent exists) | N/A (no rejection possible) | Confirmed | cited |
| Client AnalyticsProvider | 1st | `discover-barefoot-bay/src/lib/analytics.tsx:41-294`, mounted `src/App.tsx:538` | SPA navigation, clicks, form submits, unload | Site analytics | pathname (no query), page title, load time, screen size, language, UA, referrer, click text/element/coords (href query stripped), form id/action | Server-side session cookie + `user_id` via session | Own API → own DB | `analytics_page_views`, `analytics_events` | Indefinite | "analytics" | Yes | N/A | Confirmed | cited |
| Legacy tracker (`analytics-tracker.ts`) | 1st + 3rd (ipify) | `src/lib/analytics-tracker.ts:66-72, 354-406` | **Not imported anywhere — appears dormant** | Legacy analytics | Would send path, UA, timestamp, and browser-fetched public IP from `https://api.ipify.org` | own cookie | ipify.org (IP echo), own API | n/a | n/a | n/a | n/a | n/a | Confirmed dormant in code; **needs production verification** | grep: no imports |
| Google Maps JS/static/embed | 3rd | `src/components/maps/google-maps-loader.ts:35-56`, `calendar/static-map-image.tsx:33-56`, `calendar/direct-map-iframe.tsx:25` | Viewing calendar event locations; admin geo map | Maps display | Browser request metadata (IP, UA), map/place query (event address), API key | Google cookies possible via embed | Google (`maps.googleapis.com`, `google.com/maps/embed`) | Google | Google's | Would be "functional" | Yes | N/A | Confirmed in code; runtime unverified | cited |
| Google reCAPTCHA v2 | 3rd | `src/pages/auth-page.tsx:94-95, 1139-1147`; server verify `api-server/src/auth.ts:331-375` | Registration form | Bot prevention | Browser fingerprint signals collected by Google's widget; token verified server-side | Google cookies | Google | Google | Google's | "strictly necessary"-adjacent, but Google may combine | Yes | N/A | Confirmed | cited |
| Bot detection (registration) | 1st | `api-server/src/bot-detection.ts` | Suspicious username patterns at registration | Security | Flagged user's ID, full name, username, email → emailed to admins via SendGrid | user identifiers | Admin mailboxes via SendGrid | Email | Mailbox-dependent | Security | Yes | N/A | Confirmed | cited |
| SendGrid (email) | 3rd | `api-server/src/sendgrid-service.ts:182-260` and senders | All outgoing email | Email delivery | Recipient/sender names+emails, message content (listing inquiries, forum content, order details, reset links) | email address | Twilio SendGrid | SendGrid infrastructure | SendGrid's | Service provider | N/A (server-side) | N/A | Confirmed | cited |
| Square (payments) | 3rd | `api-server/src/routes/subscriptions.ts:75-188`, `credit-purchase-service.ts` | Purchases/subscriptions | Payments | Order/customer/payment metadata; card data handled on Square-hosted checkout | account identifiers | Square (`connect.squareup.com`) | Square | Square's | Transactional | N/A | N/A | Confirmed | cited |
| Printful | 3rd | `api-server/src/printful-service.ts:30-42` | Product sync / fulfillment | Merch fulfillment | Order + customer shipping data | name/address | Printful | Printful | Printful's | Transactional | N/A | N/A | Confirmed configured | cited |
| Gmail OAuth / Google Gemini / OpenWeather | 3rd | `src/email-service.ts:2-124`; Gemini + OpenWeather env refs | Server features when configured | Email transport / AI / weather | Email payloads (Gmail); prompts (Gemini); coordinates (weather) | varies | Google / OpenWeather | theirs | theirs | Service provider | N/A | N/A | Inferred (configured via env presence) | cited |
| GA / Meta Pixel / TikTok / Segment / Sentry / etc. | — | — | — | — | — | — | — | — | — | — | — | — | **Confirmed ABSENT** (dependency + code search) | §6 |

---

## 4. Event Inventory (custom tracker)

Active client tracker: `src/lib/analytics.tsx`. Server receivers: `api-server/src/routes/analytics.ts:74-162`. All rows stored with session ID, IP, UA, and `user_id` when authenticated (`src/services/analytics-service.ts:159-236`).

| Event | Trigger | Payload fields | Sample (redacted) | Sensitive-exposure potential | Stored |
|---|---|---|---|---|---|
| `pageview` | Initial load; `pushState`/`replaceState`/`popstate` wrap (`analytics.tsx:41-91,133-152`) | url (pathname only), title, loadTime, screen {w,h}, referrer, userAgent, language, timestamp | `{url:"/forum/post/[id]", title:"[post title] - Barefoot Bay", screen:{w:###,h:###}, lang:"en-US", ...}` | **Yes** — path + document title reveal specific forum stories, listings, vendor pages, admin pages visited; title can contain user-generated content names | `analytics_page_views` |
| `click` (automatic) | Any anchor/button/ARIA-control click or Enter/Space (`analytics.tsx:161-294`) | element text, tag/id/class path, coordinates, sanitized href (origin+pathname; query/hash stripped) | `{action:"click", label:"[link text]", href:"/for-sale/[id]", x:###, y:###}` | Moderate — clicked-link text may include content titles | `analytics_events` |
| `form_submit` (automatic) | Form submission (`analytics.tsx:161-294`) | formId, action, method, path — **no field values** | `{formId:"[id]", action:"/api/...", method:"post"}` | Low (no values) — but reveals *that* a form (e.g., contact-seller) was used | `analytics_events` |
| `session_end` | `beforeunload` beacon (`analytics.tsx:154-158`) | session end signal | — | Low | updates `analytics_sessions` |
| Server-side pageview | Every HTML request via middleware (`analytics-service.ts:93-107`) | req.path **+ query string**, method, isAuthenticated, IP, UA, referrer, Accept-Language, viewport header | `{path:"/forum?[params]", ip:"[redacted]", ua:"[redacted]"}` | **Yes** — unlike the client tracker, the middleware passes `req.query`; entry-page query parameters can be recorded | `analytics_page_views` |
| Arbitrary custom events | Any code may call exported `trackEvent` with arbitrary `properties`/`eventData` JSON (`analytics.tsx:101-125`; schema `analytics-schema.ts:69-89`) | open-ended | — | Schema imposes no restriction; future code could add sensitive payloads | `analytics_events` |

**Not collected (Confirmed):** form field values, passwords, payment data, message bodies; client-side URLs exclude query strings; no search-term-specific event exists. **Caveat:** the server middleware records entry query strings, and the schema's JSONB columns are unconstrained.

---

## 5. Data-Flow Matrix

| Data element | Source | Processing | Internal storage | External recipient | Purpose | Identifier linkage | Consent dependency | Retention | Deletion | Evidence | Concern |
|---|---|---|---|---|---|---|---|---|---|---|---|
| IP address (plaintext) | Every tracked request | GeoIP lookup (local `geoip-lite`, no remote call) | `analytics_sessions.ip`, `analytics_page_views.ip` | None (infrastructure hosts DB) | Analytics/geo | Joined to `user_id`, session cookie | **None** | Indefinite | None found | `services/analytics-service.ts:109-146` | Plaintext, indefinite, account-linked |
| Page path (+ title client-side; + query server-side) | Browser + middleware | Stored per view | `analytics_page_views.path` | None | Analytics | session + user_id + IP | None | Indefinite | None | `analytics.tsx:55-91`; `analytics-service.ts:93-107` | Reveals content viewed by identified users |
| Device/browser/OS, screen, language, fingerprint value | Browser + UA parsing | Parsed, stored | `analytics_sessions` | None | Analytics | session + user_id | None | Indefinite | None | `services/analytics-service.ts:109-146` | Fingerprint-style attributes mirror those in Bellesa |
| Geolocation (city, lat/long from IP) | GeoIP | Stored; shown on admin map | `analytics_sessions` | Google Maps renders admin map tiles | Analytics | session + user_id | None | Indefinite | None | `admin/geo-location-map.tsx:246,329` | Coordinates of identified users displayed |
| Account data (email, name, phone) | Registration/profile | Auth, email, commerce | `users` table | SendGrid, Square, Printful (transactional) | Operations | direct | Registration T&P checkboxes | Account lifetime | Account deletion (analytics rows persist) | §6 | Policy says data isn't "shared" |
| Email content (inquiries, forum notifications, orders) | User actions | Rendered server-side | — | SendGrid (or Gmail OAuth transport) | Email delivery | email address | Notification emails honor unsubscribe flag; transactional don't | SendGrid's | — | `sendgrid-service.ts` | Third-party processor unnamed in policy |
| Event address / map queries | Calendar content | Browser → Google | — | Google Maps | Map display | Browser IP/UA to Google | None | Google's | — | §3 | Third-party receipt of browsing context |
| Registration form + reCAPTCHA signals | Registration page | Google widget; server verify | — | Google | Bot prevention | Google's cookies | None | Google's | — | `auth-page.tsx:1139-1147` | Google can combine with its data |

---

## 6. Third-Party Recipient Matrix

| Recipient | Domain(s) | Direction | Data received | Named in Privacy Policy? |
|---|---|---|---|---|
| Google (Maps/Places) | `maps.googleapis.com`, `maps.gstatic.com`, `google.com/maps/embed` | Browser→3P and server→3P | IP, UA, map/place queries (event addresses), API key | **No** |
| Google (reCAPTCHA) | `www.google.com/recaptcha` | Browser→3P; server verify | Browser environment signals, token | **No** |
| Google (Gmail OAuth, Gemini) | `googleapis.com` | Server→3P (when configured) | Email payloads; AI prompts | **No** |
| Twilio SendGrid | SendGrid API | Server→3P | Names, emails, message/order/reset content | **No** |
| Square | `connect.squareup.com` | Server→3P + hosted checkout | Order/customer/payment metadata | **No** |
| Printful | Printful API | Server→3P | Product/order/shipping data | **No** |
| ipify | `api.ipify.org` | Browser→3P — **dormant code only** | Would receive requester IP | **No** |
| OpenWeather | OpenWeather API | Server→3P (if configured) | Coordinates/location for weather | **No** |
| Replit (hosting, object storage) | `object-storage.replit.app`, platform | Infrastructure | All app data incl. analytics DB traffic; media assets fetched by browsers | **No** |
| Neon (Postgres hosting, per diagnostics) | neon.tech | Infrastructure | Entire database incl. tracking tables | **No** |
| **Absent:** Google Analytics/GTM, Meta, TikTok, Segment, Mixpanel, Amplitude, PostHog, Hotjar, Clarity, FullStory, Heap, Sentry, Datadog, New Relic, LogRocket, Intercom, HubSpot, Mailchimp, Stripe(browser), YouTube/Vimeo embeds, social widgets, ad/retargeting pixels | — | — | Confirmed absent from dependencies and source | — |

---

## 7. Consent Test Results

**Environment limitation (important):** runtime tests were performed against the development environment only. In development, the SPA is served by a Vite dev server and the analytics middleware sits on the separate API process, so cookie behavior differs from production (where the API server serves the site and its middleware runs on every page request). Production (`barefootbay.com`) was **not** tested. Results below are code-confirmed plus dev-runtime observations.

| State | Result | Basis |
|---|---|---|
| New visitor, no cookies | No consent banner exists to interact with. Server middleware creates an analytics session and sets `analytics_session_id` (30-day, httpOnly, SameSite=Lax) on first tracked page request; client tracker begins posting pageviews immediately on app mount. | Confirmed in code (`analytics-service.ts:46-77`, `analytics.tsx:41-52`); dev homepage fetch returned no Set-Cookie because of dev routing split — **needs production verification** |
| Before consent interaction | Tracking active — there is no consent interface | Confirmed (repo-wide absence) |
| After "Reject" | Not possible — no reject option exists | Confirmed |
| Analytics-only / advertising-only | Not offered | Confirmed |
| "Accept All" | Not offered | Confirmed |
| Logged-out user | Tracked with session cookie, IP, UA, fingerprint; `user_id` null | Confirmed in code |
| Logged-in user | Same, plus `user_id` attached to sessions, pageviews, events | Confirmed (`services/analytics-service.ts:159-236`) |
| Consent withdrawal | No mechanism. The only user preference is the **email** unsubscribe (`/unsubscribe`), which does not affect tracking | Confirmed (`unsubscribe-page.tsx:198-280`) |
| Cookies cleared | New analytics session/fingerprint would be issued on next request; prior rows persist | Inferred from code |
| GPC / DNT signals | Not read anywhere | Confirmed (no matches) |
| Mobile vs desktop | Same code path; device type parsed and stored (note: iPad classified "mobile" — `analytics-service.ts:121-132`) | Confirmed |

---

## 8. Privacy-Policy Consistency Matrix

Policy text was retrieved at runtime from the CMS table (`page_contents`, slug `privacy-policy`, "updated 2026-01-04"). **Needs manual verification that the production row is identical.**

| Policy/UI statement | Actual implementation | Consistent? | Evidence | Severity | Recommended factual correction | Question for counsel |
|---|---|---|---|---|---|---|
| "We do not sell, rent, or share your personal information with third parties except to comply with legal obligations…" | Personal data flows to SendGrid, Square, Printful, Google (Maps/reCAPTCHA/Gmail), hosted on Replit/Neon | **No** | §6 | **High** | Qualify: name each service provider and purpose, or narrow the sentence to "sell" | Does any flow constitute "sharing" under applicable statutes? Is service-provider language needed? |
| "BarefootBay.com uses cookies and similar technologies to enhance user experience, track website usage patterns…" | True but generic: does not name the analytics system, the `analytics_session_id` cookie, fingerprinting attributes, IP/geolocation collection, or account linkage | **Partially** — per the attached client alert, the Bellesa court treated generic disclosure as insufficient at the pleading stage | policy text; §3–4 | **High** | Enumerate cookies by name/purpose/duration; describe the first-party analytics system, data categories, and account linkage | Is this disclosure specific enough to support a consent defense? |
| "We collect information you voluntarily submit…" (collection section lists only volunteered data) | Site also automatically collects IP, UA, device attributes, geolocation, browsing history | **No** | §4 | **High** | Add an "information collected automatically" section | — |
| "Users may control cookie settings through their browser preferences." | Only browser-level control; no site mechanism; analytics cookie is httpOnly and set server-side | Technically true, practically weak | §7 | Moderate | Describe an actual opt-out if one is built | Is browser-settings deflection adequate in relevant states? |
| "You have the right to access, update, or request deletion of your personal information." | No deletion pipeline exists for analytics data; account deletion leaves tracking rows | **No** (for analytics data) | §Findings F-4 | **High** | Build deletion procedures before promising them | Does the current gap create deceptive-practice exposure (cf. NY GBL § 349 analysis in Bellesa)? |
| Registration requires accepting Terms + Privacy Policy (checkboxes, modals) | Confirmed implemented and enforced | Yes | `auth-page.tsx:1093-1270` | Info | — | Does checkbox acceptance of *this* policy text constitute consent to tracking not described in it? |
| Terms page ("Terms and Agreements") | Content is boilerplate for **"Tattler Media"**, a news-media entity — not Barefoot Bay's actual services | **No** | runtime fetch of slug `terms-and-agreements` | **High** | Replace with terms drafted for this site | Enforceability of mismatched terms? |
| No cookie policy exists | Cookies are used (auth + analytics) | Gap | §policy findings | Moderate | Add a cookie disclosure | — |
| Policy has no effective date/version | Only DB `updated_at` | Gap | runtime fetch | Low | Add effective date + version | Preservation of prior versions? |

---

## 9. Bellesa-Relevance Matrix

| Bellesa issue | BarefootBay implementation | Evidence | Similarity | Important distinction | Technical risk | Question for counsel |
|---|---|---|---|---|---|---|
Characterizations of the Bellesa ruling in this section are drawn from the attached court order and Walters Law Group client alert; they are summaries of those materials, not this report's legal analysis. "Technical risk" ratings describe factual gap size, not legal exposure.

| Specific disclosure of tracking tools | Policy names no tools; custom tracker undisclosed by name | §8 | **Similar gap** — per the attached order, Bellesa's consent defense failed at the pleading stage for lack of explicit notice | No third-party tool; the tracker is first-party | High | Does first-party status change the ECPA/CIPA "interception" analysis? |
| Specific identification of recipients | No recipient named | §6, §8 | Similar | Recipients are processors, not analytics/ad companies | High | Which recipients must be named? |
| URLs/page titles/content info transmitted | Paths + document titles of forum stories, listings, vendor pages recorded; transmitted only to own server | §4 | Partially similar (collection yes, third-party transmission no) | In Bellesa, video titles/URLs went **to Google**; here they stay in-house | Moderate | Does first-party collection without disclosure still create exposure (GBL-style omission claims)? |
| Cookie/session identifiers | 30-day `analytics_session_id` + visitor fingerprint value | §3 | Similar mechanics | Cookie is first-party, httpOnly, not shared | Moderate | — |
| Account linkage | `user_id` attached to sessions/pageviews/events when logged in | `services/analytics-service.ts:159-236` | **Stronger than Bellesa** — direct linkage, not deanonymization-by-Google | Data never leaves operator | High | Sensitivity of directly identified browsing history? |
| Device/browser fingerprinting attributes | Language, screen size, browser/OS versions stored — the exact categories listed in the Bellesa complaint | §4 | Similar attributes | Not sent to a third party | Moderate | — |
| Third-party sharing | Maps/reCAPTCHA browser flows; processor flows (email/payments/fulfillment); hosting | §6 | Partial | No analytics/ad recipients | Moderate | "Sale/share/valuable consideration" analysis per state law |
| Tracking before consent | All tracking pre-consent; no banner | §7 | **Similar** | — | High | — |
| Ability to reject/withdraw | None | §7 | **Worse than typical** | — | High | — |
| Contradictory policy language | "do not … share" vs. actual flows | §8 | **Directly parallel** to the alert's core warning | — | High | — |
| First- vs third-party tracking | Entirely first-party analytics | §3 | Key distinction in operator's favor | Bellesa turned on disclosure **to Google** | Mitigating | How much does this reduce exposure under each statute? |
| Potentially sensitive activity | Community site: forum reading history, private-message page visits, for-sale/real-estate pages (addresses), possible age/health inferences from a 55+ community context, admin pages | §Findings F-6 | Lower sensitivity than adult content, but browsing history of identified residents is recorded | Not adult content | Moderate | Is any category "sensitive" under FL/CA or other statutes? |
| Retention/deletion | Indefinite; no deletion | F-4 | Aggravating | — | High | Does historical data require remediation? |
| Registered vs unregistered users | Both tracked; only registered users get `user_id` linkage | §7 | Parallel to Bellesa's consumer-status discussion | — | Info | — |
| Free vs restricted content | Most content public; some features login-gated | App routes | Bellesa's VPPA nexus analysis is video-specific | No video-rental analog | Low | — |

---

## 10. Findings by Severity

**F-1 · HIGH — Tracking operates with no consent mechanism.**
Confirmed: no consent banner/CMP/opt-out/DNT/GPC handling exists; server middleware and client provider track every visitor from first request. Evidence: `api-server/src/app.ts:113-116`, `src/analytics-service.ts:9-112`, repo-wide search. Data: paths, titles, IP, UA, device, geo, fingerprint, user_id. Recipient: own DB. User state: all. Concern: optional analytics operating pre-consent; no rejection possible. Remediation: gate non-essential tracking behind an affirmative opt-in; honor GPC. Verification: new-visitor network test shows no analytics POSTs and no analytics cookie before opt-in. Counsel: is first-party analytics "non-essential" in relevant jurisdictions?

**F-2 · HIGH — Policy states personal information is not "shared" while third-party flows exist; no tools or recipients named.**
Confirmed via runtime policy fetch + §6 inventory. Concern (factual): the disclosure gap parallels the one described in the attached Bellesa order and client alert; whether it creates statutory or deceptive-omission exposure is for counsel to assess (see §12, Q7). Remediation: factual policy rewrite naming tools, recipients, categories, purposes (counsel to draft). Verification: side-by-side of revised policy vs. §6 matrix.

**F-3 · HIGH — Browsing history is directly linked to identified accounts and IPs, stored in plaintext, indefinitely.**
Confirmed: `analytics_sessions`/`analytics_page_views`/`analytics_events` store `user_id`, plaintext `ip`, `user_agent`, fingerprint, geo; no truncation or hashing. Evidence: `shared/analytics-schema.ts:9-89`, `services/analytics-service.ts:109-236`. Remediation: drop or truncate IP (e.g., /24), drop fingerprint unless needed, separate identity from analytics, shorten identifier lifetime. Verification: schema/write-path inspection after change.

**F-4 · HIGH — No retention limit or deletion pipeline; deleted accounts persist in tracking records; policy promises deletion rights.**
Confirmed: no cleanup job, no cascade, no account-deletion hook for analytics rows. Evidence: repo search; `analytics-schema.ts:91-133`. Remediation: retention window (e.g., 12–14 months), delete/anonymize analytics rows on account deletion. Verification: delete a test account; confirm analytics rows removed or anonymized.

**F-5 · MODERATE — Server middleware records entry-page query strings.**
Confirmed: middleware passes `req.query` into pageview properties (`src/analytics-service.ts:93-107`) even though the client tracker deliberately strips queries. Query strings can carry search terms, tokens, or identifiers. Remediation: strip query strings server-side (keep an allowlist if needed). Verification: inspect stored rows after change.

**F-6 · MODERATE — Recorded paths/titles reveal potentially sensitive activity of identified users.**
Confirmed: forum story reads, private-message page visits, for-sale/real-estate listing views (addresses in content), vendor pages, admin pages all produce distinct recorded paths and titles; admin "active users" panel shows who is on which page with location coordinates (`services/analytics-service.ts:620-761`). Remediation: consider category-level rather than full-path recording for sensitive sections; restrict per-user views. Counsel: sensitivity classification.

**F-7 · MODERATE — Google receives browser data on map and registration pages without disclosure.**
Confirmed in code: Maps JS/static/embed and reCAPTCHA load from Google with the user's IP/UA and page context; one map embed key is hardcoded in source (`direct-map-iframe.tsx:25`). Remediation: disclose in policy; consider click-to-load maps; move hardcoded key to config and restrict it. Runtime confirmation on production advised.

**F-8 · MODERATE — Admin exports and dashboards expose activity data; access limited to admins but unaudited.**
Confirmed: CSV/JSON exports of events incl. paths (`routes/analytics.ts:304-366`); additional export code in `admin-access-check.ts:1349-1852` and `routes/analytics-public.ts:601-732` (the latter's mounting/auth **needs manual verification** given its "public" naming). Remediation: verify auth on every analytics route; add access logging.

**F-9 · MODERATE — Application logs contain PII; a dormant tracker and duplicate analytics code increase drift risk.**
Confirmed: console logs include emails/user IDs in password-reset, Square, and forum paths (e.g., `src/password-reset.ts:25-26`, `src/routes/orders.ts:148,660-686`); WebSocket handler logs client IP/UA and message data (`src/index.ts:15946-15977`); Square file logs under `server/logs/`. Dormant `analytics-tracker.ts` contains a live third-party call (`api.ipify.org`) that would fire if the file were ever imported. Remediation: redact PII from logs; delete dormant tracker and legacy `analytics.ts` duplicate; confirm log retention on hosting platform.

**F-10 · LOW — Terms page is another entity's boilerplate; policy lacks effective date/version; no cookie policy.**
Confirmed via runtime fetch. Remediation: counsel to replace terms; add dates/versions; add cookie disclosure.

**F-11 · INFORMATIONAL — Positive practices.**
No third-party analytics/ad SDKs; client tracker strips query strings and hash from URLs and click hrefs; no form-field value capture; structured logger redacts cookies; unsubscribe links are HMAC-tokenized with RFC 8058 headers; sessions are httpOnly; bot traffic filtered from dashboards.

---

## 11. Prioritized Remediation Plan (not implemented in this audit)

**Immediate containment (0–48 h)**
1. Counsel review of the "we do not … share" sentence and the mismatched Terms page (F-2, F-10).
2. Verify auth on `routes/analytics-public.ts` export endpoints (F-8).
3. Confirm production policy text and production tracking behavior (Unknowns 1–2).

**Near term (1–2 weeks)**
4. Publish a corrected Privacy Policy naming tools, recipients, data categories, purposes; add cookie disclosure and effective date (F-2, F-10).
5. Strip query strings from server-side pageview recording (F-5).
6. Delete dormant `analytics-tracker.ts` (ipify call) and legacy duplicate tracker (F-9).
7. Redact emails/IPs from application logs (F-9).

**Medium term (30–60 days)**
8. Implement a consent banner gating non-essential analytics (client + server), honoring GPC; record consent with timestamp/version (F-1).
9. Add analytics retention window and scheduled purge; anonymize/delete analytics rows on account deletion (F-4).
10. Truncate or stop storing IPs; drop fingerprint attribute storage unless justified (F-3).

**Longer term**
11. Aggregate reporting instead of raw per-user rows where possible; restrict and log admin access to per-user activity (F-6, F-8).
12. DPA review with SendGrid, Square, Google, Printful, Replit/Neon (Unknown 4).
13. Periodic re-audit after significant feature changes.

---

## 12. Questions for Legal Counsel

1. Which jurisdictions/statutes apply given the user base (Florida 55+ community; FDBR, CCPA/CIPA if California nexus, NY GBL if NY users, ECPA)?
2. Do the site's analytics records (IP + browsing history + account linkage) constitute personal or sensitive information under applicable statutes?
3. Do the SendGrid/Square/Printful/Google/hosting relationships constitute "sale," "sharing," or service-provider processing? Are DPAs required or in place?
4. Is registration-checkbox acceptance of the current policy adequate consent for tracking the policy does not describe? What consent language is sufficiently specific post-Bellesa?
5. Does historical tracking data (indefinitely retained, account-linked) require deletion or other remediation?
6. Must prior versions of the policy/consent UI be preserved (litigation hold considerations)?
7. Does the "right to deletion" promise in the policy, unmet for analytics data, create independent deceptive-practices exposure?
8. Should the Terms page mismatch ("Tattler Media") be treated as urgent given enforceability implications?

---

## 13. Unknowns and Limitations

- **Production runtime not tested:** cookie issuance, request flows, header behavior on barefootbay.com; the dev environment routes the SPA and API separately, so dev observations understate production tracking.
- **Production database content:** policy/terms text verified only against the development copy of `page_contents`.
- **Backups:** retention/deletion of analytics data inside Replit/Neon backups is not visible from the repository.
- **Access control breadth:** which individuals hold admin accounts (and thus can view per-user activity) is a production question.
- **`routes/analytics-public.ts` mounting/auth** was not conclusively verified.
- **Configured-but-conditional integrations** (Gmail OAuth, Gemini, OpenWeather, Stripe key reference in `user-subscriptions.ts:6-7`) activate based on environment configuration; production env state not inspected.
- Line numbers reflect the repository at audit time and will drift with future edits.

---

## 14. Evidence Appendix

**Key source files**
- Client tracker (active): `artifacts/discover-barefoot-bay/src/lib/analytics.tsx` (provider mounted at `src/App.tsx:538`); legacy duplicates: `src/lib/analytics.ts`, `src/lib/analytics-tracker.ts` (dormant; ipify call at :355)
- Server middleware: `artifacts/api-server/src/analytics-service.ts` (installed `src/app.ts:113-116`, `src/main-routes.ts:967-969`)
- Analytics service: `artifacts/api-server/src/services/analytics-service.ts` (session insert :109-146; pageview :159-193; events :203-236; active users :620-761)
- Routes: `artifacts/api-server/src/routes/analytics.ts` (public track endpoints :74-162; admin endpoints :13-71, 195-302; exports :304-366); `src/routes/analytics-public.ts:601-732`
- Schema: `artifacts/discover-barefoot-bay/shared/analytics-schema.ts` (`analytics_sessions` :9-34; `analytics_page_views` :40-63; `analytics_events` :69-89)
- Consent/policy surfaces: `src/pages/auth-page.tsx:1093-1270` (registration checkboxes), `src/pages/generic-content-page.tsx:428-449`, `src/components/layout/footer.tsx:15-26`, `src/pages/unsubscribe-page.tsx:198-280`
- Third parties: `src/components/maps/google-maps-loader.ts:35-56`; `src/components/calendar/static-map-image.tsx:33-56`; `src/components/calendar/direct-map-iframe.tsx:25`; `api-server/src/auth.ts:331-375` (reCAPTCHA verify); `api-server/src/sendgrid-service.ts`; `api-server/src/routes/subscriptions.ts:75-188`; `api-server/src/printful-service.ts:30-42`; `api-server/src/email-service.ts:2-124`
- Sessions/auth: `api-server/src/app.ts:83-107`; logging redaction `api-server/src/lib/logger.ts:1-10`; bot detection `api-server/src/bot-detection.ts`

**Cookies / storage (names only)**
- `connect.sid` — auth session, 30 d, httpOnly, SameSite=Lax, secure in production
- `analytics_session_id` — analytics session, 30 d, httpOnly, SameSite=Lax
- sessionStorage `current_page_view_id` — legacy tracker only

**Database tables (tracking-related)**
- `analytics_sessions` (session_id, user_id, ip, user_agent, browser/device/OS, country/region/city, latitude/longitude, fingerprint, timestamps, duration, is_returning)
- `analytics_page_views` (session_id, user_id, ip, user_agent, path, referrer, page type/category, timestamps, scroll/duration, custom_dimensions JSONB)
- `analytics_events` (session_id, user_id, event type/category/action/label/value, path, event_data JSONB, position_data JSONB, timestamp)
- `session` (express-session store); `users`; `page_contents` (policy text)

**External domains observed in code**
`maps.googleapis.com`, `maps.gstatic.com`, `www.google.com/recaptcha`, `www.google.com/maps/embed`, `connect.squareup.com`, SendGrid API, Printful API, `api.ipify.org` (dormant), `object-storage.replit.app`, OpenWeather API, `googleapis.com` (Gmail/Gemini)

**Environment variable names referenced (values never inspected)**
VITE_GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_API_KEY, VITE_RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_USER_EMAIL, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, APP_BASE_URL, SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_APPLICATION_ID, DATABASE_URL, PRINTFUL_API_KEY, PRINTFUL_STORE_ID, GEMINI_API_KEY, VITE_GEMINI_API_KEY, VITE_OPENWEATHER_API_KEY, STRIPE_SECRET_KEY, SESSION_SECRET, NODE_ENV

**Runtime observations (development environment, 2026-07-31)**
- Policy and Terms text fetched from `/api/pages/privacy-policy` and `/api/pages/terms-and-agreements` (dev DB); quoted excerpts in §8.
- Dev homepage response carried no Set-Cookie (dev routing split between Vite and API server); production behavior flagged for manual verification.

---

*End of report. No production behavior or application code was modified; the only file created is this report.*
