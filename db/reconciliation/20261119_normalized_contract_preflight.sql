-- Read-only post-migration integrity preflight. Run on an isolated Neon
-- verification branch after Skipo #198 and Luth #18 schema have been applied.
-- Counts only; never return user IDs, workflow definitions, codes or secrets.
-- Only "migration_blocker" rows must have zero findings for schema acceptance.
WITH findings AS (
  SELECT 'migration_blocker' AS severity, 'verified_deployment_missing_proof_or_lease' AS check_name,
         count(*)::bigint AS findings
  FROM skipo_ecosystem.deployments d
  WHERE d.verification_state='verified'
    AND (d.environment NOT IN ('development','preview','staging','production')
      OR NULLIF(btrim(d.verification_proof_digest),'') IS NULL
      OR d.lease_expires_at IS NULL)
  UNION ALL
  SELECT 'migration_blocker','deployments_missing_canonical_app',count(*)::bigint
  FROM skipo_ecosystem.deployments d
  LEFT JOIN public."ultrst-apps" a ON a.app_id=d.app_id
  WHERE a.app_id IS NULL
  UNION ALL
  SELECT 'migration_blocker','verified_redirect_unverified_parent',count(*)::bigint
  FROM public.luth_oauth_redirects r
  LEFT JOIN public.luth_oauth_clients c
    ON c.client_id=r.client_id AND c.platform=r.platform
  WHERE r.status='verified' AND (c.client_id IS NULL OR c.status <> 'verified')
  UNION ALL
  SELECT 'migration_blocker','oauth_code_redirect_not_registered',count(*)::bigint
  FROM public.luth_oauth_authorization_codes c
  LEFT JOIN public.luth_oauth_redirects r
    ON r.client_id=c.client_id AND r.platform=c.platform
    AND r.redirect_uri=c.redirect_uri
  WHERE r.redirect_id IS NULL
  UNION ALL
  SELECT 'migration_blocker','grant_wrong_owner_or_target_workspace',count(*)::bigint
  FROM skipo_ecosystem.workflow_grants g
  LEFT JOIN skipo_ecosystem.workflow_publications p ON p.id=g.publication_id
  WHERE p.id IS NULL OR p.owner_user_id<>g.owner_user_id
      OR p.workspace_id<>g.target_workspace_id
  UNION ALL
  SELECT 'migration_blocker','publication_missing_canonical_app',count(*)::bigint
  FROM skipo_ecosystem.workflow_publications p
  LEFT JOIN public."ultrst-apps" a ON a.app_id=p.app_id
  WHERE a.app_id IS NULL
  UNION ALL
  SELECT 'runtime_filter_only','active_grants_to_withdrawn_publications',count(*)::bigint
  FROM skipo_ecosystem.workflow_grants g
  JOIN skipo_ecosystem.workflow_publications p ON p.id=g.publication_id
  WHERE g.grant_state='active' AND p.publication_state='withdrawn'
  UNION ALL
  SELECT 'runtime_filter_only','verified_deployments_with_expired_lease',count(*)::bigint
  FROM skipo_ecosystem.deployments d
  WHERE d.verification_state='verified' AND d.lease_expires_at <= clock_timestamp()
)
SELECT severity, check_name, findings,
       CASE WHEN severity='runtime_filter_only'
            THEN 'EXPECTED_POSSIBLE_TARGET_MUST_FILTER'
            WHEN findings=0 THEN 'PASS' ELSE 'FAIL_REVIEW_REQUIRED' END AS result
FROM findings
ORDER BY severity,check_name;
