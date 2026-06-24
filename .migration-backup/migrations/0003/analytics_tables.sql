-- Migration 0003: Create analytics tables

-- Analytics Sessions Table
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  start_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  end_timestamp TIMESTAMP,
  duration INTEGER,
  browser TEXT,
  os TEXT,
  device TEXT,
  ip_address TEXT
);

-- Analytics Page Views Table
CREATE TABLE IF NOT EXISTS analytics_page_views (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_sessions(id),
  user_id INTEGER REFERENCES users(id),
  path TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  exit_timestamp TIMESTAMP,
  duration INTEGER,
  referrer TEXT,
  browser TEXT,
  os TEXT,
  device TEXT,
  ip_address TEXT
);

-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_sessions(id),
  user_id INTEGER REFERENCES users(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  path TEXT NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_id ON analytics_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_session_id ON analytics_page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_user_id ON analytics_page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_page_views_path ON analytics_page_views(path);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);