-- Add geolocation fields to the analytics_sessions table
ALTER TABLE analytics_sessions 
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);