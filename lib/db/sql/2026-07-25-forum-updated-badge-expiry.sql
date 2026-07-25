-- Auto-expire the 'Updated' badge on forum stories.
-- Idempotent DDL — applied to dev on 2026-07-25 via the database skill.
-- Do NOT use drizzle-kit push on this legacy database (see replit.md).
-- On Publish, run this same file against production (environment: "production").

-- Step 1: Add the timestamp column that tracks when the badge was last set
ALTER TABLE forum_posts
  ADD COLUMN IF NOT EXISTS editorially_updated_at TIMESTAMPTZ;

-- Step 2: Backfill any posts already flagged as Updated that have no timestamp.
-- Use updated_at so they get the same 7-day window from their last edit,
-- rather than expiring immediately or persisting forever.
UPDATE forum_posts
SET editorially_updated_at = updated_at
WHERE is_editorially_updated = true
  AND editorially_updated_at IS NULL;
