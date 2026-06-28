---
name: Drizzle push against the legacy DB
description: Why drizzle-kit push is unsafe to run blindly here, and the scoping fix that prevents the rename-table catastrophe.
---

# Drizzle push vs. the legacy database

The dev/prod DB was built outside Drizzle (raw SQL, pre-Replit-migration). `lib/db` only *approximates* it, so they have drifted at every level.

## The rename-table catastrophe (fixed)
`drizzle-kit push` tries to make the DB exactly match the schema. The DB has ~26 tables not modeled in `lib/db` (legacy app tables like `sessions`, `sponsorships`, `media_files`, plus one-time `*_backup_*` / `*_recovery_backup` snapshots) and the schema has tables missing from the DB. Push paired those drops against creates and dropped into an interactive **"rename?"** prompt over dozens of unrelated tables — a wrong answer destroys data.

**Fix:** `drizzle.config.ts` sets `tablesFilter` derived *dynamically* from the schema (`Object.values(schema).filter(is(_, PgTable)).map(getTableName)`). Push then only ever touches schema-owned tables; everything else is invisible. The allowlist auto-grows with the schema, so it never goes stale. **Do not remove `tablesFilter`, and do not hardcode it.**

## Why push still must NOT be run blindly / `--force`
Even scoped, push wants destructive legacy reconciliation that is NOT a real schema change:
- DROP populated columns the schema doesn't model (e.g. `events.notify_users` ~5.7k rows, `users.is_approved`, `forum_posts.category`, `page_contents.category`, `real_estate_listings.is_approved`).
- TRUNCATE-or-fail prompts on huge tables (`forum_read_states` ~75k, `vendor_page_visits` ~82k) just to rename unique constraints `_key`→`_unique`. Safe answer is always "No, add without truncating".
- Column type coercions and FK renames (`_fkey`→`_id_fk`).

**Why:** the schema is a code-facing *type* model, not a migration source of truth for this DB. The DB can never be fully push-synced without data loss.

## Safe path (the actual workflow)
Apply schema changes with explicit **idempotent SQL** (`CREATE TABLE/INDEX IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`) via the `database` skill — dev and (on Publish) prod. Use `npx drizzle-kit push --verbose --strict` only to *preview* the diff, then answer the final confirm **No**.

## Gotcha: FK names >63 chars
Postgres truncates identifiers to 63 chars. Drizzle's generated FK name `analytics_segment_filters_segment_id_analytics_user_segments_id_fk` (65) truncates to 63 (loses `_fk`), so push perpetually shows a benign "drop+re-add" for that FK. No data involved; ignore it.
