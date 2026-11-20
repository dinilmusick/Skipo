-- E2E03 additive DB authority checks. Requires normalized Skipo #198 equivalent
-- and 20261118_canonical_neon_guardrails.sql. Never automatically applied.
BEGIN;
-- Keep registry tables private even when a future grant accidentally widens ACL.
REVOKE ALL ON SCHEMA skipo_ecosystem FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA skipo_ecosystem FROM PUBLIC;
ALTER TABLE skipo_ecosystem.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE skipo_ecosystem.invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE skipo_ecosystem.deployment_capability_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE skipo_ecosystem.workflow_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE skipo_ecosystem.workflow_grants ENABLE ROW LEVEL SECURITY;
-- No public/user RLS policies: only the privileged, target-authorizing backend
-- uses this schema. Principal and workspace ACLs are checked at invocation.

CREATE OR REPLACE FUNCTION skipo_ecosystem.e2e03_reject_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $history$
BEGIN
  IF TG_TABLE_NAME='deployment_capability_revisions' THEN
    RAISE EXCEPTION 'published capability revision is immutable'
      USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='deployments' THEN
    IF TG_OP='DELETE' THEN
      RAISE EXCEPTION 'deployment identity is retired through revocation, not deletion'
        USING ERRCODE='23514';
    END IF;
    IF OLD.verification_state='revoked'
      AND (NEW.verification_state IS DISTINCT FROM OLD.verification_state
        OR NEW.verification_proof_digest IS DISTINCT FROM OLD.verification_proof_digest
        OR NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at) THEN
      RAISE EXCEPTION 'revoked deployment may not be reverified or renewed'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$history$;

CREATE OR REPLACE FUNCTION skipo_ecosystem.e2e03_validate_revision_insert()
RETURNS trigger LANGUAGE plpgsql AS $revision$
DECLARE d record; prior_revision bigint;
BEGIN
  -- Lock the deployment row: concurrent revision writers serialize here.
  SELECT verification_state, verification_proof_digest, lease_expires_at,
         environment INTO d
    FROM skipo_ecosystem.deployments
    WHERE deployment_id=NEW.deployment_id FOR UPDATE;
  IF NOT FOUND OR d.verification_state IS DISTINCT FROM 'verified'
     OR NULLIF(btrim(d.verification_proof_digest),'') IS NULL
     OR d.lease_expires_at IS NULL OR d.lease_expires_at <= clock_timestamp()
     OR d.environment NOT IN ('development','preview','staging','production') THEN
    RAISE EXCEPTION 'capability revision requires live proof-backed deployment'
      USING ERRCODE='23514';
  END IF;
  SELECT COALESCE(MAX(revision),0) INTO prior_revision
    FROM skipo_ecosystem.deployment_capability_revisions
    WHERE deployment_id=NEW.deployment_id;
  IF NEW.revision <> prior_revision+1 THEN
    RAISE EXCEPTION 'capability revision must be strictly sequential'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$revision$;

DROP TRIGGER IF EXISTS e2e03_deployment_history_guard ON skipo_ecosystem.deployments;
CREATE TRIGGER e2e03_deployment_history_guard
  BEFORE UPDATE OR DELETE ON skipo_ecosystem.deployments
  FOR EACH ROW EXECUTE FUNCTION skipo_ecosystem.e2e03_reject_history_mutation();
DROP TRIGGER IF EXISTS e2e03_capability_revision_history_guard ON skipo_ecosystem.deployment_capability_revisions;
CREATE TRIGGER e2e03_capability_revision_history_guard
  BEFORE UPDATE OR DELETE ON skipo_ecosystem.deployment_capability_revisions
  FOR EACH ROW EXECUTE FUNCTION skipo_ecosystem.e2e03_reject_history_mutation();
DROP TRIGGER IF EXISTS e2e03_capability_revision_insert_guard ON skipo_ecosystem.deployment_capability_revisions;
CREATE TRIGGER e2e03_capability_revision_insert_guard
  BEFORE INSERT ON skipo_ecosystem.deployment_capability_revisions
  FOR EACH ROW EXECUTE FUNCTION skipo_ecosystem.e2e03_validate_revision_insert();

REVOKE ALL ON FUNCTION skipo_ecosystem.e2e03_reject_history_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION skipo_ecosystem.e2e03_validate_revision_insert() FROM PUBLIC;
COMMIT;
