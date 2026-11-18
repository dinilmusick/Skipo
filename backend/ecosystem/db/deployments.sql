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

-- Old URL-only heartbeat rows remain unclassified until proof of deployment control.
-- This is intentionally idempotent across preview-era migration retries.
ALTER TABLE skipo_ecosystem.deployments
  ALTER COLUMN environment SET DEFAULT 'unclassified';

UPDATE skipo_ecosystem.deployments
SET environment = 'unclassified'
WHERE environment = 'preview'
  AND verification_state = 'unverified'
  AND verification_proof_digest IS NULL;

-- The original preview-only CHECK must be replaced on repeat migrations.
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

-- Publish metadata only. Workflow definitions, graph nodes, source, runtime
-- inputs/outputs and credentials remain in the owning application's workspace.
CREATE TABLE IF NOT EXISTS skipo_ecosystem.workflow_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL
    REFERENCES public."ultrst-apps"(app_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  owner_user_id text NOT NULL CHECK (length(btrim(owner_user_id)) > 0),
  workspace_id text NOT NULL CHECK (length(btrim(workspace_id)) > 0),
  workflow_id text NOT NULL CHECK (length(btrim(workflow_id)) > 0),
  version integer NOT NULL CHECK (version > 0),
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  description text,
  publication_state text NOT NULL DEFAULT 'published'
    CHECK (publication_state IN ('published','withdrawn')),
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  withdrawn_at timestamptz,
  CONSTRAINT workflow_publications_version_unique
    UNIQUE (app_id, owner_user_id, workspace_id, workflow_id, version),
  -- Composite key lets grants prove the publication owner and target workspace.
  CONSTRAINT workflow_publications_grant_target_unique
    UNIQUE (id, owner_user_id, workspace_id),
  CONSTRAINT workflow_publications_withdrawal_consistent
    CHECK (
      (publication_state = 'published' AND withdrawn_at IS NULL)
      OR (publication_state = 'withdrawn' AND withdrawn_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS workflow_publications_discovery
  ON skipo_ecosystem.workflow_publications
    (app_id, workspace_id, publication_state, published_at DESC);

-- An owner-authorized grant binds one caller app + source workspace to the
-- exact target workspace/publication. Revocation is durable and checked on
-- every target-side invocation; it does not delete publication history.
CREATE TABLE IF NOT EXISTS skipo_ecosystem.workflow_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL,
  owner_user_id text NOT NULL,
  target_workspace_id text NOT NULL,
  caller_app_id text NOT NULL
    REFERENCES public."ultrst-apps"(app_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_workspace_id text NOT NULL CHECK (length(btrim(source_workspace_id)) > 0),
  granted_by_user_id text NOT NULL,
  grant_state text NOT NULL DEFAULT 'active'
    CHECK (grant_state IN ('active','revoked')),
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  revoked_by_user_id text,
  CONSTRAINT workflow_grants_publication_target_fkey
    FOREIGN KEY (publication_id, owner_user_id, target_workspace_id)
    REFERENCES skipo_ecosystem.workflow_publications (id, owner_user_id, workspace_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT workflow_grants_owner_approval
    CHECK (granted_by_user_id = owner_user_id),
  CONSTRAINT workflow_grants_owner_revocation
    CHECK (revoked_by_user_id IS NULL OR revoked_by_user_id = owner_user_id),
  CONSTRAINT workflow_grants_revocation_consistent
    CHECK (
      (grant_state = 'active' AND revoked_at IS NULL AND revoked_by_user_id IS NULL)
      OR (grant_state = 'revoked' AND revoked_at IS NOT NULL
          AND revoked_by_user_id = owner_user_id)
    ),
  CONSTRAINT workflow_grants_scope_unique
    UNIQUE (publication_id, caller_app_id, source_workspace_id, target_workspace_id)
);

CREATE INDEX IF NOT EXISTS workflow_grants_caller_scope
  ON skipo_ecosystem.workflow_grants
    (caller_app_id, source_workspace_id, target_workspace_id, grant_state);

CREATE INDEX IF NOT EXISTS workflow_grants_publication_state
  ON skipo_ecosystem.workflow_grants (publication_id, grant_state);

COMMENT ON TABLE skipo_ecosystem.workflow_publications IS
  'Metadata-only published workflow descriptors. Definitions and execution payloads remain in the owning workspace.';
COMMENT ON TABLE skipo_ecosystem.workflow_grants IS
  'Owner-approved app/workspace grants. Target services must reauthorize publication and grant state on every call.';

REVOKE ALL ON ALL TABLES IN SCHEMA skipo_ecosystem FROM PUBLIC;

COMMIT;
