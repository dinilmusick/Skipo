BEGIN;

CREATE SCHEMA IF NOT EXISTS skipo_ecosystem;
REVOKE ALL ON SCHEMA skipo_ecosystem FROM PUBLIC;

CREATE TABLE IF NOT EXISTS skipo_ecosystem.deployments (
  app_id text NOT NULL CHECK (app_id ~ '^[a-z][a-z0-9-]{0,62}$'),
  app_url text NOT NULL,
  capabilities text[] NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_refresh_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (app_id, app_url)
);

CREATE INDEX IF NOT EXISTS deployments_by_refresh
  ON skipo_ecosystem.deployments (app_id, last_refresh_at DESC, app_url);

-- Additive v2 identity migration. Old (app_id, app_url) upserts still work.
-- Application IDs come ONLY from public."ultrst-apps"; deployments never mint apps.
ALTER TABLE skipo_ecosystem.deployments
  ADD COLUMN IF NOT EXISTS deployment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS verification_state text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_proof_digest text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS deployments_by_immutable_id
  ON skipo_ecosystem.deployments (deployment_id);

-- Existing and legacy-heartbeat rows stay unclassified until an owner proves their environment.
ALTER TABLE skipo_ecosystem.deployments
  ALTER COLUMN environment SET DEFAULT 'unclassified';

-- Reclassify rows created under the earlier inferred-preview default when no
-- deployment-control proof exists. Preserve explicitly verified rows.
UPDATE skipo_ecosystem.deployments
SET environment = 'unclassified'
WHERE environment = 'preview'
  AND verification_state = 'unverified'
  AND verification_proof_digest IS NULL;

-- Replace the original four-state constraint on repeat runs as well.
ALTER TABLE skipo_ecosystem.deployments
  DROP CONSTRAINT IF EXISTS deployments_environment_check;

-- Re-runnable on existing databases without breaking the old composite PK.
DO $deployment_identity$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='skipo_ecosystem.deployments'::regclass
      AND conname='deployments_canonical_app_fkey'
  ) THEN
    ALTER TABLE skipo_ecosystem.deployments
      ADD CONSTRAINT deployments_canonical_app_fkey
      FOREIGN KEY (app_id) REFERENCES public."ultrst-apps"(app_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='skipo_ecosystem.deployments'::regclass
      AND conname='deployments_environment_check'
  ) THEN
    ALTER TABLE skipo_ecosystem.deployments
      ADD CONSTRAINT deployments_environment_check CHECK
      (environment IN ('unclassified','development','preview','staging','production'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='skipo_ecosystem.deployments'::regclass
      AND conname='deployments_verification_state_check'
  ) THEN
    ALTER TABLE skipo_ecosystem.deployments
      ADD CONSTRAINT deployments_verification_state_check CHECK
      (verification_state IN ('unverified','verified','revoked'));
  END IF;
END;
$deployment_identity$;

-- A deployment may move to another URL, but NEVER to another application/ID.
CREATE OR REPLACE FUNCTION skipo_ecosystem.reject_deployment_identity_change()
RETURNS trigger LANGUAGE plpgsql AS $deployment_identity$
BEGIN
  IF NEW.app_id IS DISTINCT FROM OLD.app_id
     OR NEW.deployment_id IS DISTINCT FROM OLD.deployment_id THEN
    RAISE EXCEPTION 'deployment_id and app_id are immutable per deployment'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$deployment_identity$;

DROP TRIGGER IF EXISTS deployments_identity_immutable ON skipo_ecosystem.deployments;
CREATE TRIGGER deployments_identity_immutable
  BEFORE UPDATE ON skipo_ecosystem.deployments
  FOR EACH ROW EXECUTE FUNCTION skipo_ecosystem.reject_deployment_identity_change();

-- No existing registration is classified verified without deployment-control proof.
-- Verification status/lease are reserved for separately authorized registry writers.


-- Validate descriptor JSON recursively at the database boundary as well as in
-- the TypeScript publisher. Descriptors contain public static metadata only.
CREATE OR REPLACE FUNCTION skipo_ecosystem.static_capability_descriptors_safe(p_value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT AS $descriptor_safety$
DECLARE item record;
BEGIN
  IF jsonb_typeof(p_value) = 'object' THEN
    FOR item IN SELECT key, value FROM jsonb_each(p_value) LOOP
      IF item.key ~* '(secret|token|session|endpoint|url|credential|authorization|password|cookie|bearer|((api|access|private|public|client|server|signing|encryption|ssh|tls|jwt|oauth|kms)[_-]?key)|(key[_-]?(material|secret)|^key$))'
         OR NOT skipo_ecosystem.static_capability_descriptors_safe(item.value) THEN
        RETURN false;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
      IF NOT skipo_ecosystem.static_capability_descriptors_safe(item.value) THEN
        RETURN false;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(p_value) = 'string' THEN
    IF (p_value #>> '{}') ~* '([a-z][a-z0-9+.-]*://|bearer[[:space:]]+|eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}[.]|-----BEGIN [A-Z ]*PRIVATE KEY-----|((api|client|private)[_-]?(key|secret))[[:space:]]*[:=][[:space:]]*[^[:space:]]+)' THEN
      RETURN false;
    END IF;
  END IF;
  RETURN true;
END;
$descriptor_safety$;

-- Immutable, per-deployment snapshots of static callable capability metadata.
-- Never store user workflows, session URLs, bearer material or secrets here.
CREATE TABLE IF NOT EXISTS skipo_ecosystem.deployment_capability_revisions (
  deployment_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  descriptors jsonb NOT NULL
    CHECK (jsonb_typeof(descriptors) = 'array' AND jsonb_array_length(descriptors) <= 256),
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT deployment_capability_revisions_pkey PRIMARY KEY (deployment_id, revision),
  CONSTRAINT deployment_capability_revisions_deployment_id_fkey
    FOREIGN KEY (deployment_id) REFERENCES skipo_ecosystem.deployments(deployment_id)
    ON DELETE RESTRICT,
  CONSTRAINT deployment_capability_revisions_safe_descriptors
    CHECK (skipo_ecosystem.static_capability_descriptors_safe(descriptors))
);

-- Existing N4 draft databases may already have the table without the recursive
-- safety check and with ON DELETE CASCADE. Reconcile both on every run.
DO $capability_revision_schema$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='skipo_ecosystem.deployment_capability_revisions'::regclass
      AND conname='deployment_capability_revisions_safe_descriptors'
  ) THEN
    ALTER TABLE skipo_ecosystem.deployment_capability_revisions
      ADD CONSTRAINT deployment_capability_revisions_safe_descriptors
      CHECK (skipo_ecosystem.static_capability_descriptors_safe(descriptors));
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='skipo_ecosystem.deployment_capability_revisions'::regclass
      AND conname='deployment_capability_revisions_deployment_id_fkey'
  ) THEN
    ALTER TABLE skipo_ecosystem.deployment_capability_revisions
      DROP CONSTRAINT deployment_capability_revisions_deployment_id_fkey;
  END IF;
  ALTER TABLE skipo_ecosystem.deployment_capability_revisions
    ADD CONSTRAINT deployment_capability_revisions_deployment_id_fkey
    FOREIGN KEY (deployment_id) REFERENCES skipo_ecosystem.deployments(deployment_id)
    ON DELETE RESTRICT;
END;
$capability_revision_schema$;

CREATE INDEX IF NOT EXISTS deployment_capability_revisions_latest
  ON skipo_ecosystem.deployment_capability_revisions
    (deployment_id, revision DESC);

-- Direct SQL writers cannot publish for an unverified or expired deployment,
-- skip a revision number, or rewrite/delete an already published snapshot.
CREATE OR REPLACE FUNCTION skipo_ecosystem.validate_deployment_capability_revision()
RETURNS trigger LANGUAGE plpgsql AS $capability_revision$
DECLARE
  deployment_state text;
  deployment_lease timestamptz;
  expected_revision bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.deployment_id::text, 0));
  SELECT verification_state, lease_expires_at
    INTO deployment_state, deployment_lease
  FROM skipo_ecosystem.deployments
  WHERE deployment_id = NEW.deployment_id
  FOR SHARE;
  IF NOT FOUND OR deployment_state <> 'verified'
     OR deployment_lease IS NULL OR deployment_lease <= statement_timestamp() THEN
    RAISE EXCEPTION 'capability revisions require a verified deployment with a live lease'
      USING ERRCODE='23514';
  END IF;
  SELECT COALESCE(MAX(revision), 0) + 1 INTO expected_revision
  FROM skipo_ecosystem.deployment_capability_revisions
  WHERE deployment_id = NEW.deployment_id;
  IF NEW.revision <> expected_revision THEN
    RAISE EXCEPTION 'capability revision must be the next monotonic revision'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$capability_revision$;

