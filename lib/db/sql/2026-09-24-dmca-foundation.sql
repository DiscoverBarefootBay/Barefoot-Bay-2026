-- DMCA / copyright-case foundation (idempotent).
-- Legacy DB: apply with plain SQL (never drizzle-kit push).
-- MUST also be run against the PRODUCTION database at Publish.
--
-- 1. Common visibility model on every user-generated content table.
-- 2. DMCA case / target / submission / audit tables.
-- 3. Legal holds, repeat-infringer events, DMCA permission grants,
--    DMCA settings, quarantined object registry, notification outbox.
-- 4. Append-only enforcement (triggers) on submissions + audit log.
-- 5. Rollout grant: every existing site admin receives the Legal Admin bundle.

-- ---------------------------------------------------------------------------
-- 1. Visibility columns on UGC tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'forum_posts', 'forum_comments', 'real_estate_listings', 'events',
    'event_comments', 'page_contents', 'vendor_comments'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS visibility_status text NOT NULL DEFAULT ''published''', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS hidden_at timestamp', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS hidden_by_admin_id integer', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS hidden_reason text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS dmca_case_id integer', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS restored_at timestamp', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS restored_by_admin_id integer', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at timestamp', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (visibility_status) WHERE visibility_status <> ''published''', t || '_visibility_hidden_idx', t);
  END LOOP;
END $$;

