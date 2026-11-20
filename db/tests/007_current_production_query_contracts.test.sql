-- E2E03 cross-repository contract validation. Run ONLY on an isolated Neon
-- branch after full Skipo normalized + Luth 003/004/005 + hardening migrations.
-- The PREPARE statements are exact source SQL, not independently reinvented mocks.
-- Luth pkceCode.ts blob 5e5f87b6dbe7df943cc61d6d7f3cd55315ed05e3
-- Luth crossAppDelegation.ts blob 28d2fe1f98debd40bfac3f1af0e7551f6c456cf0
-- Skipo PR #198 deploymentStore_Impure.ts blob 827391fdbb04b6b178b3815149f14159fc19948a
-- psql -X -v ON_ERROR_STOP=1 -f db/tests/007_current_production_query_contracts.test.sql
-- No production use; all synthetic records rolled back.
BEGIN;

INSERT INTO public."ultrst-apps"(id,app_id,name,status,ecosystem_id)
VALUES ('e2e03-contract','e2e03-contract','Isolated contract app','active','ultrst-armada');
INSERT INTO public."user"(id,name,email,"emailVerified")
VALUES ('e2e03-contract-user-20261119','Isolated database contract','e2e03-fixture@invalid.test',true);
INSERT INTO public.session(id,"expiresAt",token,"userId","updatedAt")
VALUES ('e2e03-contract-session-20261119',clock_timestamp()+interval '1 hour',
'e2e03-fixture-session-token-20261119','e2e03-contract-user-20261119',clock_timestamp());
INSERT INTO public.luth_auth_origins(id,ecosystem_id,app_id,origin,environment,enabled)
VALUES ('e2e03-test-origin','ultrst-armada','e2e03-contract','https://e2e03-contract.invalid','preview',true);
INSERT INTO public.luth_oauth_clients
(client_id,app_id,platform,environment,status,owner_proof_ref,approved_by,verified_at)
VALUES ('e2e03-contract-client','e2e03-contract','web','preview','verified','isolated-only','e2e03-reviewer',clock_timestamp());
INSERT INTO public.luth_oauth_redirects
(client_id,platform,redirect_uri,callback_kind,status,owner_proof_ref,approved_by,verified_at)
VALUES ('e2e03-contract-client','web','https://e2e03-contract.invalid/oauth/callback','exact_https','verified','isolated-only','e2e03-reviewer',clock_timestamp());
INSERT INTO skipo_ecosystem.deployments
(deployment_id,app_id,app_url,capabilities,environment,verification_state,verification_proof_digest,lease_expires_at)
VALUES ('123e4567-e89b-12d3-a456-426614174000','e2e03-contract','https://e2e03-contract.invalid',ARRAY['e2e03.op']::text[],'preview',
'verified',repeat('f',64),clock_timestamp()+interval '1 hour');
INSERT INTO public.luth_oauth_invocation_grants
(grant_id,owner_user_id,caller_app_id,target_app_id,caller_workspace_id,target_workspace_id,
permission_scope,resource_key,status,approval_proof_ref,approved_by,approved_at,expires_at)
VALUES ('123e4567-e89b-12d3-a456-426614174111','e2e03-contract-user-20261119','e2e03-contract','aiko','caller-ws','owner-ws',
'backend.invoke','e2e03.op','approved','isolated-only','e2e03-contract-user-20261119',
clock_timestamp(),clock_timestamp()+interval '1 hour');

PREPARE e2e03_pkce_redeem AS
UPDATE public.luth_oauth_authorization_codes AS code
SET consumed_at = clock_timestamp()
FROM public.luth_oauth_clients AS client,
     public.luth_oauth_redirects AS callback,
     public."ultrst-apps" AS app,
     public.session AS active_session
WHERE code.code_hash = $1
  AND code.client_id = $2
  AND code.redirect_uri = $3
  AND code.code_challenge = $4
  AND code.consumed_at IS NULL
  AND code.expires_at > clock_timestamp()
  AND client.client_id = code.client_id
  AND client.platform = code.platform
  AND client.status = 'verified'
  AND client.client_kind = 'public'
  AND app.app_id = client.app_id
  AND app.status = 'active'
  AND EXISTS (
    SELECT 1 FROM public.luth_ecosystems AS ecosystem
    WHERE ecosystem.id = app.ecosystem_id AND ecosystem.status = 'active'
  )
  -- A deleted, logged-out or expired Better Auth session cannot consume the code.
  AND active_session.id = code.session_id
  AND active_session."userId" = code.principal_id
  AND active_session."expiresAt" > clock_timestamp()
  AND callback.client_id = client.client_id
  AND callback.platform = client.platform
  AND callback.redirect_uri = code.redirect_uri
  AND callback.status = 'verified'
  AND (
    callback.callback_kind = 'desktop_loopback'
    OR EXISTS (
      SELECT 1 FROM public.luth_auth_origins AS registered_origin
      WHERE registered_origin.app_id = client.app_id
        AND registered_origin.ecosystem_id = app.ecosystem_id
        AND registered_origin.origin = $5
        AND registered_origin.environment = client.environment
        AND registered_origin.enabled = true
    )
  )
