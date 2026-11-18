-- ULTRST additive Neon registry hardening, reviewed against Skipo unified N2/N4/N5.
-- Prerequisite: backend/ecosystem/db/deployments.sql from integrated Skipo #198.
-- No backfill, app enrollment, legacy deletion, privilege widening, or production cutover.
BEGIN;

-- Both the legacy catalog key and canonical application ID must remain stable, even
-- when a catalog row has no active children. Retire via status, never DELETE.
-- Newly enrolled apps are still created by the approved registry authority only.
CREATE OR REPLACE FUNCTION skipo_ecosystem.reject_canonical_app_identity_change()
RETURNS trigger
LANGUAGE plpgsql
AS $guard$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical application identities must be retired, not deleted'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.app_id IS DISTINCT FROM OLD.app_id THEN
    RAISE EXCEPTION 'canonical application identity cannot be rebound'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION skipo_ecosystem.reject_canonical_app_identity_change() FROM PUBLIC;

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public."ultrst-apps"'::regclass
      AND tgname = 'ultrst_apps_canonical_identity_immutable'
      AND NOT tgisinternal
      AND (tgtype::int & 8) <> 0
      AND (tgtype::int & 16) <> 0
  ) THEN
    -- Upgrade an older update-only guard without requiring a separate
    -- migration; the ALTER is atomic with its replacement trigger.
    DROP TRIGGER IF EXISTS ultrst_apps_canonical_identity_immutable
      ON public."ultrst-apps";
    CREATE TRIGGER ultrst_apps_canonical_identity_immutable
      BEFORE UPDATE OR DELETE ON public."ultrst-apps"
      FOR EACH ROW
      EXECUTE FUNCTION skipo_ecosystem.reject_canonical_app_identity_change();
  END IF;
END;
$guard$;

-- Existing unverified heartbeat records remain legal, including unclassified
-- preview-era records. Verified deployments require evidence, a concrete
-- environment and an explicit lease. SQL does not itself establish proof
-- authenticity; enrollment must still be performed by the authorized writer.
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'skipo_ecosystem.deployments'::regclass
      AND conname = 'deployments_verified_evidence_guard'
  ) THEN
    ALTER TABLE skipo_ecosystem.deployments
      ADD CONSTRAINT deployments_verified_evidence_guard
      CHECK (
        verification_state <> 'verified'
        OR (
          environment IN ('development', 'preview', 'staging', 'production')
          AND NULLIF(btrim(verification_proof_digest), '') IS NOT NULL
          AND lease_expires_at IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END;
$guard$;

-- Fail the migration if preexisting verified rows are missing required proof
-- rather than silently rewriting or certifying them.
ALTER TABLE skipo_ecosystem.deployments
  VALIDATE CONSTRAINT deployments_verified_evidence_guard;

COMMIT;
