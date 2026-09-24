---
name: DMCA foundation decisions
description: Durable evidence-preservation and quarantine rules for DMCA work — read before touching delete paths, public loaders, or file storage moves.
---
- A takedown is a reversible visibility change, never a delete, and a dmca_hidden item is protected from permanent deletion exactly like a legal hold (app guards AND the DB delete trigger, including cascades and account deletion). Only one active takedown per item.
  **Why:** owner stated every legal point is mandatory; takedown content is evidence and must be restorable to the exact original URL.
  **How to apply:** any new delete path, cleanup job, or test cleanup must respect this — republish/release first; never add a trigger bypass.
- Physical quarantine must be verified BEFORE a takedown commits (files leave their public keys so direct storage URLs die too); a failed move aborts the takedown, and file moves are compensated whenever the surrounding DB transaction fails (takedown and restore). Bytes must always match committed DB state.
- Every new public surface (route, email, OG, sitemap, scheduler, auto-delete job) must go through the central visibility policy; duplicate slug rows exist (e.g. banner-slides), so hide/filter by slug-returned row, not by an assumed single id.
- Drizzle's `sql` template does NOT turn a JS array into a PG array (`ANY(${arr}::int[])` → 22P02); use an ARRAY[...] builder.
- Schema ships as idempotent SQL in lib/db/sql and must be applied to the prod DB at Publish.
