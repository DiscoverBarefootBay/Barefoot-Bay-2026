ALTER TABLE "calendar_email_schedule" ADD COLUMN IF NOT EXISTS "admin_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;
