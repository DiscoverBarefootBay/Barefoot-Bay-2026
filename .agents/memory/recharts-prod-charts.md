---
name: Recharts charts in minified production builds
description: Why recharts charts work in minified prod despite React 19, and how to repro a prod-only render bug through the Replit proxy
---

# Recharts is NOT broken by minification name-mangling

Recharts built-in components identify each other by **static `displayName` string
literals** (e.g. `_defineProperty(Area, "displayName", 'Area')` in
`recharts/lib/.../Area.js`; child filtering in `recharts/lib/util/ReactUtils.js`
reads `type.displayName || type.name`). String literals survive esbuild/terser
minification, so `AreaChart` + `<defs>`/`linearGradient` and vertical `BarChart`
render real data correctly in a current minified prod build with React 19 +
recharts 2.15.x.

**Why:** A previous task suspected a "recharts v2 + React 19 minification" crash
and added a localized error boundary defensively, but never reproduced it. It was
ruled out: a minified bundle of the exact charts renders fine in a real browser.
Do NOT add `esbuild.keepNames` for recharts — it's unnecessary bloat.

**How to apply:** If admin Analytics charts show the "couldn't be displayed"
fallback in prod, suspect a *stale deployed bundle* or a *transient mount-time
throw that latches the error boundary*, not an inherent recharts/minification
incompatibility. Error boundaries should carry `resetKeys` so a one-off failure
doesn't pin the fallback forever.

# Reproducing a prod-only (minified) client render through the Replit proxy

The preview proxy only serves the artifact's dev workflow port; a separate
`vite preview` fights the workflow supervisor on the strict port and dies. SSR
(`renderToString`) does not exercise the client-only ResponsiveContainer path.
Working recipe: build a minified standalone entry, then drop the built
`html`+`assets` into the artifact's `public/<name>/` dir (Vite serves publicDir
files **verbatim, untransformed**), and screenshot `/<name>/...` via the proxy —
the running dev workflow stays healthy. Build to a temp dir and copy only
html+assets; never set `--outDir` inside `public/` (Vite copies all of publicDir
into outDir). Clean up the public files afterward.
