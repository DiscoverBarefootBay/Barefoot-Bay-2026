-- Task #366: honor schedule changes + admin activity log for the weekly
-- "Currently, On The Market" email.
-- Idempotent DDL — apply manually via the database skill (applied to dev on 2026-08-01).
-- Do NOT use drizzle-kit push on this legacy database (see replit.md).
-- On Publish, run this same file against production (environment: "production").

-- Schedule in effect when a campaign was claimed ("<sendDay>@<HH:mm>").
-- NULL (legacy rows) is treated as blocking by the overlap rule.
ALTER TABLE weekly_listings_email_sends
  ADD COLUMN IF NOT EXISTS schedule_key text;

CREATE TABLE IF NOT EXISTS weekly_listings_email_activity (
  id serial PRIMARY KEY,
  event text NOT NULL,
  week_start text,
  week_end text,
  detail text,
  actor text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_listings_email_activity_created_at_idx
  ON weekly_listings_email_activity (created_at DESC);

-- Durable once-per-week dedupe for the scheduler's repeating skip events
-- (the tick runs every minute; ON CONFLICT DO NOTHING collapses repeats even
-- across restarts or concurrent processes).
CREATE UNIQUE INDEX IF NOT EXISTS weekly_listings_email_activity_dedupe_idx
  ON weekly_listings_email_activity (event, week_start)
  WHERE event IN ('skipped_window_missed', 'skipped_already_sent');
