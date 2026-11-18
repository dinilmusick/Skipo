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

-- The old preview-only CHECK must be removed before unclassified rows are backfilled.
ALTER TABLE skipo_ecosystem.deployments
  DROP CONSTRAINT IF EXISTS deployments_environment_check;

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

-- Structural proof gate: a deployment cannot be marked verified while its
-- ownership proof digest or lease expiry is missing. Presence of these fields
-- is NOT an attestation; only a separately authenticated registry authority
-- may validate proof, set verification_state and issue or renew leases.
-- Keep prior entries unchanged and fail rather than silently approving them.
DO $deployment_proof_gate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM skipo_ecosystem.deployments
    WHERE verification_state = 'verified'
      AND (NULLIF(btrim(verification_proof_digest), '') IS NULL
        OR lease_expires_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'verified deployments without proof digest or lease require review'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'skipo_ecosystem.deployments'::regclass
      AND conname = 'deployments_verified_proof_required'
  ) THEN
    ALTER TABLE skipo_ecosystem.deployments
      ADD CONSTRAINT deployments_verified_proof_required
      CHECK (
        verification_state <> 'verified'
        OR (
          NULLIF(btrim(verification_proof_digest), '') IS NOT NULL
          AND lease_expires_at IS NOT NULL
        )
      );
  END IF;
END;
$deployment_proof_gate$;

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


-- Immutable, per-deployment snapshots of static callable capability metadata.
-- Never store user workflow definitions, session URLs, bearer material or secrets here.
CREATE TABLE IF NOT EXISTS skipo_ecosystem.deployment_capability_revisions (
  deployment_id uuid NOT NULL
    REFERENCES skipo_ecosystem.deployments(deployment_id) ON DELETE CASCADE,
  revision bigint NOT NULL CHECK (revision > 0),
  descriptors jsonb NOT NULL
    CHECK (jsonb_typeof(descriptors) = 'array' AND jsonb_array_length(descriptors) <= 256),
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (deployment_id, revision)
);

CREATE INDEX IF NOT EXISTS deployment_capability_revisions_latest
  ON skipo_ecosystem.deployment_capability_revisions
    (deployment_id, revision DESC);

