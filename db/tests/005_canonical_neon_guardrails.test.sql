-- Requires integrated Skipo N2/N4/N5, Luth N3/code migrations and
-- db/reconciliation/20261118_canonical_neon_guardrails.sql.
-- All fixtures and changes are rolled back, including successful inserts.
-- psql -v ON_ERROR_STOP=1 -f db/tests/005_canonical_neon_guardrails.test.sql
BEGIN;

DO $verify$
DECLARE
  test_app text := 'atax-neon-guardrails-fixture-20261118';
  test_client text := 'atax-neon-guardrails-client-20261118';
  publication_id uuid;
  grant_id uuid;
  dep_id uuid;
BEGIN
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgrelid = 'public."ultrst-apps"'::regclass
        AND tgname = 'ultrst_apps_canonical_identity_immutable'
        AND NOT tgisinternal) <> 1 THEN
    RAISE EXCEPTION 'FAIL: exactly one catalog identity trigger required';
  END IF;
  IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'skipo_ecosystem.deployments'::regclass
        AND conname = 'deployments_verified_evidence_guard'
        AND convalidated) THEN
    RAISE EXCEPTION 'FAIL: verified-deployment evidence check absent';
  END IF;

  INSERT INTO public."ultrst-apps" (id, app_id, name)
  VALUES (test_app, test_app, 'Temporary Neon certification fixture');
  BEGIN
    UPDATE public."ultrst-apps" SET app_id = test_app || '-forged'
    WHERE id = test_app;
    RAISE EXCEPTION 'FAIL: canonical app_id changed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public."ultrst-apps" SET id = test_app || '-forged'
    WHERE id = test_app;
    RAISE EXCEPTION 'FAIL: legacy catalog key changed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO skipo_ecosystem.deployments
      (app_id, app_url, capabilities, environment, verification_state)
    VALUES
      (test_app, 'https://neon-no-proof.invalid', ARRAY[]::text[],
       'production', 'verified');
    RAISE EXCEPTION 'FAIL: verified deployment without proof was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO skipo_ecosystem.deployments
    (app_id, app_url, capabilities, environment, verification_state,
     verification_proof_digest, lease_expires_at)
  VALUES
    (test_app, 'https://neon-verified-fixture.invalid', ARRAY[]::text[],
     'preview', 'verified', repeat('a', 64), clock_timestamp() + interval '1 day')
  RETURNING deployment_id INTO dep_id;

  INSERT INTO skipo_ecosystem.deployment_capability_revisions
    (deployment_id, revision, descriptors)
  VALUES (dep_id, 1, '[]'::jsonb);
  BEGIN
    INSERT INTO skipo_ecosystem.deployment_capability_revisions
      (deployment_id, revision, descriptors)
    VALUES (dep_id, 1, '[]'::jsonb);
    RAISE EXCEPTION 'FAIL: duplicate capability revision was accepted';
  EXCEPTION WHEN check_violation OR unique_violation THEN NULL;
  END;

  INSERT INTO public.luth_oauth_clients
    (client_id, app_id, platform, environment, status)
  VALUES (test_client, test_app, 'web', 'preview', 'pending');
  BEGIN
    INSERT INTO public.luth_oauth_redirects
      (client_id, platform, redirect_uri, callback_kind, status,
       owner_proof_ref, approved_by, verified_at)
    VALUES (test_client, 'web', 'https://neon-pending.invalid/callback',
      'exact_https', 'verified', 'proof', 'admin', clock_timestamp());
    RAISE EXCEPTION 'FAIL: callback verified before owning client';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.luth_oauth_authorization_codes
    (code_hash, client_id, platform, redirect_uri, code_challenge,
     principal_id, session_id, expires_at)
  VALUES (repeat('a',64), test_client, 'web',
    'https://neon-pending.invalid/callback', repeat('A',43),
    'atax-test-owner', 'atax-test-session',
    clock_timestamp() + interval '5 minutes');
  UPDATE public.luth_oauth_authorization_codes
    SET consumed_at = clock_timestamp()
    WHERE code_hash = repeat('a',64);
  BEGIN
    UPDATE public.luth_oauth_authorization_codes
      SET consumed_at = clock_timestamp()
      WHERE code_hash = repeat('a',64);
    RAISE EXCEPTION 'FAIL: authorization code consumed twice';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO skipo_ecosystem.workflow_publications
    (app_id, owner_user_id, workspace_id, workflow_id, version, display_name)
  VALUES (test_app, 'atax-owner', 'atax-target-workspace', 'atax-flow', 1,
    'Temporary certification publication')
  RETURNING id INTO publication_id;

  BEGIN
    INSERT INTO skipo_ecosystem.workflow_grants
      (publication_id, owner_user_id, target_workspace_id,
       caller_app_id, source_workspace_id, granted_by_user_id)
    VALUES (publication_id, 'atax-foreign-owner', 'atax-target-workspace',
      'kone', 'atax-source-workspace', 'atax-foreign-owner');
    RAISE EXCEPTION 'FAIL: other-owner grant was accepted';
  EXCEPTION WHEN foreign_key_violation OR check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO skipo_ecosystem.workflow_grants
      (publication_id, owner_user_id, target_workspace_id,
       caller_app_id, source_workspace_id, granted_by_user_id)
    VALUES (publication_id, 'atax-owner', 'atax-wrong-target',
      'kone', 'atax-source-workspace', 'atax-owner');
    RAISE EXCEPTION 'FAIL: grant for another target workspace accepted';
  EXCEPTION WHEN foreign_key_violation OR check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO skipo_ecosystem.workflow_grants
      (publication_id, owner_user_id, target_workspace_id,
       caller_app_id, source_workspace_id, granted_by_user_id)
    VALUES (publication_id, 'atax-owner', 'atax-target-workspace',
      'kone', 'atax-source-workspace', 'atax-other-user');
    RAISE EXCEPTION 'FAIL: grantor could impersonate owner';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO skipo_ecosystem.workflow_grants
    (publication_id, owner_user_id, target_workspace_id,
     caller_app_id, source_workspace_id, granted_by_user_id)
  VALUES (publication_id, 'atax-owner', 'atax-target-workspace',
    'kone', 'atax-source-workspace', 'atax-owner')
  RETURNING id INTO grant_id;
  UPDATE skipo_ecosystem.workflow_grants
    SET grant_state = 'revoked', revoked_at = clock_timestamp(),
        revoked_by_user_id = 'atax-owner'
  WHERE id = grant_id;
  BEGIN
    UPDATE skipo_ecosystem.workflow_grants
      SET grant_state = 'active', revoked_at = NULL, revoked_by_user_id = NULL
    WHERE id = grant_id;
    RAISE EXCEPTION 'FAIL: revoked grant reactivated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE skipo_ecosystem.workflow_publications
    SET publication_state = 'withdrawn', withdrawn_at = clock_timestamp()
  WHERE id = publication_id;
  BEGIN
    INSERT INTO skipo_ecosystem.workflow_grants
      (publication_id, owner_user_id, target_workspace_id,
       caller_app_id, source_workspace_id, granted_by_user_id)
    VALUES (publication_id, 'atax-owner', 'atax-target-workspace',
      'kone', 'atax-another-source', 'atax-owner');
    RAISE EXCEPTION 'FAIL: grant issued after workflow withdrawal';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$verify$;

-- A failure with ON_ERROR_STOP exits and PostgreSQL rolls back the connection;
-- a successful test explicitly rolls back all synthetic data.
ROLLBACK;
