-- Read-only classification/mapping inventory; NO enrollment or backfill.
-- Run against a selected isolated Neon branch. Resolve pending rows by evidence.
WITH catalog AS (
  SELECT a.app_id, a.id AS legacy_catalog_id, a.status,
         CASE
           WHEN a.app_id IN ('floks','kloks') THEN 'library_not_deployment'
           WHEN a.app_id = 'fod' THEN 'module_not_deployment'
           WHEN a.app_id IN ('krusbl','qwnsr') THEN 'manual_classification_pending'
           ELSE 'application_candidate'
         END AS classification
  FROM public."ultrst-apps" a
), origins AS (
  SELECT app_id, count(*) AS legacy_origins,
         count(*) FILTER (WHERE environment = 'production') AS production_origins,
         count(*) FILTER (WHERE environment <> 'production') AS nonproduction_origins
  FROM public.luth_auth_origins GROUP BY app_id
), deployment_rows AS (
  SELECT app_id, count(*) AS registered_deployments,
         count(*) FILTER (
           WHERE verification_state='verified'
             AND NULLIF(btrim(verification_proof_digest),'') IS NOT NULL
             AND lease_expires_at > clock_timestamp()
         ) AS currently_proof_structured_deployments
  FROM skipo_ecosystem.deployments GROUP BY app_id
), oauth AS (
  SELECT app_id, count(*) AS oauth_clients,
         count(*) FILTER (WHERE status='verified') AS verified_clients
  FROM public.luth_oauth_clients GROUP BY app_id
)
SELECT catalog.app_id, catalog.legacy_catalog_id, catalog.status,
       catalog.classification,
       COALESCE(origins.legacy_origins,0) AS legacy_origins,
       COALESCE(origins.production_origins,0) AS production_origins,
       COALESCE(origins.nonproduction_origins,0) AS nonproduction_origins,
       COALESCE(deployment_rows.registered_deployments,0) AS registered_deployments,
       COALESCE(deployment_rows.currently_proof_structured_deployments,0)
         AS currently_proof_structured_deployments,
       COALESCE(oauth.oauth_clients,0) AS oauth_clients,
       COALESCE(oauth.verified_clients,0) AS verified_clients
FROM catalog
LEFT JOIN origins USING (app_id)
LEFT JOIN deployment_rows USING (app_id)
LEFT JOIN oauth USING (app_id)
ORDER BY catalog.app_id;

-- Legacy origin review exceptions: do not auto-enroll absent/unknown apps.
SELECT o.id AS legacy_origin_id, o.app_id, o.environment, o.enabled,
       CASE WHEN a.app_id IS NULL THEN 'REQUIRES_REVIEW'
            ELSE 'CATALOG_MATCH_ONLY_NOT_APPROVAL' END AS mapping_status
FROM public.luth_auth_origins o
LEFT JOIN public."ultrst-apps" a ON a.app_id = o.app_id
ORDER BY o.app_id, o.environment, o.id;

-- Missing candidates are NOT created by this inventory; owner proof required.
SELECT required.app_id, CASE WHEN a.app_id IS NULL THEN 'OWNER_ENROLLMENT_REQUIRED'
                             ELSE 'ALREADY_IN_CATALOG' END AS evidence_state
FROM (VALUES ('brwlr'), ('kal')) AS required(app_id)
LEFT JOIN public."ultrst-apps" a ON a.app_id=required.app_id;

-- Preserve legacy web routing until consumers are independently migrated.
SELECT 'luth_legacy_routes' AS relation, count(*) AS records
FROM public."ultrst-luth-deployments"
UNION ALL
SELECT 'srkl_legacy_routes', count(*)
FROM public."ultrst-srkl-deployments";
