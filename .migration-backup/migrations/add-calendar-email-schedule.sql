CREATE TABLE IF NOT EXISTS "calendar_email_schedule" (
  "id" serial PRIMARY KEY NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "send_time" text NOT NULL DEFAULT '08:00',
  "notify_preference" text NOT NULL DEFAULT 'everyone',
  "custom_event_order" jsonb,
  "attach_image_event_ids" jsonb,
  "last_sent_at" timestamp,
  "updated_at" timestamp DEFAULT now()
);
