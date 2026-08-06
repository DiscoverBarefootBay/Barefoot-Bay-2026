-- Featured Listing credit upgrade (idempotent).
-- Adds the featured flag + timestamp to real_estate_listings.
-- Legacy DB: apply with plain SQL (never drizzle-kit push).
-- MUST also be run against the PRODUCTION database at Publish.

ALTER TABLE real_estate_listings
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

ALTER TABLE real_estate_listings
  ADD COLUMN IF NOT EXISTS featured_at timestamp;
