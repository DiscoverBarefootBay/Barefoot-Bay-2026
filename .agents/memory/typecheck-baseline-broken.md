---
name: Typecheck baseline is broken
description: api-server and web artifact typechecks fail with ~1,500 pre-existing errors; use runtime verification instead.
---

`pnpm --filter @workspace/api-server run typecheck` fails with ~1,500 errors across ~96 files (square-client, printful, messages, storage.ts, main-routes.ts, etc.), and the web artifact typecheck also fails with many pre-existing errors (e.g. forum-post-page's `useQuery` inference is broken at a pre-existing line, cascading TS2339 errors to every property access in the file).

**Why:** Legacy codebase migrated in without strict-mode cleanup; typecheck was never green.

**How to apply:** Don't treat typecheck failures as regressions unless the error is clearly new logic in your changed lines. Verify changes at runtime instead: restart the workflows, curl endpoints via `localhost:80/api/...`, and screenshot pages. To scope-check your own edits, grep the typecheck output for your changed files and compare error patterns against neighboring pre-existing ones.