-- Account + private-message deletion guards
ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. DMCA cases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dmca_case_counters (
  year integer PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dmca_cases (
  id serial PRIMARY KEY,
  case_number text NOT NULL UNIQUE,
  case_type text NOT NULL DEFAULT 'notice',
  status text NOT NULL DEFAULT 'RECEIVED',
  received_at timestamp NOT NULL DEFAULT now(),
  submitted_via text NOT NULL DEFAULT 'web_form',
  claimant_name text,
  claimant_company text,
  claimant_email text,
  claimant_phone text,
  claimant_address text,
  claimant_role text,
  copyright_owner_name text,
  work_description text,
  admin_assigned_id integer,
  validity_status text NOT NULL DEFAULT 'unchecked',
  completeness jsonb,
  status_token text UNIQUE,
  legal_hold boolean NOT NULL DEFAULT false,
  takedown_at timestamp,
  uploader_notified_at timestamp,
  counter_notice_received_at timestamp,
  counter_reviewed_at timestamp,
  claimant_counter_notified_at timestamp,
  restore_eligible_at timestamp,
  restore_deadline_at timestamp,
  restored_at timestamp,
  court_action_received_at timestamp,
  closed_at timestamp,
  closed_reason text,
  internal_notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dmca_cases_status_idx ON dmca_cases (status);

CREATE TABLE IF NOT EXISTS dmca_targets (
  id serial PRIMARY KEY,
  dmca_case_id integer NOT NULL REFERENCES dmca_cases(id),
  content_type text NOT NULL,
  content_id integer,
  original_url text,
  uploader_user_id integer,
  status text NOT NULL DEFAULT 'pending',
  original_state jsonb,
  storage_objects jsonb,
  taken_down_at timestamp,
  restored_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dmca_targets_case_idx ON dmca_targets (dmca_case_id);
CREATE INDEX IF NOT EXISTS dmca_targets_content_idx ON dmca_targets (content_type, content_id);

CREATE TABLE IF NOT EXISTS dmca_submissions (
  id serial PRIMARY KEY,
  dmca_case_id integer NOT NULL REFERENCES dmca_cases(id),
  submission_type text NOT NULL,
  submitted_by_user_id integer,
  submitted_by_name text,
  received_at timestamp NOT NULL DEFAULT now(),
  form_payload jsonb NOT NULL,
  original_document_path text,
  email_message_id text,
  signature_value text,
  ip_address text,
  user_agent text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dmca_submissions_case_idx ON dmca_submissions (dmca_case_id);

CREATE TABLE IF NOT EXISTS dmca_audit_log (
  id serial PRIMARY KEY,
  dmca_case_id integer,
  event text NOT NULL,
  actor_type text NOT NULL,
  actor_id integer,
  target_type text,
  target_id integer,
  ip_address text,
  previous_value jsonb,
  new_value jsonb,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dmca_audit_log_case_idx ON dmca_audit_log (dmca_case_id);
CREATE INDEX IF NOT EXISTS dmca_audit_log_created_idx ON dmca_audit_log (created_at);

-- ---------------------------------------------------------------------------
-- 3. Legal holds, copyright events, permissions, settings, quarantine, outbox
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legal_holds (
  id serial PRIMARY KEY,
  case_type text,
  case_id integer,
  content_type text,
  content_id integer,
  user_id integer,
  reason text NOT NULL,
  placed_by integer,
  placed_at timestamp NOT NULL DEFAULT now(),
  released_by integer,
  released_at timestamp,
  release_reason text
);
CREATE INDEX IF NOT EXISTS legal_holds_active_content_idx ON legal_holds (content_type, content_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS legal_holds_active_user_idx ON legal_holds (user_id) WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS user_copyright_events (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  dmca_case_id integer,
  dmca_target_id integer,
  event_type text NOT NULL,
  event_date timestamp NOT NULL DEFAULT now(),
  counts_toward_repeat_policy boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by integer,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_copyright_events_user_idx ON user_copyright_events (user_id);

CREATE TABLE IF NOT EXISTS dmca_permission_grants (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  permission text NOT NULL,
  granted_by integer,
  granted_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT dmca_permission_grants_user_permission_unique UNIQUE (user_id, permission)
);

CREATE TABLE IF NOT EXISTS dmca_settings (
  id integer PRIMARY KEY DEFAULT 1,
  agent_name text,
  agent_organization text,
  agent_address text,
  agent_phone text,
  agent_email text,
  registration_number text,
  registration_expires_at timestamp,
  repeat_infringer_threshold integer NOT NULL DEFAULT 3,
  repeat_infringer_window_months integer NOT NULL DEFAULT 36,
  reminder_offsets jsonb NOT NULL DEFAULT '{"restoreReminderBusinessDay":8,"restoreEligibleBusinessDay":10,"restoreEscalationBusinessDay":12,"restoreDeadlineBusinessDay":14,"untouchedNoticeHours":48,"agentRenewalReminderDays":[90,30,7]}'::jsonb,
  policy_sections jsonb,
  updated_by integer,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT dmca_settings_singleton CHECK (id = 1)
);
INSERT INTO dmca_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS dmca_quarantined_objects (
  id serial PRIMARY KEY,
  dmca_case_id integer NOT NULL,
  dmca_target_id integer NOT NULL,
  original_url text NOT NULL,
  file_basename text NOT NULL,
  storage_location text NOT NULL DEFAULT 'none',
  original_key text,
  quarantine_key text,
  status text NOT NULL DEFAULT 'quarantined',
  quarantined_at timestamp NOT NULL DEFAULT now(),
  restored_at timestamp
);
CREATE INDEX IF NOT EXISTS dmca_quarantined_objects_active_idx ON dmca_quarantined_objects (file_basename) WHERE status = 'quarantined';

CREATE TABLE IF NOT EXISTS notification_outbox (
  id serial PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dmca_case_id integer,
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 8,
  next_attempt_at timestamp NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamp NOT NULL DEFAULT now(),
  sent_at timestamp
);
CREATE INDEX IF NOT EXISTS notification_outbox_due_idx ON notification_outbox (next_attempt_at) WHERE status IN ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- 4. Append-only enforcement. Only a session that explicitly sets
--    dmca.allow_purge = 'on' (used by automated test cleanup) may modify.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dmca_block_mutation() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('dmca.allow_purge', true), '') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is append-only; % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dmca_submissions_append_only ON dmca_submissions;
CREATE TRIGGER dmca_submissions_append_only
  BEFORE UPDATE OR DELETE ON dmca_submissions
  FOR EACH ROW EXECUTE FUNCTION dmca_block_mutation();

DROP TRIGGER IF EXISTS dmca_audit_log_append_only ON dmca_audit_log;
CREATE TRIGGER dmca_audit_log_append_only
  BEFORE UPDATE OR DELETE ON dmca_audit_log
  FOR EACH ROW EXECUTE FUNCTION dmca_block_mutation();

-- ---------------------------------------------------------------------------
-- 5. Rollout: existing site admins get the Legal Admin bundle so nobody is
--    locked out of the new DMCA area. Idempotent via the unique constraint.
-- ---------------------------------------------------------------------------
INSERT INTO dmca_permission_grants (user_id, permission)
SELECT u.id, p.permission
FROM users u
CROSS JOIN (VALUES
  ('dmca.flag'), ('dmca.view'), ('dmca.create'), ('dmca.review'), ('dmca.takedown'),
  ('dmca.restore'), ('dmca.manage_holds'), ('dmca.manage_repeat_infringer'),
  ('dmca.view_private_files'), ('dmca.permanent_delete'), ('dmca.manage_permissions')
) AS p(permission)
WHERE u.role = 'admin'
ON CONFLICT (user_id, permission) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Legal-hold / DMCA-takedown delete backstop. The API server checks holds before every
--    permanent-delete path and answers 423; these triggers guarantee that no
--    path (raw SQL, FK ON DELETE CASCADE from a user/post/event delete, a
--    future route) can destroy a held row. Row triggers fire for cascaded
--    deletes too, so the whole statement aborts. There is deliberately NO
--    bypass: a hold must be released (audited) first.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION legal_hold_block_delete() RETURNS trigger AS $$
BEGIN
  -- A DMCA takedown is reversible evidence: dmca_hidden rows are protected
  -- exactly like held rows (to_jsonb works for tables without the column).
  IF OLD.legal_hold IS TRUE OR (to_jsonb(OLD) ->> 'visibility_status') = 'dmca_hidden' THEN
    RAISE EXCEPTION 'LEGAL_HOLD: % row % is under legal hold or an active DMCA takedown and cannot be permanently deleted', TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'BBLH1';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['forum_posts','forum_comments','real_estate_listings','events','event_comments',
                           'page_contents','vendor_comments','users','messages']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_legal_hold_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete()',
                   t || '_legal_hold_no_delete', t);
  END LOOP;
END $$;
