-- Content-free development schema. No records, sequence counters, owners or grants.

-- Restore only into a NEW, EMPTY database; do not run against the live site.

CREATE SCHEMA IF NOT EXISTS public;
SET search_path = public, pg_catalog;
SET check_function_bodies = false;

CREATE SEQUENCE public."analytics_events_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."analytics_page_views_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."analytics_sessions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."calendar_email_schedule_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."chat_messages_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."comment_subscriptions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."community_categories_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."content_versions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."credit_transactions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."custom_forms_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."dmca_admin_alerts_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."dmca_audit_log_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."dmca_cases_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."dmca_content_flags_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."dmca_permission_grants_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."dmca_quarantined_objects_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."dmca_repeat_infringer_reviews_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."dmca_submissions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."dmca_targets_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."event_comments_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."event_interactions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."events_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."feature_flags_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."for_sale_visits_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."form_submissions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."forum_categories_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."forum_comments_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."forum_description_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."forum_likes_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."forum_posts_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."forum_reactions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."forum_read_states_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."forum_subscriptions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."legal_holds_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."legal_policy_acceptances_id_seq" AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."legal_policy_versions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."listing_payments_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."media_files_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."message_recipients_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."messages_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."migration_records_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."notification_log_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."notification_outbox_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."notification_queue_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."order_items_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."orders_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."page_content_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."page_contents_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."page_views_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."product_categories_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."products_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."real_estate_listings_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."sessions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."site_settings_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."sponsorships_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."square_payments_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."storeVisits_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."store_settings_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."store_visits_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."support_messages_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."user_copyright_events_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."user_credits_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."users_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."vendor_categories_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."vendor_comments_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."vendor_interactions_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."vendor_page_visits_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."vendor_visits_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."weekly_listings_email_activity_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE SEQUENCE public."weekly_listings_email_sends_id_seq" AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE TABLE public."analytics_events" (
  "id" integer DEFAULT nextval('analytics_events_id_seq'::regclass) NOT NULL,
  "user_id" integer,
  "session_id" text NOT NULL,
  "event_type" text NOT NULL,
  "event_data" jsonb,
  "path" text NOT NULL,
  "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
  "category" text,
  "action" text,
  "label" text,
  "value" numeric,
  "position_data" jsonb
);

CREATE TABLE public."analytics_page_views" (
  "id" integer DEFAULT nextval('analytics_page_views_id_seq'::regclass) NOT NULL,
  "user_id" integer,
  "session_id" text NOT NULL,
  "ip" text NOT NULL,
  "user_agent" text NOT NULL,
  "path" text NOT NULL,
  "referrer" text,
  "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
  "duration" integer,
  "exit_timestamp" timestamp without time zone,
  "page_height" integer,
  "max_scroll_depth" integer,
  "max_scroll_percentage" numeric,
  "page_type" text,
  "page_category" text,
  "custom_dimensions" jsonb
);

CREATE TABLE public."analytics_sessions" (
  "id" integer DEFAULT nextval('analytics_sessions_id_seq'::regclass) NOT NULL,
  "session_id" text NOT NULL,
  "user_id" integer,
  "ip" text,
  "user_agent" text,
  "browser" text,
  "os" text,
  "device" text,
  "start_timestamp" timestamp without time zone DEFAULT now() NOT NULL,
  "end_timestamp" timestamp without time zone,
  "duration" integer,
  "pages_viewed" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "country" text,
  "region" text,
  "city" text,
  "latitude" numeric(10,7),
  "longitude" numeric(10,7),
  "visitor_fingerprint" text,
  "is_returning_visitor" boolean DEFAULT false
);

CREATE TABLE public."calendar_email_schedule" (
  "id" integer DEFAULT nextval('calendar_email_schedule_id_seq'::regclass) NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "send_time" text DEFAULT '08:00'::text NOT NULL,
  "notify_preference" text DEFAULT 'everyone'::text NOT NULL,
  "custom_event_order" jsonb,
  "attach_image_event_ids" jsonb,
  "last_sent_at" timestamp without time zone,
  "updated_at" timestamp without time zone DEFAULT now(),
  "admin_user_id" integer,
  "last_run_at" timestamp without time zone,
  "last_run_status" text,
  "last_run_detail" text,
  "last_escalation_at" timestamp without time zone,
  "recent_runs" jsonb,
  "last_watchdog_at" timestamp without time zone,
  "heartbeat_enabled" boolean DEFAULT false NOT NULL,
  "last_heartbeat_at" timestamp without time zone
);

CREATE TABLE public."chat_messages" (
  "id" integer DEFAULT nextval('chat_messages_id_seq'::regclass) NOT NULL,
  "session_id" character varying NOT NULL,
  "role" character varying NOT NULL,
  "content" text NOT NULL,
  "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."chat_sessions" (
  "id" character varying NOT NULL,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "contact_info" jsonb
);

