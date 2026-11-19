-- Roll back only E2E03 extra triggers on an isolated branch.
-- Deliberately RETAIN RLS and private ACL: disabling them would expose data.
-- This does not delete app, deployment, publication, revision or grant records.
BEGIN;
DROP TRIGGER IF EXISTS e2e03_deployment_history_guard ON skipo_ecosystem.deployments;
DROP TRIGGER IF EXISTS e2e03_capability_revision_history_guard ON skipo_ecosystem.deployment_capability_revisions;
DROP TRIGGER IF EXISTS e2e03_capability_revision_insert_guard ON skipo_ecosystem.deployment_capability_revisions;
DROP FUNCTION IF EXISTS skipo_ecosystem.e2e03_validate_revision_insert();
DROP FUNCTION IF EXISTS skipo_ecosystem.e2e03_reject_history_mutation();
COMMIT;
