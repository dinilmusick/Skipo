-- Execute ONLY on an isolated Neon development branch after the N2 + N4 migrations.
-- The nested exception subtransaction leaves no deployment or revision fixtures.
DO $capability_revision_test$
DECLARE
  deployment_one uuid := gen_random_uuid();
  deployment_two uuid := gen_random_uuid();
  deployment_expired uuid := gen_random_uuid();
  deployment_unverified uuid := gen_random_uuid();
  oversized jsonb;
BEGIN
  BEGIN
    INSERT INTO skipo_ecosystem.deployments
      (app_id, app_url, capabilities, deployment_id, environment,
       verification_state, verification_proof_digest, lease_expires_at)
    VALUES
      ('aiko', 'https://n4-test-one.example', ARRAY['workspace.list'],
       deployment_one, 'development', 'verified', 'n4-test-proof-one',
       clock_timestamp() + interval '1 hour'),
      ('aiko', 'https://n4-test-two.example', ARRAY['workspace.list'],
       deployment_two, 'development', 'verified', 'n4-test-proof-two',
       clock_timestamp() + interval '1 hour'),
      ('aiko', 'https://n4-test-expired.example', ARRAY['workspace.list'],
       deployment_expired, 'development', 'verified', 'n4-test-proof-expired',
       clock_timestamp() - interval '1 hour'),
      ('aiko', 'https://n4-test-unverified.example', ARRAY['workspace.list'],
       deployment_unverified, 'development', 'unverified', NULL,
       clock_timestamp() + interval '1 hour');

    INSERT INTO skipo_ecosystem.deployment_capability_revisions
      (deployment_id, revision, descriptors)
    VALUES
      (deployment_one, 1, '[]'::jsonb),
      (deployment_two, 1, '[]'::jsonb),
      (deployment_one, 2, '[{"id":"workspace.read","description":"Read workspace metadata"}]'::jsonb);

    IF (SELECT count(*) FROM skipo_ecosystem.deployment_capability_revisions
        WHERE deployment_id=deployment_one) <> 2
       OR (SELECT count(*) FROM skipo_ecosystem.deployment_capability_revisions
        WHERE deployment_id=deployment_two) <> 1 THEN
      RAISE EXCEPTION 'deployment capability revision streams were not isolated';
    END IF;

    BEGIN
      INSERT INTO skipo_ecosystem.deployment_capability_revisions
        (deployment_id, revision, descriptors)
      VALUES (deployment_one, 4, '[]'::jsonb);
      RAISE EXCEPTION 'capability revision gap was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO skipo_ecosystem.deployment_capability_revisions
        (deployment_id, revision, descriptors)
      VALUES (deployment_one, 3, '[{"id":"workspace.list","apiKey":"secret"}]'::jsonb);
      RAISE EXCEPTION 'secret descriptor key was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO skipo_ecosystem.deployment_capability_revisions
        (deployment_id, revision, descriptors)
      VALUES (deployment_one, 3, '[{"id":"workspace.list","description":"https://private.example"}]'::jsonb);
      RAISE EXCEPTION 'endpoint URL descriptor value was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    SELECT jsonb_agg('{}'::jsonb) INTO oversized FROM generate_series(1, 257);
    BEGIN
      INSERT INTO skipo_ecosystem.deployment_capability_revisions
        (deployment_id, revision, descriptors)
      VALUES (deployment_one, 3, oversized);
      RAISE EXCEPTION 'oversized capability descriptor snapshot was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO skipo_ecosystem.deployment_capability_revisions
        (deployment_id, revision, descriptors)
      VALUES (deployment_expired, 1, '[]'::jsonb);
      RAISE EXCEPTION 'expired deployment published a capability revision';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
      INSERT INTO skipo_ecosystem.deployment_capability_revisions
        (deployment_id, revision, descriptors)
      VALUES (deployment_unverified, 1, '[]'::jsonb);
      RAISE EXCEPTION 'unverified deployment published a capability revision';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO skipo_ecosystem.deployment_capability_revisions
      (deployment_id, revision, descriptors)
    VALUES (deployment_one, 3, '[{"id":"workspace.create","description":"Create workspace"}]'::jsonb);

    BEGIN
      UPDATE skipo_ecosystem.deployment_capability_revisions
      SET descriptors='[]'::jsonb
      WHERE deployment_id=deployment_one AND revision=1;
      RAISE EXCEPTION 'capability revision mutation was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
      DELETE FROM skipo_ecosystem.deployment_capability_revisions
      WHERE deployment_id=deployment_one AND revision=1;
      RAISE EXCEPTION 'capability revision deletion was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE EXCEPTION 'capability_revision_test_rollback_fixtures';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'capability_revision_test_rollback_fixtures' THEN RAISE; END IF;
  END;

  IF EXISTS (SELECT 1 FROM skipo_ecosystem.deployment_capability_revisions
             WHERE deployment_id IN (deployment_one, deployment_two, deployment_expired, deployment_unverified))
     OR EXISTS (SELECT 1 FROM skipo_ecosystem.deployments
             WHERE deployment_id IN (deployment_one, deployment_two, deployment_expired, deployment_unverified)) THEN
    RAISE EXCEPTION 'capability revision test fixtures survived rollback';
  END IF;
END;
$capability_revision_test$;
