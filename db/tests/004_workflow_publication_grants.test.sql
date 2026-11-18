-- Execute ONLY on an isolated Neon development branch after the Skipo N5 migration.
-- This nested exception subtransaction leaves zero fixtures behind.
DO $workflow_registry_test$
DECLARE
  publication_one uuid := gen_random_uuid();
  publication_two uuid := gen_random_uuid();
  grant_one uuid := gen_random_uuid();
  grant_two uuid := gen_random_uuid();
BEGIN
  BEGIN
    INSERT INTO skipo_ecosystem.workflow_publications
      (id, app_id, owner_user_id, workspace_id, workflow_id, version, display_name)
    VALUES
      (publication_one, 'aiko', 'n5-test-owner-one', 'n5-test-owner-workspace-one',
       'n5-test-workflow', 1, 'Owner One Workflow'),
      (publication_two, 'aiko', 'n5-test-owner-two', 'n5-test-owner-workspace-two',
       'n5-test-workflow', 1, 'Owner Two Workflow');
    IF (SELECT count(*) FROM skipo_ecosystem.workflow_publications
        WHERE workflow_id='n5-test-workflow' AND version=1) <> 2 THEN
      RAISE EXCEPTION 'owner/workspace workflow namespace was not isolated';
    END IF;
    BEGIN
      UPDATE skipo_ecosystem.workflow_publications SET version=2 WHERE id=publication_one;
      RAISE EXCEPTION 'publication version mutation was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE skipo_ecosystem.workflow_publications
      SET owner_user_id='n5-test-owner-two' WHERE id=publication_one;
      RAISE EXCEPTION 'publication owner mutation was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE skipo_ecosystem.workflow_publications
    SET publication_state='withdrawn', withdrawn_at=clock_timestamp()
    WHERE id=publication_one;
    BEGIN
      UPDATE skipo_ecosystem.workflow_publications
      SET publication_state='published', withdrawn_at=NULL WHERE id=publication_one;
      RAISE EXCEPTION 'publication reactivation was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO skipo_ecosystem.workflow_grants
      (id, publication_id, owner_user_id, target_workspace_id, caller_app_id,
       source_workspace_id, granted_by_user_id)
    VALUES
      (grant_one, publication_two, 'n5-test-owner-two', 'n5-test-owner-workspace-two',
       'kone', 'n5-test-source-workspace', 'n5-test-owner-two');
    BEGIN
      UPDATE skipo_ecosystem.workflow_grants
      SET source_workspace_id='n5-test-forged-source' WHERE id=grant_one;
      RAISE EXCEPTION 'grant source workspace mutation was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE skipo_ecosystem.workflow_grants
      SET caller_app_id='aiko' WHERE id=grant_one;
      RAISE EXCEPTION 'grant caller app mutation was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE skipo_ecosystem.workflow_grants
    SET grant_state='revoked', revoked_at=clock_timestamp(),
        revoked_by_user_id='n5-test-owner-two'
    WHERE id=grant_one;
    BEGIN
      UPDATE skipo_ecosystem.workflow_grants
      SET grant_state='active', revoked_at=NULL, revoked_by_user_id=NULL
      WHERE id=grant_one;
      RAISE EXCEPTION 'grant reactivation was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO skipo_ecosystem.workflow_grants
      (id, publication_id, owner_user_id, target_workspace_id, caller_app_id,
       source_workspace_id, granted_by_user_id)
    VALUES
      (grant_two, publication_two, 'n5-test-owner-two', 'n5-test-owner-workspace-two',
       'kone', 'n5-test-source-workspace', 'n5-test-owner-two');
    BEGIN
      INSERT INTO skipo_ecosystem.workflow_grants
        (publication_id, owner_user_id, target_workspace_id, caller_app_id,
         source_workspace_id, granted_by_user_id)
      VALUES
        (publication_two, 'n5-test-owner-two', 'n5-test-owner-workspace-two',
         'kone', 'n5-test-source-workspace', 'n5-test-owner-two');
      RAISE EXCEPTION 'duplicate active grant was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO skipo_ecosystem.workflow_grants
        (publication_id, owner_user_id, target_workspace_id, caller_app_id,
         source_workspace_id, granted_by_user_id)
      VALUES
        (publication_one, 'n5-test-owner-one', 'n5-test-owner-workspace-one',
         'kone', 'n5-test-source-workspace', 'n5-test-owner-one');
      RAISE EXCEPTION 'grant to withdrawn publication was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    RAISE EXCEPTION 'workflow_registry_test_rollback_fixtures';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'workflow_registry_test_rollback_fixtures' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM skipo_ecosystem.workflow_publications
             WHERE owner_user_id LIKE 'n5-test-owner-%')
     OR EXISTS (SELECT 1 FROM skipo_ecosystem.workflow_grants
             WHERE owner_user_id LIKE 'n5-test-owner-%') THEN
    RAISE EXCEPTION 'workflow registry test fixtures survived rollback';
  END IF;
END;
$workflow_registry_test$;