RETURNING code.principal_id, code.session_id, code.client_id, code.redirect_uri;

PREPARE e2e03_pkce_issue AS
INSERT INTO public.luth_oauth_authorization_codes
  (code_hash, client_id, platform, redirect_uri, code_challenge,
   principal_id, session_id, expires_at)
SELECT $1, client.client_id, client.platform, callback.redirect_uri,
       $4, $5, $6, clock_timestamp() + interval '5 minutes'
FROM public.luth_oauth_clients AS client
JOIN public."ultrst-apps" AS app
  ON app.app_id = client.app_id AND app.status = 'active'
JOIN public.luth_ecosystems AS ecosystem
  ON ecosystem.id = app.ecosystem_id AND ecosystem.status = 'active'
JOIN public.session AS active_session
  ON active_session.id = $6
 AND active_session."userId" = $5
 AND active_session."expiresAt" > clock_timestamp()
JOIN public.luth_oauth_redirects AS callback
  ON callback.client_id = client.client_id
 AND callback.platform = client.platform
WHERE client.client_id = $2
  AND callback.redirect_uri = $3
  AND client.status = 'verified'
  AND client.client_kind = 'public'
  AND callback.status = 'verified'
  AND (
    callback.callback_kind = 'desktop_loopback'
    OR EXISTS (
      SELECT 1 FROM public.luth_auth_origins AS registered_origin
      WHERE registered_origin.app_id = client.app_id
        AND registered_origin.ecosystem_id = app.ecosystem_id
        AND registered_origin.origin = $7
        AND registered_origin.environment = client.environment
        AND registered_origin.enabled = true
    )
  )
RETURNING code_hash;

PREPARE e2e03_delegation_issue AS
INSERT INTO public.luth_oauth_invocation_tokens
  (token_hash, grant_id, owner_user_id, session_id, expires_at)
SELECT $1, permission_grant.grant_id, $2, $3, clock_timestamp() + interval '60 seconds'
FROM public.luth_oauth_invocation_grants AS permission_grant
JOIN public."ultrst-apps" AS caller ON caller.app_id=permission_grant.caller_app_id AND caller.status='active'
JOIN public."ultrst-apps" AS target ON target.app_id=permission_grant.target_app_id AND target.status='active'
JOIN public.luth_ecosystems AS caller_ecosystem
  ON caller_ecosystem.id=caller.ecosystem_id AND caller_ecosystem.status='active'
JOIN public.luth_ecosystems AS target_ecosystem
  ON target_ecosystem.id=target.ecosystem_id AND target_ecosystem.status='active'
JOIN public.session AS live_session ON live_session.id=$3
  AND live_session."userId"=$2 AND live_session."expiresAt">clock_timestamp()
JOIN public."user" AS owner ON owner.id=$2 AND COALESCE(owner.banned,false)=false
WHERE permission_grant.owner_user_id=$2
  AND permission_grant.caller_app_id=$4 AND permission_grant.target_app_id=$5
  AND permission_grant.permission_scope=$6 AND permission_grant.caller_workspace_id=$7
  AND permission_grant.target_workspace_id=$8 AND permission_grant.resource_key=$9
  AND permission_grant.status='approved' AND permission_grant.approved_by=permission_grant.owner_user_id
  AND permission_grant.expires_at>clock_timestamp()
RETURNING grant_id;

PREPARE e2e03_delegation_consume AS
UPDATE public.luth_oauth_invocation_tokens AS token
SET consumed_at=clock_timestamp()
FROM public.luth_oauth_invocation_grants AS permission_grant,
     public."ultrst-apps" AS caller,
     public."ultrst-apps" AS target,
     public.luth_ecosystems AS caller_ecosystem,
     public.luth_ecosystems AS target_ecosystem,
     public.session AS live_session,
     public."user" AS owner
