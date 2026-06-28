# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Discover Barefoot Bay (`artifacts/discover-barefoot-bay`)
- **Kind**: web (React + Vite)
- **Preview path**: `/`
- **Port**: `$PORT` (workflow-assigned)
- **Description**: Community hub for Barefoot Bay residents. Events, clubs, vendors, forum, for-sale listings, news, and more.
- **Shared aliases**: `@shared` → `artifacts/discover-barefoot-bay/shared/` (schema types, analytics-schema, vendor-url-utils)
- **Key files**: `src/App.tsx`, `src/pages/`, `src/components/`, `src/lib/`, `vite.config.ts`

### API Server (`artifacts/api-server`)
- **Kind**: api (Express 5 + Node.js)
- **Preview path**: `/api`
- **Port**: 8080 (fixed in artifact.toml)
- **Description**: Backend for Discover Barefoot Bay. Handles all data, auth, storage proxy, feature flags, events, forum, vendors, real estate, messaging, analytics, payments (Square), and email (SendGrid).
- **Key files**: `src/index.ts`, `src/app.ts`, `src/main-routes.ts`, `src/storage.ts`, `src/auth.ts`
- **Build**: esbuild via `build.mjs` → `dist/index.mjs`

### Shared Library (`lib/db`)
- **Package**: `@workspace/db`
- **Description**: Drizzle ORM schema, types, and shared enums used by the API server. Selectively exports tables to avoid duplicate `messages` table conflicts.
- **Key files**: `src/schema/schema.ts`, `src/schema/analytics-schema.ts`, `src/schema/index.ts`

### Onboarding Walkthrough (`artifacts/bb-walkthrough`)
- **Kind**: slides (React + Vite + Tailwind)
- **Preview path**: `/bb-walkthrough/`
- **Port**: 23070
- **Description**: 13-slide onboarding walkthrough for new Barefoot Bay residents. Covers all app tabs: Calendar, Forum, Clubs, For Sale, Vendors, Community Info, Real Estate, Messages, Store, and Getting Started tips.
- **Brand**: Ocean #90C9D4, Coral #E15A4F, Navy #434054, Charcoal #27272A. Fonts: Anchorage (display), Nunito (body).
- **Key files**: `src/pages/slides/` (13 slide components), `src/data/slides-manifest.json`, `src/index.css`, `index.html`
- **Assets**: `public/DiscoverBFBText.png` (brand logo text, copied from main app), `public/logo.png`, `public/fonts/Anchorage-Regular.woff2`
- **Note**: There is also a duplicate `artifacts/barefoot-bay-walkthrough` artifact (same content, port 6800) that was the original attempt; cleanup is tracked separately.
- **Workflow port detection**: `kind = "slides"` artifacts route through the same workflow port-detection probe as `kind = "web"`. The probe hits the artifact's base path (`/bb-walkthrough/`) and expects a 2xx within the timeout. The Vite config registers a `health-check` middleware that short-circuits requests to `/` and `/__health` with `200 "ok"` before Vite's HTML transform runs — keep that middleware in place. Earlier DIDNT_OPEN_A_PORT failures were a transient first-boot symptom; a clean `restart_workflow` (which kills any half-bound previous Vite process holding port 23070) reliably starts the workflow now. If it ever recurs, restart the workflow rather than changing the artifact kind.

## Important Notes

### Express 5 Compatibility
- Optional route params (`:id?`) must use `{id}` syntax instead
- Wildcard routes (`/*filename`) return `req.params.filename` as an **array** — always normalize: `Array.isArray(p) ? p.join('/') : p`
- `app.use()` only accepts middleware functions — guard optional middleware with `typeof fn === 'function'`

### Object Storage
- `@replit/object-storage` Client auto-calls `init()` in its constructor (fire-and-forget async)
- Without a bucket configured, this throws an unhandled rejection that crashes Node
- Fixed by a global `process.on('unhandledRejection', ...)` guard in `src/index.ts` that catches bucket-related errors and logs a warning instead of crashing
- All Object Storage features degrade gracefully when no bucket is provisioned
- **Bucket binding (`A bucket name is needed to use Cloud Storage`)**: the SDK's default `new Client()` calls a Replit sidecar at `http://127.0.0.1:1106/object-storage/default-bucket` to discover the bucket. In some environments that endpoint returns `{"bucketId":""}`, so `gcsClient.bucket("")` throws and every storage request 500s. Fix: always construct the client via `createObjectStorageClient()` from `src/lib/object-storage-client.ts`, which resolves the bucket ID explicitly — first from `REPLIT_OBJECTSTORE_URL` (the original/legacy bucket where existing images live), then from `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, then falls back to the SDK default. Do **not** call `new Client()` directly anywhere in the API server.

### Analytics Middleware
- The analytics middleware (`src/analytics-service.ts`) is loaded dynamically with try/catch in `app.ts`
- A static import of `analyticsMiddleware` also exists in `main-routes.ts` — guarded with `typeof fn === 'function'`
- Both paths fail gracefully when analytics DB tables aren't available

### Frontend Schema (`artifacts/discover-barefoot-bay/shared/`)
- `schema.ts` — frontend-safe copy of the Drizzle schema (no server-only imports)
- `analytics-schema.ts` — analytics types without the `users` table reference (avoids circular dep)
- `vendor-url-utils.ts` — URL normalization utilities
- `TrackPageViewOptions` and similar TS interfaces must be re-exported with `export type { ... }` (not `export { ... }`) to avoid runtime "no export named X" errors in Vite

