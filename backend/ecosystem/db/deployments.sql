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

-- Remove the preview-era CHECK before reclassifying rows to unclassified.
ALTER TABLE skipo_ecosystem.deployments
  DROP CONSTRAINT IF EXISTS deployments_environment_check;

-- Reclassify rows created under the earlier inferred-preview default when no
-- deployment-control proof exists. Preserve explicitly verified rows.
UPDATE skipo_ecosystem.deployments
SET environment = 'unclassified'
WHERE environment = 'preview'
  AND verification_state = 'unverified'
  AND verification_proof_digest IS NULL;

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
