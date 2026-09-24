-- DMCA uploader notices, counter-notices and automation (idempotent).
-- Apply to dev with psql "$DATABASE_URL" -f, and to prod at Publish.

CREATE TABLE IF NOT EXISTS dmca_admin_alerts (
  id SERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  dmca_case_id INTEGER REFERENCES dmca_cases(id),
  user_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS dmca_admin_alerts_dedupe_uniq ON dmca_admin_alerts (dedupe_key);
CREATE INDEX IF NOT EXISTS dmca_admin_alerts_open_idx ON dmca_admin_alerts (created_at DESC) WHERE acknowledged_at IS NULL;

CREATE TABLE IF NOT EXISTS dmca_repeat_infringer_reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  strike_count INTEGER NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by INTEGER REFERENCES users(id),
  decision TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS dmca_repeat_infringer_reviews_one_open
  ON dmca_repeat_infringer_reviews (user_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS dmca_repeat_infringer_reviews_user_idx
  ON dmca_repeat_infringer_reviews (user_id, opened_at DESC);

-- A target generates one informational event and one counting takedown event.
CREATE UNIQUE INDEX IF NOT EXISTS user_copyright_events_notice_target_uniq
  ON user_copyright_events (dmca_target_id, event_type)
  WHERE dmca_target_id IS NOT NULL AND event_type = 'notice_received';
