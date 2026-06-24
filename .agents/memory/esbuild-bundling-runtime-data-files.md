---
name: esbuild bundling breaks __dirname-relative runtime files (+ swallowed __esm init)
description: Why packages like geoip-lite must be externalized in api-server/build.mjs, and how a swallowed lazy-init throw silently poisons a singleton.
---

# esbuild bundling + `__dirname`-relative data files

The api-server runs an esbuild CJS/ESM bundle (`artifacts/api-server/build.mjs` → `dist/index.mjs`), NOT tsx. Any dependency that reads sibling data files at **require time** using a `__dirname`-relative path breaks when bundled: esbuild rebases `__dirname` to `dist/`, so the package looks for its data next to the bundle and throws `ENOENT`.

**Rule:** such packages must be added to the `external` array in `build.mjs` so they are `require`d from `node_modules` at runtime with the correct `__dirname` (the banner already sets `globalThis.require`). Known case: `geoip-lite` (ships `data/*.dat`, loaded synchronously at require time). Symptom was `ENOENT ... data/geoip-country.dat`.

**Why it was hard to find:** the throw happened during esbuild's lazy `__esm` init of `src/services/analytics-service.ts`. esbuild's `__esm` marks an init "done" the first time it runs **even if the body throws**. The first trigger was `app.ts`'s dynamic `import("./analytics-service")` wrapped in a `try/catch` that swallowed the error with only a generic warning. So the singleton (`analyticsService`) was left permanently `undefined`, and every later caller (the routes) got the cached no-op init — producing a misleading `Cannot read properties of undefined (reading 'endSession')` at the route call site instead of the real ENOENT.

**How to apply:**
- New analytics 500s / "X is undefined" right after boot → check for a swallowed init. Temporarily log the actual error object in such catch blocks (`logger.warn({ err: e }, ...)`); the api-server analytics catch in `app.ts` now does this.
- If a newly added dependency loads data/native files via path traversal, externalize it in `build.mjs` rather than letting esbuild bundle it.

# Ambiguous dual `export *` → silently `undefined`

`lib/db/src/schema/index.ts` does `export * from "./schema"` AND `export * from "./analytics-schema"`. A name exported by **both** star sources is ambiguous in ESM and resolves to `undefined` for consumers importing it from `@workspace/db` (no hard error, just undefined). This previously happened because `schema.ts` re-exported analytics tables that `analytics-schema.ts` already defines.

**Rule:** never re-export a symbol from one barrel-included module that another barrel-included module already exports. Keep each schema symbol single-sourced. `schema.ts` may still *import* analytics tables for its own use (e.g. `createInsertSchema`), it just must not re-`export` them.
