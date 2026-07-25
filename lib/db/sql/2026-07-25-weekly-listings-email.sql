-- Task #270: weekly "Currently, On The Market" promo email.
-- Idempotent DDL — apply manually via the database skill (applied to dev on 2026-07-25).
-- Do NOT use drizzle-kit push on this legacy database (see replit.md).
-- On Publish, run this same file against production (environment: "production").

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marketing_emails_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS weekly_listings_email_sends (
  id serial PRIMARY KEY,
  week_start text NOT NULL,
  week_end text NOT NULL,
  status text NOT NULL DEFAULT 'sending',
  triggered_by text NOT NULL DEFAULT 'scheduler',
  listing_count integer NOT NULL DEFAULT 0,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  error text,
  sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT weekly_listings_email_sends_week_start_unique UNIQUE (week_start)
);

-- Task #305: record which admin triggered a manual campaign send.
ALTER TABLE weekly_listings_email_sends
  ADD COLUMN IF NOT EXISTS triggered_by_user text;