-- Publish metadata only. Workflow definitions, graph nodes, source, runtime
-- inputs/outputs and credentials remain in the owning application's workspace.
CREATE TABLE IF NOT EXISTS skipo_ecosystem.workflow_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL REFERENCES public."ultrst-apps"(app_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
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
  CONSTRAINT workflow_publications_grant_target_unique
    UNIQUE (id, owner_user_id, workspace_id),
  CONSTRAINT workflow_publications_withdrawal_consistent CHECK (
    (publication_state = 'published' AND withdrawn_at IS NULL)
    OR (publication_state = 'withdrawn' AND withdrawn_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS workflow_publications_discovery
  ON skipo_ecosystem.workflow_publications
    (app_id, workspace_id, publication_state, published_at DESC);

-- Grants are immutable scope records. Revocation is one-way; re-grants create
-- new rows so old revocations remain auditable.
CREATE TABLE IF NOT EXISTS skipo_ecosystem.workflow_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL,
  owner_user_id text NOT NULL,
  target_workspace_id text NOT NULL,
  caller_app_id text NOT NULL REFERENCES public."ultrst-apps"(app_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
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
  CONSTRAINT workflow_grants_owner_approval CHECK (granted_by_user_id = owner_user_id),
  CONSTRAINT workflow_grants_owner_revocation
    CHECK (revoked_by_user_id IS NULL OR revoked_by_user_id = owner_user_id),
  CONSTRAINT workflow_grants_revocation_consistent CHECK (
    (grant_state = 'active' AND revoked_at IS NULL AND revoked_by_user_id IS NULL)
    OR (grant_state = 'revoked' AND revoked_at IS NOT NULL
        AND revoked_by_user_id = owner_user_id)
  )
);
-- Remove the earlier all-history scope uniqueness from the first N5 draft;
-- revoked rows must coexist with a later new grant for the same scope.
ALTER TABLE skipo_ecosystem.workflow_grants
  DROP CONSTRAINT IF EXISTS workflow_grants_scope_unique;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_grants_one_active_scope
  ON skipo_ecosystem.workflow_grants
    (publication_id, caller_app_id, source_workspace_id, target_workspace_id)
  WHERE grant_state = 'active';
CREATE INDEX IF NOT EXISTS workflow_grants_caller_scope
  ON skipo_ecosystem.workflow_grants
    (caller_app_id, source_workspace_id, target_workspace_id, grant_state);
CREATE INDEX IF NOT EXISTS workflow_grants_publication_state
  ON skipo_ecosystem.workflow_grants (publication_id, grant_state);

CREATE OR REPLACE FUNCTION skipo_ecosystem.enforce_workflow_registry_immutability()
RETURNS trigger LANGUAGE plpgsql AS $workflow_immutability$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'workflow publication and grant history cannot be deleted'
      USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME = 'workflow_publications' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.app_id IS DISTINCT FROM OLD.app_id
       OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.workflow_id IS DISTINCT FROM OLD.workflow_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.display_name IS DISTINCT FROM OLD.display_name
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION 'workflow publication identity and version are immutable'
        USING ERRCODE='23514';
    END IF;
    IF OLD.publication_state = 'withdrawn'
       AND (NEW.publication_state IS DISTINCT FROM OLD.publication_state
            OR NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at) THEN
      RAISE EXCEPTION 'workflow publication withdrawal is permanent'
        USING ERRCODE='23514';
    END IF;
    IF OLD.publication_state = 'published'
       AND NEW.publication_state = 'published'
       AND NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at THEN
      RAISE EXCEPTION 'withdrawn_at may only be set while withdrawing a publication'
        USING ERRCODE='23514';
    END IF;
    IF OLD.publication_state = 'published'
       AND NEW.publication_state = 'withdrawn'
       AND NEW.withdrawn_at IS NULL THEN
      RAISE EXCEPTION 'workflow publication withdrawal requires a timestamp'
        USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'workflow_grants' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.publication_id IS DISTINCT FROM OLD.publication_id
       OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.target_workspace_id IS DISTINCT FROM OLD.target_workspace_id
       OR NEW.caller_app_id IS DISTINCT FROM OLD.caller_app_id
       OR NEW.source_workspace_id IS DISTINCT FROM OLD.source_workspace_id
       OR NEW.granted_by_user_id IS DISTINCT FROM OLD.granted_by_user_id
       OR NEW.granted_at IS DISTINCT FROM OLD.granted_at THEN
      RAISE EXCEPTION 'workflow grant scope and grantor are immutable'
        USING ERRCODE='23514';
    END IF;
    IF OLD.grant_state = 'revoked'
       AND (NEW.grant_state IS DISTINCT FROM OLD.grant_state
            OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
            OR NEW.revoked_by_user_id IS DISTINCT FROM OLD.revoked_by_user_id) THEN
      RAISE EXCEPTION 'workflow grant revocation is permanent; create a new grant'
        USING ERRCODE='23514';
    END IF;
    IF OLD.grant_state = 'active'
       AND NEW.grant_state = 'revoked'
       AND (NEW.revoked_at IS NULL OR NEW.revoked_by_user_id IS DISTINCT FROM OLD.owner_user_id) THEN
      RAISE EXCEPTION 'workflow grant revocation requires the owner and a timestamp'
        USING ERRCODE='23514';
    END IF;
    IF OLD.grant_state = 'active'
       AND NEW.grant_state = 'active'
       AND (NEW.revoked_at IS NOT NULL OR NEW.revoked_by_user_id IS NOT NULL) THEN
      RAISE EXCEPTION 'active workflow grants cannot carry revocation metadata'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$workflow_immutability$;

DROP TRIGGER IF EXISTS workflow_publications_immutable
  ON skipo_ecosystem.workflow_publications;
CREATE TRIGGER workflow_publications_immutable
  BEFORE UPDATE OR DELETE ON skipo_ecosystem.workflow_publications
  FOR EACH ROW EXECUTE FUNCTION skipo_ecosystem.enforce_workflow_registry_immutability();
DROP TRIGGER IF EXISTS workflow_grants_immutable
  ON skipo_ecosystem.workflow_grants;
CREATE TRIGGER workflow_grants_immutable
  BEFORE UPDATE OR DELETE ON skipo_ecosystem.workflow_grants
  FOR EACH ROW EXECUTE FUNCTION skipo_ecosystem.enforce_workflow_registry_immutability();

CREATE OR REPLACE FUNCTION skipo_ecosystem.require_published_workflow_for_grant()
RETURNS trigger LANGUAGE plpgsql AS $workflow_grant$
DECLARE publication_state text;
BEGIN
  SELECT p.publication_state INTO publication_state
  FROM skipo_ecosystem.workflow_publications p
  WHERE p.id = NEW.publication_id
    AND p.owner_user_id = NEW.owner_user_id
    AND p.workspace_id = NEW.target_workspace_id
  FOR SHARE;
  IF publication_state IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'workflow grants require a currently published workflow'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$workflow_grant$;
DROP TRIGGER IF EXISTS workflow_grants_require_published
  ON skipo_ecosystem.workflow_grants;
CREATE TRIGGER workflow_grants_require_published
  BEFORE INSERT ON skipo_ecosystem.workflow_grants
  FOR EACH ROW EXECUTE FUNCTION skipo_ecosystem.require_published_workflow_for_grant();

COMMENT ON TABLE skipo_ecosystem.workflow_publications IS
  'Metadata-only workflow descriptors. Identity/version are immutable; withdrawal is one-way.';
COMMENT ON TABLE skipo_ecosystem.workflow_grants IS
  'Immutable owner-approved app/workspace grants. Revocation is permanent; re-grants create new rows.';

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