### Vite HMR on Replit (Discover Barefoot Bay)
- `vite.config.ts` pins HMR to `wss://$REPLIT_DEV_DOMAIN:443` so the HMR WebSocket goes through Replit's HTTPS proxy. Without this, mobile webviews (Replit mobile app) would drop the WebSocket when the user switched tabs, Vite would fall back to full page reloads, and the preview would reload endlessly.
- Falls back to Vite auto-detect when `REPLIT_DEV_DOMAIN` is unset (e.g. local dev outside Replit).
- Set `DISABLE_HMR=true` as an escape hatch — preview stops live-updating but won't reload-loop.
- Do not remove the `hmr: hmrConfig` line from the `server` block.
- The three Replit dev plugins (`@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`) are disabled by default. Each one opens its own WebSocket/polling connection or surfaces a full-screen overlay that, on top of the HMR fix above, was still causing endless reload loops on the Replit mobile app when the user switched tabs. The other artifacts (slides, mockup-sandbox) don't load them and don't have the bug. Set `REPLIT_DEV_PLUGINS=true` to re-enable them for desktop debugging. The hand-written `benignErrorFilterShim` plugin is kept — it only adds a head script and doesn't open any connections.
- Helmet `<title>` children must be plain strings, not template-literal expressions or arrays of children. When the runtime error modal was enabled, Helmet's "expects a string as a child of `<title>`" warning was being surfaced as a full-screen overlay and contributed to the mobile reload loop. Pre-compute the title string outside JSX (see `event-detail-page.tsx`).

### Zod / drizzle-zod
- `drizzle-zod` `.omit({ isApproved: true })` fails — `isApproved` is not a column in certain tables; removed from omit lists in both `lib/db/src/schema/schema.ts` and `artifacts/discover-barefoot-bay/shared/schema.ts`

### SendGrid (email)
- **Credentials**: resolved at runtime via `getSendGridApiKey()` / `getSendGridCredentials()` in `artifacts/api-server/src/lib/sendgrid-credentials.ts`. It first tries the native Replit **SendGrid connector** (fetches `api_key`/`from_email` from the Replit connector proxy using `REPLIT_CONNECTORS_HOSTNAME` + the `REPL_IDENTITY`/`WEB_REPL_RENEWAL` token), then falls back to the `SENDGRID_API_KEY` env var. Never cache the result (connector keys rotate). Do **not** read `SENDGRID_API_KEY` directly or call `sgMail.setApiKey` at module load — set it per send / fetch.
- Both `sendgrid-service.ts` (sending) and `sendgrid-activity-service.ts` (stats/billing) use the helper.
- **Billing panel config** (admin Email Activity → Billing tab): SendGrid has no public plan/subscription/invoice API, so plan metadata is admin-editable from the Billing tab (Edit button) and persisted in the `site_settings` store under the `sendgrid_billing_config` key (JSON of `{ planName, planPrice, currency, monthlyLimit, addOns }`). Saved values override the env-var defaults; `getBillingStats(override?)` merges saved override → env var → hardcoded default per field. The save endpoint is `PUT /api/admin/email-activity/billing/config` (admin-only). Env-var defaults remain as the fallback when nothing is saved:
  - `SENDGRID_PLAN_NAME` (default `Essentials 50K`)
  - `SENDGRID_MONTHLY_LIMIT` (default `50000`)
  - `SENDGRID_PLAN_PRICE` (default `19.95`)
  - `SENDGRID_CURRENCY` (default `USD`)
  - `SENDGRID_ADDONS` — JSON array of `{ name, price }`, default `[{"name":"Extended Email Activity History","price":5}]`
  - Estimated next invoice = plan price + sum of add-on prices (default $24.95). Live usage (sent/delivered/opens/etc.) still comes from the SendGrid Stats API. Marketing Campaigns is intentionally excluded.

### Shipping frontend fixes to production (avoiding stale bundles)
- **There is no auto-deploy on merge.** Merging a frontend fix into `main` does NOT update the live site — production keeps serving the previously-published bundle until someone clicks **Publish** again. This is the root cause of the admin Analytics charts showing the fallback in production while a current build renders them fine: the live bundle predated the chart fix.
- **How to confirm a stale production bundle:** the web artifact builds to a single, content-hashed entry (`dist/public/assets/index-<hash>.js`, no manual chunking — the admin Analytics dashboard is in the main bundle). Compare hashes: `curl -s https://barefootbay.com/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'` vs a fresh `PORT=22973 BASE_PATH=/ pnpm --filter @workspace/discover-barefoot-bay run build` then `ls artifacts/discover-barefoot-bay/dist/public/assets/index-*.js`. Different hashes = production is stale. You can also grep the downloaded prod bundle for a fix's unique string literal (e.g. `contained by ChartErrorBoundary` for the Task #229 chart error-boundary fix) — string literals survive minification.
- **The redeploy step:** publishing happens from the **main app via the Publish button** (a task agent cannot trigger it). The production build command (`pnpm --filter @workspace/discover-barefoot-bay run build`, see `artifacts/discover-barefoot-bay/.replit-artifact/artifact.toml`) is correct and produces a fresh hashed bundle every publish — no build-cache bug. So whenever a frontend/chart fix merges to `main`, **republish** to ship it; otherwise the live site stays on the old bundle.
