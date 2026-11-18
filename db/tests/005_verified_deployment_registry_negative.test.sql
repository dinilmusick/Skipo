-- Verified Skipo deployment lifecycle and immutable static revisions.
-- Execute ONLY on an isolated Neon development branch AFTER applying
-- backend/ecosystem/db/deployments.sql at the exact candidate commit.
-- Fixture state is rolled back even on successful execution; never seed
-- proof-backed records into production using this test.
BEGIN;
SAVEPOINT verified_skipo_registry_fixture;

DO $verified_registry_fixture$
DECLARE
  app text;
  good_id uuid := gen_random_uuid();
  unverified_id uuid := gen_random_uuid();
  revoked_id uuid := gen_random_uuid();
  origin text;
  denied integer := 0;
BEGIN
  SELECT app_id INTO app FROM public."ultrst-apps" ORDER BY app_id LIMIT 1;
  IF app IS NULL THEN
    RAISE EXCEPTION 'no registered test application exists';
  END IF;
  origin := 'https://skipo-fixture-' || replace(good_id::text, '-', '') || '.example.com';

  INSERT INTO skipo_ecosystem.deployments
    (deployment_id, app_id, app_url, capabilities,
     environment, verification_state, verification_proof_digest, lease_expires_at)
  VALUES
    (good_id, app, origin, ARRAY['ping'], 'preview', 'verified',
     'fixture-only-nonproduction', statement_timestamp() + interval '30 minutes'),
    (unverified_id, app, 'https://unverified-' || replace(unverified_id::text, '-', '') || '.example.com',
     ARRAY['ping'], 'unclassified', 'unverified', NULL, NULL),
    (revoked_id, app, 'https://revoked-' || replace(revoked_id::text, '-', '') || '.example.com',
     ARRAY['ping'], 'preview', 'revoked', NULL, NULL);

  BEGIN
    UPDATE skipo_ecosystem.deployments SET app_url='https://forged.example.com'
    WHERE deployment_id=good_id;
    RAISE EXCEPTION 'verified origin reassignment unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN denied := denied + 1;
  END;
  BEGIN
    UPDATE skipo_ecosystem.deployments SET capabilities=ARRAY['admin']
    WHERE deployment_id=good_id;
    RAISE EXCEPTION 'verified capability reassignment unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN denied := denied + 1;
  END;
  BEGIN
    UPDATE skipo_ecosystem.deployments SET app_id='forged-app'
    WHERE deployment_id=good_id;
    RAISE EXCEPTION 'canonical app id mutation unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN denied := denied + 1;
  END;
  BEGIN
    UPDATE skipo_ecosystem.deployments SET deployment_id=gen_random_uuid()
    WHERE deployment_id=good_id;
    RAISE EXCEPTION 'immutable deployment id mutation unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN denied := denied + 1;
  END;
  BEGIN
    UPDATE skipo_ecosystem.deployments SET verification_state='unverified'
    WHERE deployment_id=revoked_id;
    RAISE EXCEPTION 'revoked deployment reactivation unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN denied := denied + 1;
  END;

  -- Structural proof/lease fields are required; they are NOT attestation.
  BEGIN
    INSERT INTO skipo_ecosystem.deployments
      (deployment_id,app_id,app_url,capabilities,environment,verification_state,lease_expires_at)
    VALUES (gen_random_uuid(),app,'https://noproof.example.com',ARRAY[]::text[],
            'preview','verified',statement_timestamp()+interval '1 hour');
    RAISE EXCEPTION 'missing proof unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN denied := denied + 1;
  END;
  BEGIN
    INSERT INTO skipo_ecosystem.deployments
      (deployment_id,app_id,app_url,capabilities,environment,verification_state,verification_proof_digest)
    VALUES (gen_random_uuid(),app,'https://nolease.example.com',ARRAY[]::text[],
            'preview','verified','fixture-only');
    RAISE EXCEPTION 'missing lease unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN denied := denied + 1;
  END;

  INSERT INTO skipo_ecosystem.deployment_capability_revisions
    (deployment_id,revision,descriptors)
  VALUES (good_id,1,'[{"id":"ping"}]'::jsonb);

  BEGIN
    UPDATE skipo_ecosystem.deployment_capability_revisions
    SET descriptors='[]'::jsonb
    WHERE deployment_id=good_id AND revision=1;
    RAISE EXCEPTION 'immutable revision update unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN denied := denied + 1;
  END;
  BEGIN
    DELETE FROM skipo_ecosystem.deployment_capability_revisions
    WHERE deployment_id=good_id AND revision=1;
    RAISE EXCEPTION 'immutable revision delete unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN denied := denied + 1;
  END;

  -- Withdrawal creates a new immutable complete snapshot.
  INSERT INTO skipo_ecosystem.deployment_capability_revisions
    (deployment_id,revision,descriptors)
  VALUES (good_id,2,'[]'::jsonb);

  UPDATE skipo_ecosystem.deployments SET last_refresh_at=statement_timestamp()
  WHERE deployment_id=good_id;
  UPDATE skipo_ecosystem.deployments
  SET app_url='https://new-unverified-' || replace(unverified_id::text, '-', '') || '.example.com'
  WHERE deployment_id=unverified_id;

  IF denied <> 9 THEN
    RAISE EXCEPTION 'expected 9 rejected mutations/registrations, got %',denied;
  END IF;
  IF (SELECT count(*) FROM skipo_ecosystem.deployment_capability_revisions
      WHERE deployment_id=good_id) <> 2 THEN
    RAISE EXCEPTION 'new immutable revision stream was not preserved';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM skipo_ecosystem.deployments
    WHERE deployment_id=good_id AND verification_state='verified'
      AND environment='preview' AND app_url=origin
      AND lease_expires_at>statement_timestamp()
      AND last_refresh_at>statement_timestamp()-interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'qualified verified target unexpectedly unavailable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM skipo_ecosystem.deployments
    WHERE deployment_id=revoked_id AND verification_state='verified'
  ) THEN
    RAISE EXCEPTION 'revoked deployment became eligible';
  END IF;
END;
$verified_registry_fixture$;

ROLLBACK TO SAVEPOINT verified_skipo_registry_fixture;
COMMIT;
