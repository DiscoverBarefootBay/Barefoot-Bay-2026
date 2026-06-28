---
name: Vite dev-server port conflict after task merges
description: Why a web/slides artifact "crashes" right after multiple task merges, and the fix
---

# Vite "Port already in use" crash after merges

A web/slides artifact's dev workflow can flip to FAILED with
`Error: Port <NNNN> is already in use` right after several task merges land.

**Why:** merges/post-merge installs change the pnpm lockfile. Vite detects the
changed lockfile, re-optimizes deps, and tries to relaunch — but the previous
Vite process is still bound to the artifact's fixed dev port, so the new process
can't bind and the workflow crashes. The browser may still show the app for a
while (served by the stale process), which masks the failure; logs in the
*workflow* (not the browser console) are where the real error shows.

**How to apply:** When a user reports an artifact "crashed with a runtime error"
but browser console + rendered pages look fine, check the WORKFLOW logs for the
port-in-use error. Fix = `restart_workflow` on that artifact's workflow — it
kills the half-bound process and rebinds cleanly. No code change needed. If
multiple artifacts share the same boot, several can fail at once (each on its
own port); restart each one the user cares about.
