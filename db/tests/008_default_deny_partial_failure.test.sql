-- E2E03: production-derived isolated-branch negative RLS and partial-failure tests.
-- Run only on a disposable isolated Neon branch with canonical SQL applied.
-- psql -X -v ON_ERROR_STOP=1 -f db/tests/008_default_deny_partial_failure.test.sql
-- No persistent principal grants, extra roles, or test data: outer ROLLBACK.
BEGIN;

-- Use the actual backend owner context to stage a publication that must not
-- become visible if a nonprivileged consumer is accidentally granted SELECT.
INSERT INTO skipo_ecosystem.workflow_publications
  (app_id,owner_user_id,workspace_id,workflow_id,version,display_name)
VALUES ('aiko','e2e03-owner','e2e03-private-ws','e2e03-private-flow',1,
        'Temporary RLS inspection row');

DO $checks$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM skipo_ecosystem.workflow_publications
   WHERE owner_user_id='e2e03-owner' AND workflow_id='e2e03-private-flow';
  IF n<>1 THEN
    RAISE EXCEPTION 'Test setup failed to create private publication';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
      WHERE ns.nspname='skipo_ecosystem'
        AND c.relname IN ('deployments','invocations','deployment_capability_revisions',
                          'workflow_publications','workflow_grants')
        AND c.relrowsecurity) <> 5 THEN
    RAISE EXCEPTION 'Default-deny RLS not active on all five registry tables';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='skipo_ecosystem'
        AND tablename IN ('deployments','invocations','deployment_capability_revisions',
                          'workflow_publications','workflow_grants')) <> 0 THEN
    RAISE EXCEPTION 'Unexpected permissive registry RLS policies exist';
  END IF;
END $checks$;

CREATE ROLE e2e03_isolated_untrusted NOLOGIN;
DO $role$
BEGIN
  EXECUTE format('GRANT e2e03_isolated_untrusted TO %I',current_user);
END $role$;
GRANT USAGE ON SCHEMA skipo_ecosystem TO e2e03_isolated_untrusted;
GRANT SELECT ON skipo_ecosystem.workflow_publications TO e2e03_isolated_untrusted;
SET LOCAL ROLE e2e03_isolated_untrusted;
DO $checks$
BEGIN
 IF (SELECT count(*) FROM skipo_ecosystem.workflow_publications
     WHERE owner_user_id='e2e03-owner') <> 0 THEN
   RAISE EXCEPTION 'Unprivileged role saw another workspace publication';
 END IF;
END $checks$;
RESET ROLE;

-- Intentionally stage a legacy verified row with no proof or lease in a nested
-- savepoint. The guardrail VALIDATE must fail, rolling back the entire inner
-- block including dropped checks and inserted row.
DO $partial$
DECLARE before_count bigint; after_count bigint;
BEGIN
 SELECT count(*) INTO before_count FROM skipo_ecosystem.deployments;
 BEGIN
   ALTER TABLE skipo_ecosystem.deployments
     DROP CONSTRAINT deployments_verified_evidence_guard;
   ALTER TABLE skipo_ecosystem.deployments
     DROP CONSTRAINT deployments_verified_proof_required;
   INSERT INTO skipo_ecosystem.deployments
     (app_id,app_url,capabilities,environment,verification_state,
      verification_proof_digest,lease_expires_at)
   VALUES ('aiko','https://e2e03-invalid-verified.invalid',ARRAY[]::text[],
           'production','verified',NULL,NULL);
   ALTER TABLE skipo_ecosystem.deployments
     ADD CONSTRAINT deployments_verified_evidence_guard
     CHECK (verification_state<>'verified'
            OR (environment IN ('development','preview','staging','production')
                 AND NULLIF(btrim(verification_proof_digest),'') IS NOT NULL
                 AND lease_expires_at IS NOT NULL)) NOT VALID;
   ALTER TABLE skipo_ecosystem.deployments
     VALIDATE CONSTRAINT deployments_verified_evidence_guard;
   RAISE EXCEPTION 'Unexpected success of invalid verified deployment migration';
 EXCEPTION WHEN check_violation THEN
   NULL;
 END;
 SELECT count(*) INTO after_count FROM skipo_ecosystem.deployments;
 IF after_count<>before_count
    OR EXISTS (SELECT 1 FROM skipo_ecosystem.deployments
               WHERE app_url='https://e2e03-invalid-verified.invalid') THEN
   RAISE EXCEPTION 'Partial failure left an invalid deployment behind';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
   WHERE conrelid='skipo_ecosystem.deployments'::regclass
     AND conname='deployments_verified_evidence_guard' AND convalidated)
   OR NOT EXISTS(SELECT 1 FROM pg_constraint
   WHERE conrelid='skipo_ecosystem.deployments'::regclass
     AND conname='deployments_verified_proof_required' AND convalidated)
 THEN RAISE EXCEPTION 'Partial failure broke existing validated constraints';
 END IF;
END $partial$;

ROLLBACK;
