-- Administrative DMCA review flags (idempotent; apply with psql).
CREATE TABLE IF NOT EXISTS dmca_content_flags (
  id serial PRIMARY KEY,
  content_type text NOT NULL,
  content_id integer NOT NULL,
  reason text NOT NULL,
  flagged_by integer NOT NULL,
  flagged_at timestamp NOT NULL DEFAULT now(),
  resolved_at timestamp,
  resolved_by integer,
  resolution text,
  dmca_case_id integer
);
CREATE INDEX IF NOT EXISTS dmca_content_flags_open_idx
  ON dmca_content_flags (flagged_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS dmca_content_flags_content_idx
  ON dmca_content_flags (content_type, content_id);
-- One row per item per case (duplicates would break restore).
CREATE UNIQUE INDEX IF NOT EXISTS dmca_targets_case_item_uniq ON dmca_targets (dmca_case_id, content_type, content_id) WHERE content_id IS NOT NULL;