WHERE token.token_hash=$1 AND token.grant_id=$2
  AND token.owner_user_id=$3 AND token.session_id=$4
  AND token.consumed_at IS NULL AND token.expires_at>clock_timestamp()
  AND permission_grant.grant_id=token.grant_id AND permission_grant.owner_user_id=token.owner_user_id
  AND permission_grant.caller_app_id=$5 AND permission_grant.target_app_id=$6
  AND permission_grant.permission_scope=$7 AND permission_grant.caller_workspace_id=$8
  AND permission_grant.target_workspace_id=$9 AND permission_grant.resource_key=$10
  AND permission_grant.status='approved' AND permission_grant.approved_by=permission_grant.owner_user_id
  AND permission_grant.expires_at>clock_timestamp()
  AND caller.app_id=permission_grant.caller_app_id AND caller.status='active'
  AND target.app_id=permission_grant.target_app_id AND target.status='active'
  AND caller_ecosystem.id=caller.ecosystem_id AND caller_ecosystem.status='active'
  AND target_ecosystem.id=target.ecosystem_id AND target_ecosystem.status='active'
  AND live_session.id=token.session_id
  AND live_session."userId"=token.owner_user_id
  AND live_session."expiresAt">clock_timestamp()
  AND owner.id=token.owner_user_id AND COALESCE(owner.banned,false)=false
RETURNING token.grant_id;

PREPARE e2e03_revision_publish AS
WITH lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))
    ),
    latest AS MATERIALIZED (
      SELECT revision, descriptors
      FROM skipo_ecosystem.deployment_capability_revisions
      CROSS JOIN lock
      WHERE deployment_id = $1::uuid
      ORDER BY revision DESC
      LIMIT 1
    ),
    eligible AS MATERIALIZED (
      SELECT deployment_id
      FROM skipo_ecosystem.deployments
      WHERE deployment_id = $1::uuid
        AND verification_state = 'verified'
        AND NULLIF(btrim(verification_proof_digest), '') IS NOT NULL
        AND lease_expires_at > statement_timestamp()
    ),
    inserted AS (
      INSERT INTO skipo_ecosystem.deployment_capability_revisions
        (deployment_id, revision, descriptors)
      SELECT $1::uuid, COALESCE((SELECT revision FROM latest), 0) + 1, $2::jsonb
      FROM eligible
      WHERE NOT EXISTS (SELECT 1 FROM latest WHERE descriptors = $2::jsonb)
      RETURNING revision
    )
    SELECT revision FROM inserted
    UNION ALL
    SELECT latest.revision
    FROM latest
    JOIN eligible ON true
    WHERE latest.descriptors = $2::jsonb
    LIMIT 1;

PREPARE e2e03_revision_read AS
SELECT d.app_id, d.environment, r.revision, r.descriptors, r.published_at
    FROM skipo_ecosystem.deployments d
    JOIN LATERAL (
      SELECT revision, descriptors, published_at
      FROM skipo_ecosystem.deployment_capability_revisions
      WHERE deployment_id = d.deployment_id
      ORDER BY revision DESC
      LIMIT 1
    ) r ON true
    WHERE d.app_id = $1
      AND d.deployment_id = $2::uuid
      AND d.verification_state = 'verified'
      AND NULLIF(btrim(d.verification_proof_digest), '') IS NOT NULL
      AND d.lease_expires_at > statement_timestamp()
    LIMIT 1;

PREPARE e2e03_deployment_verify AS
SELECT deployment_id::text AS deployment_id, app_url
    FROM skipo_ecosystem.deployments
    WHERE app_id = $1
      AND $2 = ANY(capabilities)
      AND environment = $3
      AND verification_state = 'verified'
      AND NULLIF(btrim(verification_proof_digest), '') IS NOT NULL
      AND lease_expires_at > statement_timestamp()
      AND last_refresh_at > statement_timestamp() - interval '15 minutes'
    ORDER BY last_refresh_at DESC, app_url ASC
    LIMIT 1;

