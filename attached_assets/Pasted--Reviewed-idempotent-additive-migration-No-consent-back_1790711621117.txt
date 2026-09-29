-- Reviewed, idempotent, additive migration. No consent backfill.
BEGIN;
SELECT pg_advisory_xact_lock(736201);
CREATE TABLE IF NOT EXISTS legal_policy_defaults (
  id integer PRIMARY KEY CHECK (id=1), sections jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS legal_policy_versions (
  id serial PRIMARY KEY,
  policy_key text NOT NULL CHECK (policy_key IN ('terms','privacy','dmca')),
  title text NOT NULL, url text NOT NULL, content_html text NOT NULL,
  content_hash text NOT NULL, published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  change_notes text,
  UNIQUE(id,policy_key)
);
CREATE TABLE IF NOT EXISTS legal_policy_current (
  policy_key text PRIMARY KEY,
  version_id integer NOT NULL,
  FOREIGN KEY(version_id,policy_key) REFERENCES legal_policy_versions(id,policy_key)
);
CREATE TABLE IF NOT EXISTS legal_policy_acceptances (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL,
  policy_key text NOT NULL,
  version_id integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source text NOT NULL CHECK(source IN ('signup','subsequent')),
  FOREIGN KEY(version_id,policy_key) REFERENCES legal_policy_versions(id,policy_key),
  UNIQUE(user_id,version_id)
);
-- user_id intentionally has no cascading account FK: evidence survives deletion.
ALTER TABLE legal_policy_versions ALTER COLUMN published_at SET DEFAULT clock_timestamp();
ALTER TABLE legal_policy_acceptances ALTER COLUMN accepted_at SET DEFAULT clock_timestamp();
CREATE INDEX IF NOT EXISTS legal_acceptances_user ON legal_policy_acceptances(user_id,version_id);
CREATE OR REPLACE FUNCTION legal_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Legal evidence is immutable'; END $$;
DROP TRIGGER IF EXISTS legal_versions_immutable ON legal_policy_versions;
CREATE TRIGGER legal_versions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON legal_policy_versions
FOR EACH STATEMENT EXECUTE FUNCTION legal_immutable();
DROP TRIGGER IF EXISTS legal_acceptances_immutable ON legal_policy_acceptances;
CREATE TRIGGER legal_acceptances_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON legal_policy_acceptances
FOR EACH STATEMENT EXECUTE FUNCTION legal_immutable();
CREATE OR REPLACE FUNCTION legal_escape(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT replace(replace(replace(replace(replace(coalesce(v,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;')
$$;
CREATE OR REPLACE FUNCTION legal_publish(k text,t text,u text,c text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE old_hash text; h text; v integer;
BEGIN
 PERFORM pg_advisory_xact_lock(736201);
 h := encode(sha256(convert_to(jsonb_build_array(t,u,c)::text,'UTF8')),'hex');
 SELECT p.content_hash INTO old_hash FROM legal_policy_current a JOIN legal_policy_versions p ON p.id=a.version_id WHERE a.policy_key=k;
 IF old_hash IS NOT DISTINCT FROM h THEN RETURN; END IF;
 INSERT INTO legal_policy_versions(policy_key,title,url,content_html,content_hash) VALUES(k,t,u,c,h) RETURNING id INTO v;
 INSERT INTO legal_policy_current VALUES(k,v) ON CONFLICT(policy_key) DO UPDATE SET version_id=excluded.version_id;
END $$;
CREATE OR REPLACE FUNCTION legal_publish_dmca() RETURNS void LANGUAGE plpgsql AS $$
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
END $$;
CREATE OR REPLACE FUNCTION legal_source_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_advisory_xact_lock(736201); RETURN NULL; END $$;
-- Statement locks precede row locks: acceptance and publication cannot race.
DROP TRIGGER IF EXISTS legal_page_lock ON page_contents;
CREATE TRIGGER legal_page_lock BEFORE INSERT OR UPDATE OR DELETE ON page_contents FOR EACH STATEMENT EXECUTE FUNCTION legal_source_lock();
DROP TRIGGER IF EXISTS legal_dmca_lock ON dmca_settings;
CREATE TRIGGER legal_dmca_lock BEFORE INSERT OR UPDATE OR DELETE ON dmca_settings FOR EACH STATEMENT EXECUTE FUNCTION legal_source_lock();
CREATE OR REPLACE FUNCTION legal_page_publish() RETURNS trigger LANGUAGE plpgsql AS $$
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
END $$;
DROP TRIGGER IF EXISTS legal_page_publish ON page_contents;
CREATE TRIGGER legal_page_publish AFTER INSERT OR UPDATE OR DELETE ON page_contents FOR EACH ROW EXECUTE FUNCTION legal_page_publish();
CREATE OR REPLACE FUNCTION legal_dmca_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Published DMCA source cannot be deleted'; END IF;
 PERFORM legal_publish_dmca(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS legal_dmca_publish ON dmca_settings;
CREATE TRIGGER legal_dmca_publish AFTER INSERT OR UPDATE OR DELETE ON dmca_settings FOR EACH ROW EXECUTE FUNCTION legal_dmca_changed();
DO $$
BEGIN
 IF EXISTS(SELECT slug FROM page_contents WHERE slug IN ('terms-and-agreements','privacy-policy') AND NOT is_hidden GROUP BY slug HAVING count(*)>1) THEN
   RAISE EXCEPTION 'Resolve duplicate published legal source rows before migrating';
 END IF;
 IF (SELECT count(*) FROM page_contents WHERE slug IN ('terms-and-agreements','privacy-policy') AND NOT is_hidden)<>2 THEN
   RAISE EXCEPTION 'Both published CMS legal policies are required before migrating';
 END IF;
END $$;
SELECT legal_publish(CASE slug WHEN 'terms-and-agreements' THEN 'terms' ELSE 'privacy' END,title,CASE slug WHEN 'terms-and-agreements' THEN '/terms' ELSE '/privacy' END,content)
FROM page_contents WHERE slug IN ('terms-and-agreements','privacy-policy') AND NOT is_hidden ORDER BY id;
SELECT legal_publish_dmca();
COMMIT;