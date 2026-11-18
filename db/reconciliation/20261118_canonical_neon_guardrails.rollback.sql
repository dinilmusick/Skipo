-- Reverses ONLY the additive 2026-11-18 guardrails, not N2/N3/N4/N5.
-- Run on an explicitly selected isolated Neon branch after row-count checks.
-- Never use as an unapproved production cleanup or deployment rollback.
BEGIN;

ALTER TABLE skipo_ecosystem.deployments
  DROP CONSTRAINT IF EXISTS deployments_verified_evidence_guard;

DROP TRIGGER IF EXISTS ultrst_apps_canonical_identity_immutable
  ON public."ultrst-apps";

DROP FUNCTION IF EXISTS
  skipo_ecosystem.reject_canonical_app_identity_change();

COMMIT;