EXECUTE e2e03_pkce_issue(repeat('b',64),'e2e03-contract-client','https://e2e03-contract.invalid/oauth/callback',
repeat('A',43),'e2e03-contract-user-20261119','e2e03-contract-session-20261119','https://e2e03-contract.invalid');
EXECUTE e2e03_pkce_redeem(repeat('b',64),'e2e03-contract-client','https://e2e03-contract.invalid/oauth/callback',
repeat('A',43),'https://e2e03-contract.invalid');
-- Reuse cannot consume the authorization code a second time.
EXECUTE e2e03_pkce_redeem(repeat('b',64),'e2e03-contract-client','https://e2e03-contract.invalid/oauth/callback',
repeat('A',43),'https://e2e03-contract.invalid');
DO $assert$ BEGIN
  IF (SELECT count(*) FROM public.luth_oauth_authorization_codes
      WHERE code_hash=repeat('b',64) AND consumed_at IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'PKCE one-use contract failed';
  END IF;
END $assert$;

EXECUTE e2e03_delegation_issue(repeat('c',64),'e2e03-contract-user-20261119','e2e03-contract-session-20261119',
'e2e03-contract','aiko','backend.invoke','caller-ws','owner-ws','e2e03.op');
EXECUTE e2e03_delegation_consume(repeat('c',64),'123e4567-e89b-12d3-a456-426614174111','e2e03-contract-user-20261119','e2e03-contract-session-20261119',
'e2e03-contract','aiko','backend.invoke','caller-ws','owner-ws','e2e03.op');
EXECUTE e2e03_delegation_consume(repeat('c',64),'123e4567-e89b-12d3-a456-426614174111','e2e03-contract-user-20261119','e2e03-contract-session-20261119',
'e2e03-contract','aiko','backend.invoke','caller-ws','owner-ws','e2e03.op');
DO $assert$ BEGIN
  IF (SELECT count(*) FROM public.luth_oauth_invocation_tokens
      WHERE token_hash=repeat('c',64) AND consumed_at IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'delegated invocation token one-use contract failed';
  END IF;
END $assert$;

EXECUTE e2e03_revision_publish('123e4567-e89b-12d3-a456-426614174000','[{"id":"e2e03.op","description":"Fixture operation","inputSchema":{},"outputSchema":{},"invocation":{"serviceId":"e2e03","operationId":"op"}}]');
EXECUTE e2e03_revision_publish('123e4567-e89b-12d3-a456-426614174000','[{"id":"e2e03.op","description":"Fixture operation","inputSchema":{},"outputSchema":{},"invocation":{"serviceId":"e2e03","operationId":"op"}}]');
EXECUTE e2e03_revision_publish('123e4567-e89b-12d3-a456-426614174000','[{"id":"e2e03.op","description":"Updated fixture operation","inputSchema":{},"outputSchema":{},"invocation":{"serviceId":"e2e03","operationId":"op"}}]');
EXECUTE e2e03_revision_read('e2e03-contract','123e4567-e89b-12d3-a456-426614174000');
EXECUTE e2e03_deployment_verify('e2e03-contract','e2e03.op','preview');
DO $assert$ BEGIN
  IF (SELECT count(*) FROM skipo_ecosystem.deployment_capability_revisions
      WHERE deployment_id='123e4567-e89b-12d3-a456-426614174000') <> 2 THEN
    RAISE EXCEPTION 'idempotent capability snapshot/revision contract failed';
  END IF;
END $assert$;

-- Expiry blocks both verified lookup and new capability publication.
UPDATE skipo_ecosystem.deployments
SET lease_expires_at=clock_timestamp()-interval '1 second'
WHERE deployment_id='123e4567-e89b-12d3-a456-426614174000';
EXECUTE e2e03_deployment_verify('e2e03-contract','e2e03.op','preview');
EXECUTE e2e03_revision_publish('123e4567-e89b-12d3-a456-426614174000','[{"id":"e2e03.op","description":"Updated fixture operation","inputSchema":{},"outputSchema":{},"invocation":{"serviceId":"e2e03","operationId":"op"}}]');
DO $assert$ BEGIN
  IF (SELECT count(*) FROM skipo_ecosystem.deployment_capability_revisions
      WHERE deployment_id='123e4567-e89b-12d3-a456-426614174000') <> 2 THEN
    RAISE EXCEPTION 'expired lease published a new capability revision';
  END IF;
END $assert$;

UPDATE public.luth_oauth_invocation_grants
SET status='revoked' WHERE grant_id='123e4567-e89b-12d3-a456-426614174111';
EXECUTE e2e03_delegation_issue(repeat('d',64),'e2e03-contract-user-20261119','e2e03-contract-session-20261119',
'e2e03-contract','aiko','backend.invoke','caller-ws','owner-ws','e2e03.op');
DO $assert$ BEGIN
  IF EXISTS (SELECT 1 FROM public.luth_oauth_invocation_tokens
      WHERE token_hash=repeat('d',64)) THEN
    RAISE EXCEPTION 'revoked grant issued a new token';
  END IF;
END $assert$;

ROLLBACK;