CREATE OR REPLACE FUNCTION skipo_ecosystem.reject_capability_revision_mutation()
RETURNS trigger LANGUAGE plpgsql AS $capability_revision$
BEGIN
  RAISE EXCEPTION 'published capability revisions are immutable'
    USING ERRCODE='23514';
  RETURN NULL;
END;
$capability_revision$;

DROP TRIGGER IF EXISTS deployment_capability_revision_validate
  ON skipo_ecosystem.deployment_capability_revisions;
CREATE TRIGGER deployment_capability_revision_validate
  BEFORE INSERT ON skipo_ecosystem.deployment_capability_revisions
  FOR EACH ROW EXECUTE FUNCTION skipo_ecosystem.validate_deployment_capability_revision();

DROP TRIGGER IF EXISTS deployment_capability_revision_immutable
  ON skipo_ecosystem.deployment_capability_revisions;
CREATE TRIGGER deployment_capability_revision_immutable
  BEFORE UPDATE OR DELETE ON skipo_ecosystem.deployment_capability_revisions
  FOR EACH ROW EXECUTE FUNCTION skipo_ecosystem.reject_capability_revision_mutation();

COMMENT ON TABLE skipo_ecosystem.deployment_capability_revisions IS
  'Immutable complete static capability snapshots per verified, leased deployment; never user workflow or secret material.';

CREATE TABLE IF NOT EXISTS skipo_ecosystem.invocations (
  id uuid PRIMARY KEY,
  caller_app text NOT NULL,
  target_app text NOT NULL,
  target_url text NOT NULL,
  capability text NOT NULL,
  user_id text,
  params jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS invocations_by_expiry
  ON skipo_ecosystem.invocations (expires_at);
REVOKE ALL ON ALL TABLES IN SCHEMA skipo_ecosystem FROM PUBLIC;

COMMIT;
