DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'calendar_email_schedule_admin_user_id_fkey'
      AND table_name = 'calendar_email_schedule'
  ) THEN
    ALTER TABLE "calendar_email_schedule"
      ADD CONSTRAINT "calendar_email_schedule_admin_user_id_fkey"
      FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END;
$$;
