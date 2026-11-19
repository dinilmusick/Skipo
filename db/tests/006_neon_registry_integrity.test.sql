-- Run after normalized schema, 20261118 guardrails and E2E03 integrity.
-- The caller's transaction must roll back the test; standalone psql also does.
BEGIN;
DO $test$
DECLARE new_app text := 'e2e03-db-fixture-20261119'; dep uuid;
BEGIN
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='skipo_ecosystem' AND c.relname IN
      ('deployments','invocations','deployment_capability_revisions','workflow_publications','workflow_grants')
      AND c.relrowsecurity) <> 5 THEN
    RAISE EXCEPTION 'FAIL: default-deny registry RLS missing';
  END IF;
  INSERT INTO public."ultrst-apps"(id,app_id,name)
  VALUES(new_app,new_app,'Isolated test app');
  INSERT INTO skipo_ecosystem.deployments
    (app_id,app_url,capabilities,environment,verification_state,
     verification_proof_digest,lease_expires_at)
  VALUES(new_app,'https://neon-e2e03.invalid',ARRAY[]::text[],
     'preview','verified',repeat('f',64),clock_timestamp()+interval '1 hour')
  RETURNING deployment_id INTO dep;
  INSERT INTO skipo_ecosystem.deployment_capability_revisions
    (deployment_id,revision,descriptors) VALUES(dep,1,'[]'::jsonb);
  BEGIN
    UPDATE skipo_ecosystem.deployment_capability_revisions
       SET descriptors='[{"operation":"tampered"}]'::jsonb WHERE deployment_id=dep;
    RAISE EXCEPTION 'FAIL: capability revision mutated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM skipo_ecosystem.deployment_capability_revisions WHERE deployment_id=dep;
    RAISE EXCEPTION 'FAIL: capability revision deleted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO skipo_ecosystem.deployment_capability_revisions
      (deployment_id,revision,descriptors) VALUES(dep,3,'[]'::jsonb);
    RAISE EXCEPTION 'FAIL: skipped revision accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE skipo_ecosystem.deployments SET verification_state='revoked'
    WHERE deployment_id=dep;
  BEGIN
    UPDATE skipo_ecosystem.deployments SET verification_state='verified'
      WHERE deployment_id=dep;
    RAISE EXCEPTION 'FAIL: revoked deployment restored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM skipo_ecosystem.deployments WHERE deployment_id=dep;
    RAISE EXCEPTION 'FAIL: revoked deployment deleted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$test$;
ROLLBACK;