CREATE TABLE public."comment_subscriptions" (
  "id" integer DEFAULT nextval('comment_subscriptions_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "is_subscribed" boolean DEFAULT true NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."community_categories" (
  "id" integer DEFAULT nextval('community_categories_id_seq'::regclass) NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "icon" text,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."content" (
  "slug" character varying(255) NOT NULL,
  "title" character varying(255) NOT NULL,
  "content" text NOT NULL,
  "updated_by" integer,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."content_versions" (
  "id" integer DEFAULT nextval('content_versions_id_seq'::regclass) NOT NULL,
  "content_id" integer NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "media_urls" text[] DEFAULT '{}'::text[],
  "created_by" integer,
  "version_number" integer NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "notes" text DEFAULT ''::text
);

CREATE TABLE public."credit_transactions" (
  "id" integer DEFAULT nextval('credit_transactions_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "transaction_type" text NOT NULL,
  "credits" integer NOT NULL,
  "description" text,
  "square_payment_id" text,
  "order_id" text,
  "checkout_id" text,
  "amount" numeric(10,2),
  "currency" text DEFAULT 'USD'::text,
  "payment_status" text DEFAULT 'pending'::text,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."custom_forms" (
  "id" integer DEFAULT nextval('custom_forms_id_seq'::regclass) NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "form_fields" jsonb NOT NULL,
  "terms_and_conditions" text,
  "requires_terms_acceptance" boolean DEFAULT false,
  "slug" text NOT NULL,
  "page_content_id" integer,
  "created_by" integer,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."dmca_admin_alerts" (
  "id" integer DEFAULT nextval('dmca_admin_alerts_id_seq'::regclass) NOT NULL,
  "alert_type" text NOT NULL,
  "severity" text DEFAULT 'info'::text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "dmca_case_id" integer,
  "user_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "acknowledged_at" timestamp with time zone,
  "acknowledged_by" integer
);

CREATE TABLE public."dmca_audit_log" (
  "id" integer DEFAULT nextval('dmca_audit_log_id_seq'::regclass) NOT NULL,
  "dmca_case_id" integer,
  "event" text NOT NULL,
  "actor_type" text NOT NULL,
  "actor_id" integer,
  "target_type" text,
  "target_id" integer,
  "ip_address" text,
  "previous_value" jsonb,
  "new_value" jsonb,
  "notes" text,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."dmca_case_counters" (
  "year" integer NOT NULL,
  "last_value" integer DEFAULT 0 NOT NULL
);

CREATE TABLE public."dmca_cases" (
  "id" integer DEFAULT nextval('dmca_cases_id_seq'::regclass) NOT NULL,
  "case_number" text NOT NULL,
  "case_type" text DEFAULT 'notice'::text NOT NULL,
  "status" text DEFAULT 'RECEIVED'::text NOT NULL,
  "received_at" timestamp without time zone DEFAULT now() NOT NULL,
  "submitted_via" text DEFAULT 'web_form'::text NOT NULL,
  "claimant_name" text,
  "claimant_company" text,
  "claimant_email" text,
  "claimant_phone" text,
  "claimant_address" text,
  "claimant_role" text,
  "copyright_owner_name" text,
  "work_description" text,
  "admin_assigned_id" integer,
  "validity_status" text DEFAULT 'unchecked'::text NOT NULL,
  "completeness" jsonb,
  "status_token" text,
  "legal_hold" boolean DEFAULT false NOT NULL,
  "takedown_at" timestamp without time zone,
  "uploader_notified_at" timestamp without time zone,
  "counter_notice_received_at" timestamp without time zone,
  "counter_reviewed_at" timestamp without time zone,
  "claimant_counter_notified_at" timestamp without time zone,
  "restore_eligible_at" timestamp without time zone,
  "restore_deadline_at" timestamp without time zone,
  "restored_at" timestamp without time zone,
  "court_action_received_at" timestamp without time zone,
  "closed_at" timestamp without time zone,
  "closed_reason" text,
  "internal_notes" text,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."dmca_content_flags" (
  "id" integer DEFAULT nextval('dmca_content_flags_id_seq'::regclass) NOT NULL,
  "content_type" text NOT NULL,
  "content_id" integer NOT NULL,
  "reason" text NOT NULL,
  "flagged_by" integer NOT NULL,
  "flagged_at" timestamp without time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp without time zone,
  "resolved_by" integer,
  "resolution" text,
  "dmca_case_id" integer
);

CREATE TABLE public."dmca_permission_grants" (
  "id" integer DEFAULT nextval('dmca_permission_grants_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "permission" text NOT NULL,
  "granted_by" integer,
  "granted_at" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."dmca_quarantined_objects" (
  "id" integer DEFAULT nextval('dmca_quarantined_objects_id_seq'::regclass) NOT NULL,
  "dmca_case_id" integer NOT NULL,
  "dmca_target_id" integer NOT NULL,
  "original_url" text NOT NULL,
  "file_basename" text NOT NULL,
  "storage_location" text DEFAULT 'none'::text NOT NULL,
  "original_key" text,
  "quarantine_key" text,
  "status" text DEFAULT 'quarantined'::text NOT NULL,
  "quarantined_at" timestamp without time zone DEFAULT now() NOT NULL,
  "restored_at" timestamp without time zone
);

CREATE TABLE public."dmca_repeat_infringer_reviews" (
  "id" integer DEFAULT nextval('dmca_repeat_infringer_reviews_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "strike_count" integer NOT NULL,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolved_by" integer,
  "decision" text
);

CREATE TABLE public."dmca_settings" (
  "id" integer DEFAULT 1 NOT NULL,
  "agent_name" text,
  "agent_organization" text,
  "agent_address" text,
  "agent_phone" text,
  "agent_email" text,
  "registration_number" text,
  "registration_expires_at" timestamp without time zone,
  "repeat_infringer_threshold" integer DEFAULT 3 NOT NULL,
  "repeat_infringer_window_months" integer DEFAULT 36 NOT NULL,
  "reminder_offsets" jsonb DEFAULT '{"untouchedNoticeHours": 48, "agentRenewalReminderDays": [90, 30, 7], "restoreDeadlineBusinessDay": 14, "restoreEligibleBusinessDay": 10, "restoreReminderBusinessDay": 8, "restoreEscalationBusinessDay": 12}'::jsonb NOT NULL,
  "policy_sections" jsonb,
  "updated_by" integer,
  "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."dmca_submissions" (
  "id" integer DEFAULT nextval('dmca_submissions_id_seq'::regclass) NOT NULL,
  "dmca_case_id" integer NOT NULL,
  "submission_type" text NOT NULL,
  "submitted_by_user_id" integer,
  "submitted_by_name" text,
  "received_at" timestamp without time zone DEFAULT now() NOT NULL,
  "form_payload" jsonb NOT NULL,
  "original_document_path" text,
  "email_message_id" text,
  "signature_value" text,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."dmca_targets" (
  "id" integer DEFAULT nextval('dmca_targets_id_seq'::regclass) NOT NULL,
  "dmca_case_id" integer NOT NULL,
  "content_type" text NOT NULL,
  "content_id" integer,
  "original_url" text,
  "uploader_user_id" integer,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "original_state" jsonb,
  "storage_objects" jsonb,
  "taken_down_at" timestamp without time zone,
  "restored_at" timestamp without time zone,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."event_comments" (
  "id" integer DEFAULT nextval('event_comments_id_seq'::regclass) NOT NULL,
  "event_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "visibility_status" text DEFAULT 'published'::text NOT NULL,
  "legal_hold" boolean DEFAULT false NOT NULL,
  "hidden_at" timestamp without time zone,
  "hidden_by_admin_id" integer,
  "hidden_reason" text,
  "dmca_case_id" integer,
  "restored_at" timestamp without time zone,
  "restored_by_admin_id" integer,
  "deleted_at" timestamp without time zone
);

CREATE TABLE public."event_interactions" (
  "id" integer DEFAULT nextval('event_interactions_id_seq'::regclass) NOT NULL,
  "event_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "interaction_type" text NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."event_slug_overrides" (
  "event_id" integer NOT NULL,
  "slug" text NOT NULL,
  "reason" text,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."events" (
  "id" integer DEFAULT nextval('events_id_seq'::regclass) NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "start_date" timestamp without time zone,
  "end_date" timestamp without time zone,
  "location" text,
  "map_link" text,
  "hours_of_operation" text,
  "category" text NOT NULL,
  "contact_info" jsonb,
  "media_urls" text[],
  "created_by" integer,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "is_recurring" boolean DEFAULT false,
  "recurrence_frequency" character varying(255) DEFAULT NULL::character varying,
  "recurrence_end_date" timestamp without time zone,
  "parent_event_id" integer,
  "badge_required" boolean DEFAULT false,
  "notify_users" text DEFAULT 'none'::text,
  "event_date" date NOT NULL,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "website_url" text,
  "sponsor_tagline" text,
  "sponsor_phone" text,
  "sponsor_website_url" text,
  "sponsor_vendor_page_slug" text,
  "sponsor_is_political_ad" boolean DEFAULT false,
  "sponsor_political_ad_text" text,
  "visibility_status" text DEFAULT 'published'::text NOT NULL,
  "legal_hold" boolean DEFAULT false NOT NULL,
  "hidden_at" timestamp without time zone,
  "hidden_by_admin_id" integer,
  "hidden_reason" text,
  "dmca_case_id" integer,
  "restored_at" timestamp without time zone,
  "restored_by_admin_id" integer,
  "deleted_at" timestamp without time zone
);

CREATE TABLE public."express_sessions" (
  "sid" character varying NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp(6) without time zone NOT NULL
);

CREATE TABLE public."feature_flags" (
  "id" integer DEFAULT nextval('feature_flags_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "display_name" text NOT NULL,
  "enabled_for_roles" text[] DEFAULT '{}'::text[] NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."for_sale_visits" (
  "id" integer DEFAULT nextval('for_sale_visits_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "last_visit_at" timestamp without time zone DEFAULT now() NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."form_submissions" (
  "id" integer DEFAULT nextval('form_submissions_id_seq'::regclass) NOT NULL,
  "form_id" integer NOT NULL,
  "user_id" integer,
  "submitter_email" text,
  "form_data" jsonb NOT NULL,
  "file_uploads" text[],
  "terms_accepted" boolean DEFAULT false,
  "ip_address" text,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."forum_categories" (
  "id" integer DEFAULT nextval('forum_categories_id_seq'::regclass) NOT NULL,
  "name" character varying(255) NOT NULL,
  "description" text,
  "slug" character varying(255) NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "icon" character varying(255),
  "order" integer DEFAULT 0
);

CREATE TABLE public."forum_comments" (
  "id" integer DEFAULT nextval('forum_comments_id_seq'::regclass) NOT NULL,
  "post_id" integer NOT NULL,
  "author_id" integer NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  "media_urls" text[],
  "visibility_status" text DEFAULT 'published'::text NOT NULL,
  "legal_hold" boolean DEFAULT false NOT NULL,
  "hidden_at" timestamp without time zone,
  "hidden_by_admin_id" integer,
  "hidden_reason" text,
  "dmca_case_id" integer,
  "restored_at" timestamp without time zone,
  "restored_by_admin_id" integer,
  "deleted_at" timestamp without time zone
);

CREATE TABLE public."forum_description" (
  "id" integer DEFAULT nextval('forum_description_id_seq'::regclass) NOT NULL,
  "content" text,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_by" integer
);

CREATE TABLE public."forum_likes" (
  "id" integer DEFAULT nextval('forum_likes_id_seq'::regclass) NOT NULL,
  "post_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."forum_posts" (
  "id" integer DEFAULT nextval('forum_posts_id_seq'::regclass) NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "category" text DEFAULT 'general'::text NOT NULL,
  "media_urls" text[],
  "is_pinned" boolean DEFAULT false,
  "is_locked" boolean DEFAULT false,
  "views" integer DEFAULT 0,
  "user_id" integer NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  "category_id" integer,
  "custom_preview" text,
  "notify_preference" text,
  "hide_default_title" boolean DEFAULT false,
  "is_editorially_updated" boolean DEFAULT false,
  "featured_image" text,
  "visibility_status" text DEFAULT 'published'::text NOT NULL,
  "legal_hold" boolean DEFAULT false NOT NULL,
  "hidden_at" timestamp without time zone,
  "hidden_by_admin_id" integer,
  "hidden_reason" text,
  "dmca_case_id" integer,
  "restored_at" timestamp without time zone,
  "restored_by_admin_id" integer,
  "deleted_at" timestamp without time zone
);

CREATE TABLE public."forum_reactions" (
  "id" integer DEFAULT nextval('forum_reactions_id_seq'::regclass) NOT NULL,
  "post_id" integer,
  "comment_id" integer,
  "user_id" integer NOT NULL,
  "reaction_type" text NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."forum_read_states" (
  "id" integer DEFAULT nextval('forum_read_states_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "post_id" integer NOT NULL,
  "last_read_comment_id" integer,
  "last_read_at" timestamp without time zone DEFAULT now(),
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."forum_subscriptions" (
  "id" integer DEFAULT nextval('forum_subscriptions_id_seq'::regclass) NOT NULL,
  "post_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "subscribed_at" timestamp without time zone DEFAULT now() NOT NULL,
  "unsubscribed_at" timestamp without time zone,
  "email_opt_out" boolean DEFAULT false NOT NULL,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."legal_holds" (
  "id" integer DEFAULT nextval('legal_holds_id_seq'::regclass) NOT NULL,
  "case_type" text,
  "case_id" integer,
  "content_type" text,
  "content_id" integer,
  "user_id" integer,
  "reason" text NOT NULL,
  "placed_by" integer,
  "placed_at" timestamp without time zone DEFAULT now() NOT NULL,
  "released_by" integer,
  "released_at" timestamp without time zone,
  "release_reason" text
);

CREATE TABLE public."legal_policy_acceptances" (
  "id" bigint DEFAULT nextval('legal_policy_acceptances_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "policy_key" text NOT NULL,
  "version_id" integer NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
  "source" text NOT NULL
);

CREATE TABLE public."legal_policy_current" (
  "policy_key" text NOT NULL,
  "version_id" integer NOT NULL
);

CREATE TABLE public."legal_policy_defaults" (
  "id" integer NOT NULL,
  "sections" jsonb NOT NULL
);

CREATE TABLE public."legal_policy_versions" (
  "id" integer DEFAULT nextval('legal_policy_versions_id_seq'::regclass) NOT NULL,
  "policy_key" text NOT NULL,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "content_html" text NOT NULL,
  "content_hash" text NOT NULL,
  "published_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
  "change_notes" text
);

CREATE TABLE public."listing_payments" (
  "id" integer DEFAULT nextval('listing_payments_id_seq'::regclass) NOT NULL,
  "userid" integer NOT NULL,
  "listingid" integer,
  "amount" integer NOT NULL,
  "currency" character varying(3) DEFAULT 'usd'::character varying NOT NULL,
  "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
  "paymentintentid" character varying(100) NOT NULL,
  "discountcode" character varying(50),
  "createdat" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updatedat" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "is_subscription" boolean DEFAULT false,
  "subscription_id" text,
  "subscription_plan" text,
  "listing_type" text,
  "listing_duration" text
);

CREATE TABLE public."media_files" (
  "id" integer DEFAULT nextval('media_files_id_seq'::regclass) NOT NULL,
  "filename" text NOT NULL,
  "directory" text NOT NULL,
  "file_data" bytea NOT NULL,
  "file_size" bigint NOT NULL,
  "mime_type" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."message_attachments" (
  "id" character varying NOT NULL,
  "message_id" integer NOT NULL,
  "filename" character varying NOT NULL,
  "url" character varying NOT NULL,
  "size" character varying,
  "content_type" character varying,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "stored_filename" character varying
);

CREATE TABLE public."message_email_attempts" (
  "id" text NOT NULL,
  "request_id" text NOT NULL,
  "address" text NOT NULL,
  "state" text DEFAULT 'queued'::text NOT NULL,
  "started_at" timestamp with time zone,
  "recipient_ids" integer[] DEFAULT '{}'::integer[] NOT NULL
);

CREATE TABLE public."message_recipients" (
  "id" integer DEFAULT nextval('message_recipients_id_seq'::regclass) NOT NULL,
  "message_id" integer NOT NULL,
  "recipient_id" integer NOT NULL,
  "target_role" text,
  "status" text NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "deleted_at" timestamp without time zone,
  "deleted_by_recipient" boolean DEFAULT false
);

CREATE TABLE public."message_send_requests" (
  "id" text NOT NULL,
  "sender_id" integer NOT NULL,
  "request_key" text NOT NULL,
  "fingerprint" text NOT NULL,
  "message_id" integer,
  "state" text DEFAULT 'preparing'::text NOT NULL,
  "response" jsonb,
  "response_code" integer,
  "skipped" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "email_requested" boolean DEFAULT false NOT NULL,
  "template_id" text,
  "dismissed_at" timestamp with time zone
);

CREATE TABLE public."messages" (
  "id" integer DEFAULT nextval('messages_id_seq'::regclass) NOT NULL,
  "sender_id" integer NOT NULL,
  "subject" text NOT NULL,
  "content" text NOT NULL,
  "message_type" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "in_reply_to" integer,
  "deleted_at" timestamp without time zone,
  "deleted_by_sender" boolean DEFAULT false,
  "legal_hold" boolean DEFAULT false NOT NULL
);

CREATE TABLE public."migration_records" (
  "id" integer DEFAULT nextval('migration_records_id_seq'::regclass) NOT NULL,
  "source_type" text NOT NULL,
  "source_location" text NOT NULL,
  "media_bucket" text NOT NULL,
  "media_type" text NOT NULL,
  "storage_key" text NOT NULL,
  "migration_status" text NOT NULL,
  "error_message" text,
  "migrated_at" timestamp without time zone,
  "verification_status" boolean DEFAULT false,
  "verified_at" timestamp without time zone,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."notification_log" (
  "id" integer DEFAULT nextval('notification_log_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "notification_type" text NOT NULL,
  "resource_type" text,
  "resource_id" text,
  "comment_ids" text[],
  "message_id" integer,
  "email_sent" boolean DEFAULT true NOT NULL,
  "sent_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."notification_outbox" (
  "id" integer DEFAULT nextval('notification_outbox_id_seq'::regclass) NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "dmca_case_id" integer,
  "dedupe_key" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 8 NOT NULL,
  "next_attempt_at" timestamp without time zone DEFAULT now() NOT NULL,
  "last_error" text,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp without time zone
);

CREATE TABLE public."notification_queue" (
  "id" integer DEFAULT nextval('notification_queue_id_seq'::regclass) NOT NULL,
  "user_id" integer,
  "notification_type" text NOT NULL,
  "resource_type" text,
  "resource_id" text,
  "comment_id" integer,
  "message_id" integer,
  "metadata" jsonb,
  "processed" boolean DEFAULT false NOT NULL,
  "processed_at" timestamp without time zone,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."order_items" (
  "id" integer DEFAULT nextval('order_items_id_seq'::regclass) NOT NULL,
  "order_id" integer NOT NULL,
  "product_id" bigint NOT NULL,
  "quantity" integer NOT NULL,
  "price" numeric(10,2) NOT NULL,
  "variant_info" jsonb,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."orders" (
  "id" integer DEFAULT nextval('orders_id_seq'::regclass) NOT NULL,
  "user_id" integer,
  "status" text NOT NULL,
  "total" numeric(10,2) NOT NULL,
  "shipping_address" jsonb,
  "payment_intent_id" text,
  "print_provider_order_id" text,
  "tracking_number" text,
  "tracking_url" text,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  "discount_code" text,
  "square_order_id" text
);

CREATE TABLE public."page_content" (
  "id" integer DEFAULT nextval('page_content_id_seq'::regclass) NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "created_by" integer,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."page_contents" (
  "id" integer DEFAULT nextval('page_contents_id_seq'::regclass) NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "media_urls" text[],
  "updated_by" integer,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  "is_hidden" boolean DEFAULT false,
  "category" text,
  "order" integer DEFAULT 0,
  "hide_default_title" boolean DEFAULT false NOT NULL,
  "visibility_status" text DEFAULT 'published'::text NOT NULL,
  "legal_hold" boolean DEFAULT false NOT NULL,
  "hidden_at" timestamp without time zone,
  "hidden_by_admin_id" integer,
  "hidden_reason" text,
  "dmca_case_id" integer,
  "restored_at" timestamp without time zone,
  "restored_by_admin_id" integer,
  "deleted_at" timestamp without time zone
);

CREATE TABLE public."page_views" (
  "id" integer DEFAULT nextval('page_views_id_seq'::regclass) NOT NULL,
  "session_id" character varying(255) NOT NULL,
  "user_id" integer,
  "path" character varying(512) NOT NULL,
  "title" character varying(255),
  "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
  "duration" integer,
  "referrer" text,
  "query_params" jsonb
);

CREATE TABLE public."product_categories" (
  "id" integer DEFAULT nextval('product_categories_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."products" (
  "id" integer DEFAULT nextval('products_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" numeric(10,2) NOT NULL,
  "category" text NOT NULL,
  "image_urls" text[],
  "status" text DEFAULT 'draft'::text NOT NULL,
  "print_provider_id" text,
  "print_provider" text,
  "variant_data" jsonb,
  "design_urls" text[],
  "mockup_urls" text[],
  "created_by" integer,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  "featured" boolean DEFAULT false
);

CREATE TABLE public."real_estate_listings" (
  "id" integer DEFAULT nextval('real_estate_listings_id_seq'::regclass) NOT NULL,
  "price" integer NOT NULL,
  "address" text NOT NULL,
  "bedrooms" integer NOT NULL,
  "bathrooms" integer NOT NULL,
  "square_feet" integer NOT NULL,
  "year_built" integer NOT NULL,
  "description" text,
  "photos" text[],
  "contact_info" jsonb NOT NULL,
  "created_by" integer,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "listing_type" text DEFAULT 'FSBO'::text NOT NULL,
  "category" text,
  "title" text DEFAULT ''::text NOT NULL,
  "cash_only" boolean DEFAULT false,
  "open_house_date" timestamp without time zone,
  "open_house_start_time" text,
  "open_house_end_time" text,
  "is_approved" boolean DEFAULT false,
  "updated_at" timestamp without time zone DEFAULT now(),
  "expiration_date" timestamp without time zone,
  "is_subscription" boolean DEFAULT false,
  "subscription_id" text,
  "listing_duration" text,
  "status" text DEFAULT 'ACTIVE'::text NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "featured_at" timestamp without time zone,
  "visibility_status" text DEFAULT 'published'::text NOT NULL,
  "legal_hold" boolean DEFAULT false NOT NULL,
  "hidden_at" timestamp without time zone,
  "hidden_by_admin_id" integer,
  "hidden_reason" text,
  "dmca_case_id" integer,
  "restored_at" timestamp without time zone,
  "restored_by_admin_id" integer,
  "deleted_at" timestamp without time zone
);

CREATE TABLE public."session" (
  "sid" character varying NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp(6) without time zone NOT NULL
);

CREATE TABLE public."sessions" (
  "id" integer DEFAULT nextval('sessions_id_seq'::regclass) NOT NULL,
  "session_id" character varying(255) NOT NULL,
  "user_id" integer,
  "ip_address" character varying(45),
  "user_agent" text,
  "browser" character varying(255),
  "browser_version" character varying(100),
  "os" character varying(255),
  "device_type" character varying(100),
  "start_time" timestamp without time zone DEFAULT now() NOT NULL,
  "end_time" timestamp without time zone,
  "is_active" boolean DEFAULT true,
  "referrer" text,
  "entry_path" character varying(512),
  "exit_path" character varying(512)
);

CREATE TABLE public."site_settings" (
  "id" integer DEFAULT nextval('site_settings_id_seq'::regclass) NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "description" text,
  "updated_by" integer,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."sponsorships" (
  "id" integer DEFAULT nextval('sponsorships_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "listing_id" integer NOT NULL,
  "start_date" timestamp without time zone DEFAULT now() NOT NULL,
  "end_date" timestamp without time zone,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "subscription_id" text,
  "checkout_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."square_payments" (
  "id" integer DEFAULT nextval('square_payments_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "square_payment_id" text NOT NULL,
  "order_id" text,
  "checkout_id" text,
  "amount" numeric(10,2) NOT NULL,
  "currency" text DEFAULT 'USD'::text,
  "status" text NOT NULL,
  "listing_type" text,
  "listing_duration" text,
  "credits_awarded" integer DEFAULT 0,
  "webhook_data" jsonb,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."storeVisits" (
  "id" integer DEFAULT nextval('"storeVisits_id_seq"'::regclass) NOT NULL,
  "userId" integer NOT NULL,
  "lastVisitAt" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."store_settings" (
  "id" integer DEFAULT nextval('store_settings_id_seq'::regclass) NOT NULL,
  "category_labels" jsonb DEFAULT '{"HOME": "Home", "APPAREL": "Apparel", "ACCESSORIES": "Accessories", "MEMBERSHIPS": "Memberships", "SPONSORSHIP": "Sponsorship"}'::jsonb NOT NULL,
  "store_title" text DEFAULT 'Barefoot Bay Community Store'::text NOT NULL,
  "store_description" text DEFAULT 'Our Barefoot Bay Community Store features custom apparel, home goods, and accessories that celebrate life in our special community. Each purchase helps support community events and programs.'::text NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "featured_tab_label" text DEFAULT 'Sponsorship'::text NOT NULL,
  "show_featured_carousel" boolean DEFAULT false NOT NULL,
  "carousel_title" text DEFAULT 'Sponsorship Products'::text NOT NULL
);

CREATE TABLE public."store_visits" (
  "id" integer DEFAULT nextval('store_visits_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "last_visit_at" timestamp without time zone DEFAULT now() NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."support_messages" (
  "id" integer DEFAULT nextval('support_messages_id_seq'::regclass) NOT NULL,
  "user_id" character varying NOT NULL,
  "content" text NOT NULL,
  "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "thread_id" character varying NOT NULL
);

CREATE TABLE public."user_copyright_events" (
  "id" integer DEFAULT nextval('user_copyright_events_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "dmca_case_id" integer,
  "dmca_target_id" integer,
  "event_type" text NOT NULL,
  "event_date" timestamp without time zone DEFAULT now() NOT NULL,
  "counts_toward_repeat_policy" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "notes" text,
  "created_by" integer,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."user_credits" (
  "id" integer DEFAULT nextval('user_credits_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "credits" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."users" (
  "id" integer DEFAULT nextval('users_id_seq'::regclass) NOT NULL,
  "username" text NOT NULL,
  "password" text NOT NULL,
  "is_resident" boolean DEFAULT false NOT NULL,
  "email" text NOT NULL,
  "full_name" text NOT NULL,
  "avatar_url" text,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "role" text DEFAULT 'public'::text NOT NULL,
  "is_approved" boolean DEFAULT false NOT NULL,
  "resident_tags" text[] DEFAULT '{}'::text[],
  "is_local_resident" boolean DEFAULT false,
  "owns_home_in_bb" boolean DEFAULT false,
  "is_full_time_resident" boolean DEFAULT false,
  "has_membership_badge" boolean DEFAULT false,
  "membership_badge_number" text,
  "has_lived_in_bb" boolean DEFAULT false,
  "considering_moving_to_bb" boolean DEFAULT false,
  "reset_token" text,
  "reset_token_expires" timestamp without time zone,
  "is_snowbird" boolean DEFAULT false,
  "is_blocked" boolean DEFAULT false NOT NULL,
  "block_reason" text,
  "subscription_id" text,
  "subscription_type" text,
  "subscription_status" text,
  "subscription_start_date" timestamp without time zone,
  "subscription_end_date" timestamp without time zone,
  "square_customer_id" text,
  "rents_home_in_bb" boolean DEFAULT false,
  "buys_day_passes" boolean DEFAULT false,
  "has_visited_bb" boolean DEFAULT false,
  "never_visited_bb" boolean DEFAULT false,
  "has_friends_in_bb" boolean DEFAULT false,
  "want_to_discover_bb" boolean DEFAULT false,
  "never_heard_of_bb" boolean DEFAULT false,
  "previous_role" text,
  "phone_number" text,
  "email_notifications_enabled" boolean DEFAULT true NOT NULL,
  "club_memberships" text[],
  "marketing_emails_enabled" boolean DEFAULT true NOT NULL,
  "legal_hold" boolean DEFAULT false NOT NULL
);

CREATE TABLE public."vendor_categories" (
  "id" integer DEFAULT nextval('vendor_categories_id_seq'::regclass) NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "is_hidden" boolean DEFAULT false NOT NULL,
  "icon" text
);

CREATE TABLE public."vendor_comments" (
  "id" integer DEFAULT nextval('vendor_comments_id_seq'::regclass) NOT NULL,
  "page_slug" text NOT NULL,
  "user_id" integer NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  "visibility_status" text DEFAULT 'published'::text NOT NULL,
  "legal_hold" boolean DEFAULT false NOT NULL,
  "hidden_at" timestamp without time zone,
  "hidden_by_admin_id" integer,
  "hidden_reason" text,
  "dmca_case_id" integer,
  "restored_at" timestamp without time zone,
  "restored_by_admin_id" integer,
  "deleted_at" timestamp without time zone
);

CREATE TABLE public."vendor_interactions" (
  "id" integer DEFAULT nextval('vendor_interactions_id_seq'::regclass) NOT NULL,
  "page_slug" text NOT NULL,
  "user_id" integer NOT NULL,
  "interaction_type" text NOT NULL,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."vendor_page_visits" (
  "id" integer DEFAULT nextval('vendor_page_visits_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "vendor_slug" text NOT NULL,
  "visited_at" timestamp without time zone DEFAULT now() NOT NULL,
  "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE public."vendor_visits" (
  "id" integer DEFAULT nextval('vendor_visits_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "last_visit_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public."weekly_listings_email_activity" (
  "id" integer DEFAULT nextval('weekly_listings_email_activity_id_seq'::regclass) NOT NULL,
  "event" text NOT NULL,
  "week_start" text,
  "week_end" text,
  "detail" text,
  "actor" text,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."weekly_listings_email_sends" (
  "id" integer DEFAULT nextval('weekly_listings_email_sends_id_seq'::regclass) NOT NULL,
  "week_start" text NOT NULL,
  "week_end" text NOT NULL,
  "status" text DEFAULT 'sending'::text NOT NULL,
  "triggered_by" text DEFAULT 'scheduler'::text NOT NULL,
  "listing_count" integer DEFAULT 0 NOT NULL,
  "recipient_count" integer DEFAULT 0 NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "error" text,
  "sent_at" timestamp without time zone,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "triggered_by_user" text,
  "schedule_key" text
);

CREATE OR REPLACE FUNCTION public.convert_to_proxy_url(url text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- If already a proxy URL, return as is
  IF url LIKE '/api/storage-proxy/%' THEN
    RETURN url;
  END IF;
  
  -- Handle direct Object Storage URLs
  IF url LIKE 'https://object-storage.replit.app/%' THEN
    -- Extract the filename if it's in CALENDAR/events/
    IF url LIKE '%/CALENDAR/events/%' THEN
      RETURN '/api/storage-proxy/CALENDAR/events/' || substring(url from '([^/]+)$');
    ELSE
      -- For other paths, try to preserve the path structure after the domain
      DECLARE 
        path_parts text[];
        bucket text;
        remaining_path text;
      BEGIN
        -- Extract path after domain, removing the leading slash
        path_parts := regexp_split_to_array(
          substring(url from 'https://object-storage\.replit\.app(/[^?#]*)'),
          '/'
        );
        
        -- Remove empty first element (from leading slash)
        path_parts := path_parts[2:array_length(path_parts, 1)];
        
        -- Extract bucket (first part) and remaining path
        IF array_length(path_parts, 1) >= 2 THEN
          bucket := path_parts[1];
          remaining_path := array_to_string(path_parts[2:array_length(path_parts, 1)], '/');
          RETURN '/api/storage-proxy/' || bucket || '/' || remaining_path;
        END IF;
      END;
    END IF;
  END IF;
  
  -- If we couldn't convert, return the original URL
  RETURN url;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dmca_block_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF coalesce(current_setting('dmca.allow_purge', true), '') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is append-only; % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.legal_dmca_changed()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Published DMCA source cannot be deleted'; END IF;
 PERFORM legal_publish_dmca(); RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.legal_escape(v text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
 SELECT replace(replace(replace(replace(replace(coalesce(v,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;')
$function$;

CREATE OR REPLACE FUNCTION public.legal_hold_block_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- A DMCA takedown is reversible evidence: dmca_hidden rows are protected
  -- exactly like held rows (to_jsonb works for tables without the column).
  IF OLD.legal_hold IS TRUE OR (to_jsonb(OLD) ->> 'visibility_status') = 'dmca_hidden' THEN
    RAISE EXCEPTION 'LEGAL_HOLD: % row % is under legal hold or an active DMCA takedown and cannot be permanently deleted', TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'BBLH1';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.legal_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN RAISE EXCEPTION 'Legal evidence is immutable'; END $function$;

CREATE OR REPLACE FUNCTION public.legal_page_publish()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE k text;
BEGIN
 IF TG_OP='DELETE' THEN
   IF OLD.slug IN ('terms-and-agreements','privacy-policy') AND NOT OLD.is_hidden THEN RAISE EXCEPTION 'Published legal source cannot be deleted'; END IF;
   RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.slug IN ('terms-and-agreements','privacy-policy') AND NOT OLD.is_hidden AND (NEW.slug<>OLD.slug OR NEW.is_hidden) THEN
   RAISE EXCEPTION 'Published legal source cannot be hidden or renamed';
 END IF;
 k := CASE NEW.slug WHEN 'terms-and-agreements' THEN 'terms' WHEN 'privacy-policy' THEN 'privacy' ELSE NULL END;
 IF k IS NOT NULL AND NOT NEW.is_hidden THEN
   IF EXISTS(SELECT 1 FROM page_contents WHERE slug=NEW.slug AND id<>NEW.id AND NOT is_hidden) THEN RAISE EXCEPTION 'Duplicate published legal source'; END IF;
   PERFORM legal_publish(k,NEW.title,'/'||k,NEW.content);
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.legal_publish(k text, t text, u text, c text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE old_hash text; h text; v integer;
BEGIN
 PERFORM pg_advisory_xact_lock(736201);
 h := encode(sha256(convert_to(jsonb_build_array(t,u,c)::text,'UTF8')),'hex');
 SELECT p.content_hash INTO old_hash FROM legal_policy_current a JOIN legal_policy_versions p ON p.id=a.version_id WHERE a.policy_key=k;
 IF old_hash IS NOT DISTINCT FROM h THEN RETURN; END IF;
 INSERT INTO legal_policy_versions(policy_key,title,url,content_html,content_hash) VALUES(k,t,u,c,h) RETURNING id INTO v;
 INSERT INTO legal_policy_current VALUES(k,v) ON CONFLICT(policy_key) DO UPDATE SET version_id=excluded.version_id;
END $function$;

CREATE OR REPLACE FUNCTION public.legal_publish_dmca()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE s dmca_settings%ROWTYPE; section jsonb; override_section jsonb; html text := ''; defaults jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(736201);
 SELECT * INTO s FROM dmca_settings WHERE id=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'DMCA settings singleton unavailable'; END IF;
 SELECT sections INTO defaults FROM legal_policy_defaults WHERE id=1;
 IF defaults IS NULL THEN RETURN; END IF;
 FOR section IN SELECT value FROM jsonb_array_elements(defaults) LOOP
   SELECT value INTO override_section FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.policy_sections)='array' THEN s.policy_sections ELSE '[]'::jsonb END) WITH ORDINALITY AS overrides(value,position)
   WHERE value->>'key'=section->>'key' ORDER BY position DESC LIMIT 1;
   section := section || jsonb_build_object(
     'title', CASE WHEN jsonb_typeof(override_section->'title')='string' THEN override_section->>'title' ELSE section->>'title' END,
     'body', CASE WHEN jsonb_typeof(override_section->'body')='string' THEN override_section->>'body' ELSE section->>'body' END
   );
   html := html || '<section><h2>' || legal_escape(section->>'title') || '</h2><div style="white-space:pre-wrap">' || legal_escape(section->>'body') || '</div></section>';
 END LOOP;
 html := html || '<section><h2>Designated Agent</h2><div style="white-space:pre-wrap">' ||
 legal_escape(concat_ws(E'\n',s.agent_name,s.agent_organization,s.agent_address,s.agent_phone,s.agent_email)) || '</div></section>';
 PERFORM legal_publish('dmca','Copyright/DMCA Policy','/dmca',html);
END $function$;

CREATE OR REPLACE FUNCTION public.legal_source_lock()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM pg_advisory_xact_lock(736201); RETURN NULL; END $function$;

CREATE OR REPLACE FUNCTION public.normalize_media_url(url text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- If already a proxy URL, return as is
  IF url LIKE '/api/storage-proxy/%' THEN
    RETURN url;
  END IF;
  
  -- Handle direct Object Storage URLs
  IF url LIKE 'https://object-storage.replit.app/%' THEN
    -- Extract the filename if it's in CALENDAR/events/
    IF url LIKE '%/CALENDAR/events/%' THEN
      RETURN '/api/storage-proxy/CALENDAR/events/' || substring(url from '([^/]+)$');
    ELSE
      -- For other paths, try to preserve the path structure after the domain
      DECLARE 
        path_parts text[];
        bucket text;
        remaining_path text;
      BEGIN
        -- Extract path after domain, removing the leading slash
        path_parts := regexp_split_to_array(
          substring(url from 'https://object-storage\.replit\.app(/[^?#]*)'),
          '/'
        );
        
        -- Remove empty first element (from leading slash)
        path_parts := path_parts[2:array_length(path_parts, 1)];
        
        -- Extract bucket (first part) and remaining path
        IF array_length(path_parts, 1) >= 2 THEN
          bucket := path_parts[1];
          remaining_path := array_to_string(path_parts[2:array_length(path_parts, 1)], '/');
          RETURN '/api/storage-proxy/' || bucket || '/' || remaining_path;
        END IF;
      END;
    END IF;
  END IF;
  
  -- Handle /uploads/calendar/ URLs
  IF url LIKE '/uploads/calendar/%' THEN
    RETURN '/api/storage-proxy/CALENDAR/events/' || substring(url from '([^/]+)$');
  END IF;
  
  -- Handle /calendar/ URLs
  IF url LIKE '/calendar/%' THEN
    RETURN '/api/storage-proxy/CALENDAR/events/' || substring(url from '([^/]+)$');
  END IF;
  
  -- If we couldn't convert, return the original URL
  RETURN url;
END;
$function$;

CREATE OR REPLACE FUNCTION public.queue_forum_comment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Insert a notification queue entry for the new comment
  -- We'll use a single queue entry and the processor will handle notifying all admins
  INSERT INTO notification_queue (
    user_id,
    notification_type,
    resource_type,
    resource_id,
    comment_id,
    metadata,
    processed,
    created_at
  )
  VALUES (
    NULL,  -- NULL user_id means "notify all admins" - processor will handle this
    'comment',
    'forum_post',
    NEW.post_id::text,
    NEW.id,
    json_build_object(
      'author_id', NEW.author_id,
      'content', LEFT(NEW.content, 200)  -- Store first 200 chars for reference
    )::jsonb,
    false,
    NOW()
  );
  
  RETURN NEW;
END;
$function$;

ALTER SEQUENCE public."analytics_events_id_seq" OWNED BY public."analytics_events"."id";

ALTER SEQUENCE public."analytics_page_views_id_seq" OWNED BY public."analytics_page_views"."id";

ALTER SEQUENCE public."analytics_sessions_id_seq" OWNED BY public."analytics_sessions"."id";

ALTER SEQUENCE public."calendar_email_schedule_id_seq" OWNED BY public."calendar_email_schedule"."id";

ALTER SEQUENCE public."chat_messages_id_seq" OWNED BY public."chat_messages"."id";

ALTER SEQUENCE public."comment_subscriptions_id_seq" OWNED BY public."comment_subscriptions"."id";

ALTER SEQUENCE public."community_categories_id_seq" OWNED BY public."community_categories"."id";

ALTER SEQUENCE public."content_versions_id_seq" OWNED BY public."content_versions"."id";

ALTER SEQUENCE public."credit_transactions_id_seq" OWNED BY public."credit_transactions"."id";

ALTER SEQUENCE public."custom_forms_id_seq" OWNED BY public."custom_forms"."id";

ALTER SEQUENCE public."dmca_admin_alerts_id_seq" OWNED BY public."dmca_admin_alerts"."id";

ALTER SEQUENCE public."dmca_audit_log_id_seq" OWNED BY public."dmca_audit_log"."id";

ALTER SEQUENCE public."dmca_cases_id_seq" OWNED BY public."dmca_cases"."id";

ALTER SEQUENCE public."dmca_content_flags_id_seq" OWNED BY public."dmca_content_flags"."id";

ALTER SEQUENCE public."dmca_permission_grants_id_seq" OWNED BY public."dmca_permission_grants"."id";

ALTER SEQUENCE public."dmca_quarantined_objects_id_seq" OWNED BY public."dmca_quarantined_objects"."id";

ALTER SEQUENCE public."dmca_repeat_infringer_reviews_id_seq" OWNED BY public."dmca_repeat_infringer_reviews"."id";

ALTER SEQUENCE public."dmca_submissions_id_seq" OWNED BY public."dmca_submissions"."id";

ALTER SEQUENCE public."dmca_targets_id_seq" OWNED BY public."dmca_targets"."id";

ALTER SEQUENCE public."event_comments_id_seq" OWNED BY public."event_comments"."id";

ALTER SEQUENCE public."event_interactions_id_seq" OWNED BY public."event_interactions"."id";

ALTER SEQUENCE public."events_id_seq" OWNED BY public."events"."id";

ALTER SEQUENCE public."feature_flags_id_seq" OWNED BY public."feature_flags"."id";

ALTER SEQUENCE public."for_sale_visits_id_seq" OWNED BY public."for_sale_visits"."id";

ALTER SEQUENCE public."form_submissions_id_seq" OWNED BY public."form_submissions"."id";

ALTER SEQUENCE public."forum_categories_id_seq" OWNED BY public."forum_categories"."id";

ALTER SEQUENCE public."forum_comments_id_seq" OWNED BY public."forum_comments"."id";

ALTER SEQUENCE public."forum_description_id_seq" OWNED BY public."forum_description"."id";

ALTER SEQUENCE public."forum_likes_id_seq" OWNED BY public."forum_likes"."id";

ALTER SEQUENCE public."forum_posts_id_seq" OWNED BY public."forum_posts"."id";

ALTER SEQUENCE public."forum_reactions_id_seq" OWNED BY public."forum_reactions"."id";

ALTER SEQUENCE public."forum_read_states_id_seq" OWNED BY public."forum_read_states"."id";

ALTER SEQUENCE public."forum_subscriptions_id_seq" OWNED BY public."forum_subscriptions"."id";

ALTER SEQUENCE public."legal_holds_id_seq" OWNED BY public."legal_holds"."id";

ALTER SEQUENCE public."legal_policy_acceptances_id_seq" OWNED BY public."legal_policy_acceptances"."id";

ALTER SEQUENCE public."legal_policy_versions_id_seq" OWNED BY public."legal_policy_versions"."id";

ALTER SEQUENCE public."listing_payments_id_seq" OWNED BY public."listing_payments"."id";

ALTER SEQUENCE public."media_files_id_seq" OWNED BY public."media_files"."id";

ALTER SEQUENCE public."message_recipients_id_seq" OWNED BY public."message_recipients"."id";

ALTER SEQUENCE public."messages_id_seq" OWNED BY public."messages"."id";

ALTER SEQUENCE public."migration_records_id_seq" OWNED BY public."migration_records"."id";

ALTER SEQUENCE public."notification_log_id_seq" OWNED BY public."notification_log"."id";

ALTER SEQUENCE public."notification_outbox_id_seq" OWNED BY public."notification_outbox"."id";

ALTER SEQUENCE public."notification_queue_id_seq" OWNED BY public."notification_queue"."id";

ALTER SEQUENCE public."order_items_id_seq" OWNED BY public."order_items"."id";

ALTER SEQUENCE public."orders_id_seq" OWNED BY public."orders"."id";

ALTER SEQUENCE public."page_content_id_seq" OWNED BY public."page_content"."id";

ALTER SEQUENCE public."page_contents_id_seq" OWNED BY public."page_contents"."id";

ALTER SEQUENCE public."page_views_id_seq" OWNED BY public."page_views"."id";

ALTER SEQUENCE public."product_categories_id_seq" OWNED BY public."product_categories"."id";

ALTER SEQUENCE public."products_id_seq" OWNED BY public."products"."id";

ALTER SEQUENCE public."real_estate_listings_id_seq" OWNED BY public."real_estate_listings"."id";

ALTER SEQUENCE public."sessions_id_seq" OWNED BY public."sessions"."id";

ALTER SEQUENCE public."site_settings_id_seq" OWNED BY public."site_settings"."id";

ALTER SEQUENCE public."sponsorships_id_seq" OWNED BY public."sponsorships"."id";

ALTER SEQUENCE public."square_payments_id_seq" OWNED BY public."square_payments"."id";

ALTER SEQUENCE public."storeVisits_id_seq" OWNED BY public."storeVisits"."id";

ALTER SEQUENCE public."store_settings_id_seq" OWNED BY public."store_settings"."id";

ALTER SEQUENCE public."store_visits_id_seq" OWNED BY public."store_visits"."id";

ALTER SEQUENCE public."support_messages_id_seq" OWNED BY public."support_messages"."id";

ALTER SEQUENCE public."user_copyright_events_id_seq" OWNED BY public."user_copyright_events"."id";

ALTER SEQUENCE public."user_credits_id_seq" OWNED BY public."user_credits"."id";

ALTER SEQUENCE public."users_id_seq" OWNED BY public."users"."id";

ALTER SEQUENCE public."vendor_categories_id_seq" OWNED BY public."vendor_categories"."id";

ALTER SEQUENCE public."vendor_comments_id_seq" OWNED BY public."vendor_comments"."id";

ALTER SEQUENCE public."vendor_interactions_id_seq" OWNED BY public."vendor_interactions"."id";

ALTER SEQUENCE public."vendor_page_visits_id_seq" OWNED BY public."vendor_page_visits"."id";

ALTER SEQUENCE public."vendor_visits_id_seq" OWNED BY public."vendor_visits"."id";

ALTER SEQUENCE public."weekly_listings_email_activity_id_seq" OWNED BY public."weekly_listings_email_activity"."id";

ALTER SEQUENCE public."weekly_listings_email_sends_id_seq" OWNED BY public."weekly_listings_email_sends"."id";

ALTER TABLE public."analytics_events" ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY (id);

ALTER TABLE public."analytics_page_views" ADD CONSTRAINT "analytics_page_views_pkey" PRIMARY KEY (id);

ALTER TABLE public."analytics_sessions" ADD CONSTRAINT "analytics_sessions_pkey" PRIMARY KEY (id);

ALTER TABLE public."analytics_sessions" ADD CONSTRAINT "analytics_sessions_session_id_key" UNIQUE (session_id);

ALTER TABLE public."calendar_email_schedule" ADD CONSTRAINT "calendar_email_schedule_pkey" PRIMARY KEY (id);

ALTER TABLE public."chat_messages" ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY (id);

ALTER TABLE public."chat_sessions" ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY (id);

ALTER TABLE public."comment_subscriptions" ADD CONSTRAINT "comment_subscriptions_pkey" PRIMARY KEY (id);

ALTER TABLE public."comment_subscriptions" ADD CONSTRAINT "comment_subscriptions_resource_type_check" CHECK (resource_type = ANY (ARRAY['event'::text, 'vendor'::text, 'forum_post'::text, 'community'::text]));

ALTER TABLE public."comment_subscriptions" ADD CONSTRAINT "comment_subscriptions_user_id_resource_type_resource_id_key" UNIQUE (user_id, resource_type, resource_id);

ALTER TABLE public."community_categories" ADD CONSTRAINT "community_categories_name_key" UNIQUE (name);

ALTER TABLE public."community_categories" ADD CONSTRAINT "community_categories_pkey" PRIMARY KEY (id);

ALTER TABLE public."community_categories" ADD CONSTRAINT "community_categories_slug_key" UNIQUE (slug);

ALTER TABLE public."content" ADD CONSTRAINT "content_pkey" PRIMARY KEY (slug);

ALTER TABLE public."content_versions" ADD CONSTRAINT "content_versions_pkey" PRIMARY KEY (id);

ALTER TABLE public."credit_transactions" ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY (id);

ALTER TABLE public."custom_forms" ADD CONSTRAINT "custom_forms_pkey" PRIMARY KEY (id);

ALTER TABLE public."custom_forms" ADD CONSTRAINT "custom_forms_slug_key" UNIQUE (slug);

ALTER TABLE public."dmca_admin_alerts" ADD CONSTRAINT "dmca_admin_alerts_pkey" PRIMARY KEY (id);

ALTER TABLE public."dmca_admin_alerts" ADD CONSTRAINT "dmca_admin_alerts_severity_check" CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text]));

ALTER TABLE public."dmca_audit_log" ADD CONSTRAINT "dmca_audit_log_pkey" PRIMARY KEY (id);

ALTER TABLE public."dmca_case_counters" ADD CONSTRAINT "dmca_case_counters_pkey" PRIMARY KEY (year);

ALTER TABLE public."dmca_cases" ADD CONSTRAINT "dmca_cases_case_number_key" UNIQUE (case_number);

ALTER TABLE public."dmca_cases" ADD CONSTRAINT "dmca_cases_pkey" PRIMARY KEY (id);

ALTER TABLE public."dmca_cases" ADD CONSTRAINT "dmca_cases_status_token_key" UNIQUE (status_token);

ALTER TABLE public."dmca_content_flags" ADD CONSTRAINT "dmca_content_flags_pkey" PRIMARY KEY (id);

ALTER TABLE public."dmca_permission_grants" ADD CONSTRAINT "dmca_permission_grants_pkey" PRIMARY KEY (id);

ALTER TABLE public."dmca_permission_grants" ADD CONSTRAINT "dmca_permission_grants_user_permission_unique" UNIQUE (user_id, permission);

ALTER TABLE public."dmca_quarantined_objects" ADD CONSTRAINT "dmca_quarantined_objects_pkey" PRIMARY KEY (id);

ALTER TABLE public."dmca_repeat_infringer_reviews" ADD CONSTRAINT "dmca_repeat_infringer_reviews_pkey" PRIMARY KEY (id);

ALTER TABLE public."dmca_repeat_infringer_reviews" ADD CONSTRAINT "dmca_repeat_infringer_reviews_status_check" CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text]));

ALTER TABLE public."dmca_settings" ADD CONSTRAINT "dmca_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."dmca_settings" ADD CONSTRAINT "dmca_settings_singleton" CHECK (id = 1);

ALTER TABLE public."dmca_submissions" ADD CONSTRAINT "dmca_submissions_pkey" PRIMARY KEY (id);

ALTER TABLE public."dmca_targets" ADD CONSTRAINT "dmca_targets_pkey" PRIMARY KEY (id);

ALTER TABLE public."event_comments" ADD CONSTRAINT "event_comments_pkey" PRIMARY KEY (id);

ALTER TABLE public."event_interactions" ADD CONSTRAINT "event_interactions_pkey" PRIMARY KEY (id);

ALTER TABLE public."event_slug_overrides" ADD CONSTRAINT "event_slug_overrides_pkey" PRIMARY KEY (event_id);

ALTER TABLE public."events" ADD CONSTRAINT "events_pkey" PRIMARY KEY (id);

ALTER TABLE public."express_sessions" ADD CONSTRAINT "express_sessions_pkey" PRIMARY KEY (sid);

ALTER TABLE public."feature_flags" ADD CONSTRAINT "feature_flags_name_key" UNIQUE (name);

ALTER TABLE public."feature_flags" ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY (id);

ALTER TABLE public."for_sale_visits" ADD CONSTRAINT "for_sale_visits_pkey" PRIMARY KEY (id);

ALTER TABLE public."for_sale_visits" ADD CONSTRAINT "for_sale_visits_user_id_key" UNIQUE (user_id);

ALTER TABLE public."form_submissions" ADD CONSTRAINT "form_submissions_pkey" PRIMARY KEY (id);

ALTER TABLE public."forum_categories" ADD CONSTRAINT "forum_categories_pkey" PRIMARY KEY (id);

ALTER TABLE public."forum_comments" ADD CONSTRAINT "forum_comments_pkey" PRIMARY KEY (id);

ALTER TABLE public."forum_description" ADD CONSTRAINT "forum_description_pkey" PRIMARY KEY (id);

ALTER TABLE public."forum_likes" ADD CONSTRAINT "forum_likes_pkey" PRIMARY KEY (id);

ALTER TABLE public."forum_posts" ADD CONSTRAINT "forum_posts_pkey" PRIMARY KEY (id);

ALTER TABLE public."forum_reactions" ADD CONSTRAINT "forum_reactions_pkey" PRIMARY KEY (id);

ALTER TABLE public."forum_read_states" ADD CONSTRAINT "forum_read_states_pkey" PRIMARY KEY (id);

ALTER TABLE public."forum_read_states" ADD CONSTRAINT "forum_read_states_user_id_post_id_key" UNIQUE (user_id, post_id);

ALTER TABLE public."forum_subscriptions" ADD CONSTRAINT "forum_subscriptions_pkey" PRIMARY KEY (id);

ALTER TABLE public."forum_subscriptions" ADD CONSTRAINT "forum_subscriptions_post_user_unique" UNIQUE (post_id, user_id);

ALTER TABLE public."legal_holds" ADD CONSTRAINT "legal_holds_pkey" PRIMARY KEY (id);

ALTER TABLE public."legal_policy_acceptances" ADD CONSTRAINT "legal_policy_acceptances_pkey" PRIMARY KEY (id);

ALTER TABLE public."legal_policy_acceptances" ADD CONSTRAINT "legal_policy_acceptances_source_check" CHECK (source = ANY (ARRAY['signup'::text, 'subsequent'::text]));

ALTER TABLE public."legal_policy_acceptances" ADD CONSTRAINT "legal_policy_acceptances_user_id_version_id_key" UNIQUE (user_id, version_id);

ALTER TABLE public."legal_policy_current" ADD CONSTRAINT "legal_policy_current_pkey" PRIMARY KEY (policy_key);

ALTER TABLE public."legal_policy_defaults" ADD CONSTRAINT "legal_policy_defaults_id_check" CHECK (id = 1);

ALTER TABLE public."legal_policy_defaults" ADD CONSTRAINT "legal_policy_defaults_pkey" PRIMARY KEY (id);

ALTER TABLE public."legal_policy_versions" ADD CONSTRAINT "legal_policy_versions_id_policy_key_key" UNIQUE (id, policy_key);

ALTER TABLE public."legal_policy_versions" ADD CONSTRAINT "legal_policy_versions_pkey" PRIMARY KEY (id);

ALTER TABLE public."legal_policy_versions" ADD CONSTRAINT "legal_policy_versions_policy_key_check" CHECK (policy_key = ANY (ARRAY['terms'::text, 'privacy'::text, 'dmca'::text]));

ALTER TABLE public."listing_payments" ADD CONSTRAINT "listing_payments_paymentintentid_key" UNIQUE (paymentintentid);

ALTER TABLE public."listing_payments" ADD CONSTRAINT "listing_payments_pkey" PRIMARY KEY (id);

ALTER TABLE public."media_files" ADD CONSTRAINT "media_files_pkey" PRIMARY KEY (id);

ALTER TABLE public."message_attachments" ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY (id);

ALTER TABLE public."message_email_attempts" ADD CONSTRAINT "message_email_attempts_pkey" PRIMARY KEY (id);

ALTER TABLE public."message_recipients" ADD CONSTRAINT "message_recipients_pkey" PRIMARY KEY (id);

ALTER TABLE public."message_send_requests" ADD CONSTRAINT "message_send_requests_pkey" PRIMARY KEY (id);

ALTER TABLE public."messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY (id);

ALTER TABLE public."migration_records" ADD CONSTRAINT "migration_records_pkey" PRIMARY KEY (id);

ALTER TABLE public."notification_log" ADD CONSTRAINT "notification_log_notification_type_check" CHECK (notification_type = ANY (ARRAY['comment'::text, 'message'::text]));

ALTER TABLE public."notification_log" ADD CONSTRAINT "notification_log_pkey" PRIMARY KEY (id);

ALTER TABLE public."notification_log" ADD CONSTRAINT "notification_log_resource_type_check" CHECK (resource_type = ANY (ARRAY['event'::text, 'vendor'::text, 'forum_post'::text, 'community'::text]));

ALTER TABLE public."notification_outbox" ADD CONSTRAINT "notification_outbox_dedupe_key_key" UNIQUE (dedupe_key);

ALTER TABLE public."notification_outbox" ADD CONSTRAINT "notification_outbox_pkey" PRIMARY KEY (id);

ALTER TABLE public."notification_queue" ADD CONSTRAINT "notification_queue_notification_type_check" CHECK (notification_type = ANY (ARRAY['comment'::text, 'message'::text]));

ALTER TABLE public."notification_queue" ADD CONSTRAINT "notification_queue_pkey" PRIMARY KEY (id);

ALTER TABLE public."notification_queue" ADD CONSTRAINT "notification_queue_resource_type_check" CHECK (resource_type = ANY (ARRAY['event'::text, 'vendor'::text, 'forum_post'::text, 'community'::text]));

ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_pkey" PRIMARY KEY (id);

ALTER TABLE public."orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);

ALTER TABLE public."page_content" ADD CONSTRAINT "page_content_pkey" PRIMARY KEY (id);

ALTER TABLE public."page_content" ADD CONSTRAINT "page_content_slug_key" UNIQUE (slug);

ALTER TABLE public."page_contents" ADD CONSTRAINT "page_contents_pkey" PRIMARY KEY (id);

ALTER TABLE public."page_views" ADD CONSTRAINT "page_views_pkey" PRIMARY KEY (id);

ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_name_key" UNIQUE (name);

ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY (id);

ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_slug_key" UNIQUE (slug);

ALTER TABLE public."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);

ALTER TABLE public."real_estate_listings" ADD CONSTRAINT "real_estate_listings_pkey" PRIMARY KEY (id);

ALTER TABLE public."session" ADD CONSTRAINT "session_pkey" PRIMARY KEY (sid);

ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_pkey" PRIMARY KEY (id);

ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_session_id_key" UNIQUE (session_id);

ALTER TABLE public."site_settings" ADD CONSTRAINT "site_settings_key_key" UNIQUE (key);

ALTER TABLE public."site_settings" ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."sponsorships" ADD CONSTRAINT "sponsorships_pkey" PRIMARY KEY (id);

ALTER TABLE public."square_payments" ADD CONSTRAINT "square_payments_pkey" PRIMARY KEY (id);

ALTER TABLE public."storeVisits" ADD CONSTRAINT "storeVisits_pkey" PRIMARY KEY (id);

ALTER TABLE public."storeVisits" ADD CONSTRAINT "storeVisits_userId_key" UNIQUE ("userId");

ALTER TABLE public."store_settings" ADD CONSTRAINT "store_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."store_visits" ADD CONSTRAINT "store_visits_pkey" PRIMARY KEY (id);

ALTER TABLE public."store_visits" ADD CONSTRAINT "store_visits_user_id_key" UNIQUE (user_id);

ALTER TABLE public."support_messages" ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_copyright_events" ADD CONSTRAINT "user_copyright_events_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_credits" ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_credits" ADD CONSTRAINT "user_credits_user_id_unique" UNIQUE (user_id);

ALTER TABLE public."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);

ALTER TABLE public."users" ADD CONSTRAINT "users_username_key" UNIQUE (username);

ALTER TABLE public."vendor_categories" ADD CONSTRAINT "vendor_categories_name_key" UNIQUE (name);

ALTER TABLE public."vendor_categories" ADD CONSTRAINT "vendor_categories_pkey" PRIMARY KEY (id);

ALTER TABLE public."vendor_categories" ADD CONSTRAINT "vendor_categories_slug_key" UNIQUE (slug);

ALTER TABLE public."vendor_comments" ADD CONSTRAINT "vendor_comments_pkey" PRIMARY KEY (id);

ALTER TABLE public."vendor_interactions" ADD CONSTRAINT "vendor_interactions_pkey" PRIMARY KEY (id);

ALTER TABLE public."vendor_page_visits" ADD CONSTRAINT "vendor_page_visits_pkey" PRIMARY KEY (id);

ALTER TABLE public."vendor_page_visits" ADD CONSTRAINT "vendor_page_visits_user_id_vendor_slug_key" UNIQUE (user_id, vendor_slug);

ALTER TABLE public."vendor_visits" ADD CONSTRAINT "vendor_visits_pkey" PRIMARY KEY (id);

ALTER TABLE public."vendor_visits" ADD CONSTRAINT "vendor_visits_user_id_key" UNIQUE (user_id);

ALTER TABLE public."weekly_listings_email_activity" ADD CONSTRAINT "weekly_listings_email_activity_pkey" PRIMARY KEY (id);

ALTER TABLE public."weekly_listings_email_sends" ADD CONSTRAINT "weekly_listings_email_sends_pkey" PRIMARY KEY (id);

ALTER TABLE public."weekly_listings_email_sends" ADD CONSTRAINT "weekly_listings_email_sends_week_start_unique" UNIQUE (week_start);

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);

CREATE INDEX chat_session_idx ON public.chat_messages USING btree (session_id);

CREATE INDEX comment_subscriptions_resource_idx ON public.comment_subscriptions USING btree (resource_type, resource_id);

CREATE INDEX comment_subscriptions_user_id_idx ON public.comment_subscriptions USING btree (user_id);

CREATE UNIQUE INDEX dmca_admin_alerts_dedupe_uniq ON public.dmca_admin_alerts USING btree (dedupe_key);

CREATE INDEX dmca_admin_alerts_open_idx ON public.dmca_admin_alerts USING btree (created_at DESC) WHERE (acknowledged_at IS NULL);

CREATE INDEX dmca_audit_log_case_idx ON public.dmca_audit_log USING btree (dmca_case_id);

CREATE INDEX dmca_audit_log_created_idx ON public.dmca_audit_log USING btree (created_at);

CREATE INDEX dmca_cases_status_idx ON public.dmca_cases USING btree (status);

CREATE INDEX dmca_content_flags_content_idx ON public.dmca_content_flags USING btree (content_type, content_id);

CREATE INDEX dmca_content_flags_open_idx ON public.dmca_content_flags USING btree (flagged_at) WHERE (resolved_at IS NULL);

CREATE INDEX dmca_quarantined_objects_active_idx ON public.dmca_quarantined_objects USING btree (file_basename) WHERE (status = 'quarantined'::text);

CREATE UNIQUE INDEX dmca_repeat_infringer_reviews_one_open ON public.dmca_repeat_infringer_reviews USING btree (user_id) WHERE (status = 'open'::text);

CREATE INDEX dmca_repeat_infringer_reviews_user_idx ON public.dmca_repeat_infringer_reviews USING btree (user_id, opened_at DESC);

CREATE INDEX dmca_submissions_case_idx ON public.dmca_submissions USING btree (dmca_case_id);

CREATE INDEX dmca_targets_case_idx ON public.dmca_targets USING btree (dmca_case_id);

CREATE UNIQUE INDEX dmca_targets_case_item_uniq ON public.dmca_targets USING btree (dmca_case_id, content_type, content_id) WHERE (content_id IS NOT NULL);

CREATE INDEX dmca_targets_content_idx ON public.dmca_targets USING btree (content_type, content_id);

CREATE INDEX event_comments_visibility_hidden_idx ON public.event_comments USING btree (visibility_status) WHERE (visibility_status <> 'published'::text);

CREATE INDEX events_visibility_hidden_idx ON public.events USING btree (visibility_status) WHERE (visibility_status <> 'published'::text);

CREATE INDEX for_sale_visits_user_id_idx ON public.for_sale_visits USING btree (user_id);

CREATE INDEX forum_comments_visibility_hidden_idx ON public.forum_comments USING btree (visibility_status) WHERE (visibility_status <> 'published'::text);

CREATE INDEX forum_posts_visibility_hidden_idx ON public.forum_posts USING btree (visibility_status) WHERE (visibility_status <> 'published'::text);

CREATE INDEX forum_read_states_post_id_idx ON public.forum_read_states USING btree (post_id);

CREATE INDEX forum_read_states_user_id_idx ON public.forum_read_states USING btree (user_id);

CREATE INDEX forum_read_states_user_post_idx ON public.forum_read_states USING btree (user_id, post_id);

CREATE INDEX forum_subscriptions_active_idx ON public.forum_subscriptions USING btree (post_id, unsubscribed_at, email_opt_out);

CREATE INDEX forum_subscriptions_post_id_idx ON public.forum_subscriptions USING btree (post_id);

CREATE INDEX forum_subscriptions_user_id_idx ON public.forum_subscriptions USING btree (user_id);

CREATE INDEX idx_analytics_events_event_type ON public.analytics_events USING btree (event_type);

CREATE INDEX idx_analytics_events_session_id ON public.analytics_events USING btree (session_id);

CREATE INDEX idx_analytics_events_user_id ON public.analytics_events USING btree (user_id);

CREATE INDEX idx_analytics_page_views_path ON public.analytics_page_views USING btree (path);

CREATE INDEX idx_analytics_page_views_session_id ON public.analytics_page_views USING btree (session_id);

CREATE INDEX idx_analytics_page_views_user_id ON public.analytics_page_views USING btree (user_id);

CREATE INDEX idx_analytics_sessions_user_id ON public.analytics_sessions USING btree (user_id);

CREATE INDEX idx_forum_subscriptions_active ON public.forum_subscriptions USING btree (post_id, user_id) WHERE ((unsubscribed_at IS NULL) AND (email_opt_out = false));

CREATE INDEX idx_forum_subscriptions_post_id ON public.forum_subscriptions USING btree (post_id);

CREATE INDEX idx_forum_subscriptions_user_id ON public.forum_subscriptions USING btree (user_id);

CREATE INDEX idx_media_files_directory ON public.media_files USING btree (directory);

CREATE INDEX idx_media_files_filename ON public.media_files USING btree (filename);

CREATE INDEX legal_acceptances_user ON public.legal_policy_acceptances USING btree (user_id, version_id);

CREATE INDEX legal_holds_active_content_idx ON public.legal_holds USING btree (content_type, content_id) WHERE (released_at IS NULL);

CREATE INDEX legal_holds_active_user_idx ON public.legal_holds USING btree (user_id) WHERE (released_at IS NULL);

CREATE INDEX message_email_attempts_queue ON public.message_email_attempts USING btree (state);

CREATE INDEX message_email_attempts_request ON public.message_email_attempts USING btree (request_id);

CREATE INDEX message_recipients_message_id_idx ON public.message_recipients USING btree (message_id);

CREATE INDEX message_recipients_recipient_id_idx ON public.message_recipients USING btree (recipient_id);

CREATE INDEX message_recipients_status_idx ON public.message_recipients USING btree (status);

CREATE UNIQUE INDEX message_send_requests_sender_key ON public.message_send_requests USING btree (sender_id, request_key);

CREATE INDEX messages_sender_id_idx ON public.messages USING btree (sender_id);

CREATE INDEX notification_log_sent_at_idx ON public.notification_log USING btree (sent_at);

CREATE INDEX notification_log_user_id_idx ON public.notification_log USING btree (user_id);

CREATE INDEX notification_outbox_due_idx ON public.notification_outbox USING btree (next_attempt_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX notification_queue_created_at_idx ON public.notification_queue USING btree (created_at);

CREATE INDEX notification_queue_processed_idx ON public.notification_queue USING btree (processed);

CREATE INDEX notification_queue_user_id_idx ON public.notification_queue USING btree (user_id);

CREATE INDEX page_contents_visibility_hidden_idx ON public.page_contents USING btree (visibility_status) WHERE (visibility_status <> 'published'::text);

CREATE INDEX real_estate_listings_visibility_hidden_idx ON public.real_estate_listings USING btree (visibility_status) WHERE (visibility_status <> 'published'::text);

CREATE INDEX store_visits_user_id_idx ON public.store_visits USING btree (user_id);

CREATE INDEX support_thread_idx ON public.support_messages USING btree (thread_id);

CREATE INDEX support_user_msg_idx ON public.support_messages USING btree (user_id);

CREATE UNIQUE INDEX user_copyright_events_notice_target_uniq ON public.user_copyright_events USING btree (dmca_target_id, event_type) WHERE ((dmca_target_id IS NOT NULL) AND (event_type = 'notice_received'::text));

CREATE INDEX user_copyright_events_user_idx ON public.user_copyright_events USING btree (user_id);

CREATE INDEX vendor_comments_visibility_hidden_idx ON public.vendor_comments USING btree (visibility_status) WHERE (visibility_status <> 'published'::text);

CREATE INDEX vendor_page_visits_user_id_idx ON public.vendor_page_visits USING btree (user_id);

CREATE INDEX vendor_page_visits_vendor_slug_idx ON public.vendor_page_visits USING btree (vendor_slug);

CREATE INDEX weekly_listings_email_activity_created_at_idx ON public.weekly_listings_email_activity USING btree (created_at DESC);

CREATE UNIQUE INDEX weekly_listings_email_activity_dedupe_idx ON public.weekly_listings_email_activity USING btree (event, week_start) WHERE (event = ANY (ARRAY['skipped_window_missed'::text, 'skipped_already_sent'::text]));

ALTER TABLE public."analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."analytics_page_views" ADD CONSTRAINT "analytics_page_views_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."analytics_sessions" ADD CONSTRAINT "analytics_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."calendar_email_schedule" ADD CONSTRAINT "calendar_email_schedule_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE public."chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;

ALTER TABLE public."comment_subscriptions" ADD CONSTRAINT "comment_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."content" ADD CONSTRAINT "content_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."content_versions" ADD CONSTRAINT "content_versions_content_id_fkey" FOREIGN KEY (content_id) REFERENCES page_contents(id) ON DELETE CASCADE;

ALTER TABLE public."content_versions" ADD CONSTRAINT "content_versions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."custom_forms" ADD CONSTRAINT "custom_forms_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."custom_forms" ADD CONSTRAINT "custom_forms_page_content_id_fkey" FOREIGN KEY (page_content_id) REFERENCES page_contents(id);

ALTER TABLE public."dmca_admin_alerts" ADD CONSTRAINT "dmca_admin_alerts_dmca_case_id_fkey" FOREIGN KEY (dmca_case_id) REFERENCES dmca_cases(id);

ALTER TABLE public."dmca_repeat_infringer_reviews" ADD CONSTRAINT "dmca_repeat_infringer_reviews_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES users(id);

ALTER TABLE public."dmca_repeat_infringer_reviews" ADD CONSTRAINT "dmca_repeat_infringer_reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE public."dmca_submissions" ADD CONSTRAINT "dmca_submissions_dmca_case_id_fkey" FOREIGN KEY (dmca_case_id) REFERENCES dmca_cases(id);

ALTER TABLE public."dmca_targets" ADD CONSTRAINT "dmca_targets_dmca_case_id_fkey" FOREIGN KEY (dmca_case_id) REFERENCES dmca_cases(id);

ALTER TABLE public."event_comments" ADD CONSTRAINT "event_comments_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE public."event_comments" ADD CONSTRAINT "event_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."event_interactions" ADD CONSTRAINT "event_interactions_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE public."event_interactions" ADD CONSTRAINT "event_interactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."event_slug_overrides" ADD CONSTRAINT "event_slug_overrides_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE public."events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."events" ADD CONSTRAINT "events_parent_event_id_fkey" FOREIGN KEY (parent_event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE public."for_sale_visits" ADD CONSTRAINT "for_sale_visits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE public."form_submissions" ADD CONSTRAINT "form_submissions_form_id_fkey" FOREIGN KEY (form_id) REFERENCES custom_forms(id);

ALTER TABLE public."form_submissions" ADD CONSTRAINT "form_submissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."forum_comments" ADD CONSTRAINT "forum_comments_author_id_fkey" FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."forum_comments" ADD CONSTRAINT "forum_comments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE;

ALTER TABLE public."forum_description" ADD CONSTRAINT "forum_description_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."forum_likes" ADD CONSTRAINT "forum_likes_post_id_fkey" FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE;

ALTER TABLE public."forum_likes" ADD CONSTRAINT "forum_likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."forum_posts" ADD CONSTRAINT "forum_posts_author_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."forum_posts" ADD CONSTRAINT "forum_posts_category_id_fkey" FOREIGN KEY (category_id) REFERENCES forum_categories(id);

ALTER TABLE public."forum_reactions" ADD CONSTRAINT "forum_reactions_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES forum_comments(id);

ALTER TABLE public."forum_reactions" ADD CONSTRAINT "forum_reactions_post_id_fkey" FOREIGN KEY (post_id) REFERENCES forum_posts(id);

ALTER TABLE public."forum_reactions" ADD CONSTRAINT "forum_reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."forum_read_states" ADD CONSTRAINT "forum_read_states_last_read_comment_id_fkey" FOREIGN KEY (last_read_comment_id) REFERENCES forum_comments(id);

ALTER TABLE public."forum_read_states" ADD CONSTRAINT "forum_read_states_post_id_fkey" FOREIGN KEY (post_id) REFERENCES forum_posts(id);

ALTER TABLE public."forum_read_states" ADD CONSTRAINT "forum_read_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE public."forum_subscriptions" ADD CONSTRAINT "forum_subscriptions_post_id_fkey" FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE;

ALTER TABLE public."forum_subscriptions" ADD CONSTRAINT "forum_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."legal_policy_acceptances" ADD CONSTRAINT "legal_policy_acceptances_version_id_policy_key_fkey" FOREIGN KEY (version_id, policy_key) REFERENCES legal_policy_versions(id, policy_key);

ALTER TABLE public."legal_policy_current" ADD CONSTRAINT "legal_policy_current_version_id_policy_key_fkey" FOREIGN KEY (version_id, policy_key) REFERENCES legal_policy_versions(id, policy_key);

ALTER TABLE public."message_recipients" ADD CONSTRAINT "message_recipients_message_id_fkey" FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

ALTER TABLE public."message_recipients" ADD CONSTRAINT "message_recipients_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."notification_log" ADD CONSTRAINT "notification_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."notification_queue" ADD CONSTRAINT "notification_queue_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id);

ALTER TABLE public."orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."page_content" ADD CONSTRAINT "page_content_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."page_contents" ADD CONSTRAINT "page_contents_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."page_views" ADD CONSTRAINT "page_views_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(session_id);

ALTER TABLE public."products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."real_estate_listings" ADD CONSTRAINT "real_estate_listings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."site_settings" ADD CONSTRAINT "site_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."sponsorships" ADD CONSTRAINT "sponsorships_listing_id_fkey" FOREIGN KEY (listing_id) REFERENCES real_estate_listings(id);

ALTER TABLE public."sponsorships" ADD CONSTRAINT "sponsorships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."square_payments" ADD CONSTRAINT "square_payments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."storeVisits" ADD CONSTRAINT "storeVisits_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."store_visits" ADD CONSTRAINT "store_visits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE public."user_credits" ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."vendor_comments" ADD CONSTRAINT "vendor_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."vendor_interactions" ADD CONSTRAINT "vendor_interactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."vendor_page_visits" ADD CONSTRAINT "vendor_page_visits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE public."vendor_visits" ADD CONSTRAINT "vendor_visits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE TRIGGER dmca_audit_log_append_only BEFORE DELETE OR UPDATE ON dmca_audit_log FOR EACH ROW EXECUTE FUNCTION dmca_block_mutation();

ALTER TABLE public."dmca_audit_log" ENABLE TRIGGER "dmca_audit_log_append_only";

CREATE TRIGGER legal_dmca_lock BEFORE INSERT OR DELETE OR UPDATE ON dmca_settings FOR EACH STATEMENT EXECUTE FUNCTION legal_source_lock();

ALTER TABLE public."dmca_settings" ENABLE TRIGGER "legal_dmca_lock";

CREATE TRIGGER legal_dmca_publish AFTER INSERT OR DELETE OR UPDATE ON dmca_settings FOR EACH ROW EXECUTE FUNCTION legal_dmca_changed();

ALTER TABLE public."dmca_settings" ENABLE TRIGGER "legal_dmca_publish";

CREATE TRIGGER dmca_submissions_append_only BEFORE DELETE OR UPDATE ON dmca_submissions FOR EACH ROW EXECUTE FUNCTION dmca_block_mutation();

ALTER TABLE public."dmca_submissions" ENABLE TRIGGER "dmca_submissions_append_only";

CREATE TRIGGER event_comments_legal_hold_no_delete BEFORE DELETE ON event_comments FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete();

ALTER TABLE public."event_comments" ENABLE TRIGGER "event_comments_legal_hold_no_delete";

CREATE TRIGGER events_legal_hold_no_delete BEFORE DELETE ON events FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete();

ALTER TABLE public."events" ENABLE TRIGGER "events_legal_hold_no_delete";

CREATE TRIGGER forum_comments_legal_hold_no_delete BEFORE DELETE ON forum_comments FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete();

ALTER TABLE public."forum_comments" ENABLE TRIGGER "forum_comments_legal_hold_no_delete";

CREATE TRIGGER trigger_queue_forum_comment_notification AFTER INSERT ON forum_comments FOR EACH ROW EXECUTE FUNCTION queue_forum_comment_notification();

ALTER TABLE public."forum_comments" ENABLE TRIGGER "trigger_queue_forum_comment_notification";

CREATE TRIGGER forum_posts_legal_hold_no_delete BEFORE DELETE ON forum_posts FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete();

ALTER TABLE public."forum_posts" ENABLE TRIGGER "forum_posts_legal_hold_no_delete";

CREATE TRIGGER legal_acceptances_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON legal_policy_acceptances FOR EACH STATEMENT EXECUTE FUNCTION legal_immutable();

ALTER TABLE public."legal_policy_acceptances" ENABLE TRIGGER "legal_acceptances_immutable";

CREATE TRIGGER legal_versions_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON legal_policy_versions FOR EACH STATEMENT EXECUTE FUNCTION legal_immutable();

ALTER TABLE public."legal_policy_versions" ENABLE TRIGGER "legal_versions_immutable";

CREATE TRIGGER messages_legal_hold_no_delete BEFORE DELETE ON messages FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete();

ALTER TABLE public."messages" ENABLE TRIGGER "messages_legal_hold_no_delete";

CREATE TRIGGER legal_page_lock BEFORE INSERT OR DELETE OR UPDATE ON page_contents FOR EACH STATEMENT EXECUTE FUNCTION legal_source_lock();

ALTER TABLE public."page_contents" ENABLE TRIGGER "legal_page_lock";

CREATE TRIGGER legal_page_publish AFTER INSERT OR DELETE OR UPDATE ON page_contents FOR EACH ROW EXECUTE FUNCTION legal_page_publish();

ALTER TABLE public."page_contents" ENABLE TRIGGER "legal_page_publish";

CREATE TRIGGER page_contents_legal_hold_no_delete BEFORE DELETE ON page_contents FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete();

ALTER TABLE public."page_contents" ENABLE TRIGGER "page_contents_legal_hold_no_delete";

CREATE TRIGGER real_estate_listings_legal_hold_no_delete BEFORE DELETE ON real_estate_listings FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete();

ALTER TABLE public."real_estate_listings" ENABLE TRIGGER "real_estate_listings_legal_hold_no_delete";

CREATE TRIGGER users_legal_hold_no_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete();

ALTER TABLE public."users" ENABLE TRIGGER "users_legal_hold_no_delete";

CREATE TRIGGER vendor_comments_legal_hold_no_delete BEFORE DELETE ON vendor_comments FOR EACH ROW EXECUTE FUNCTION legal_hold_block_delete();

ALTER TABLE public."vendor_comments" ENABLE TRIGGER "vendor_comments_legal_hold_no_delete";
