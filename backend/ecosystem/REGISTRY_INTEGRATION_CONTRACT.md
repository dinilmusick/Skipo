# Verified Skipo registry: Kloks and consumer integration contract

**Status:** staged, not a live authorization certificate. The authoritative parent is the
ATAX unified identity goal `0382f1f3-33a7-43c4-9de2-f55011169afd`.
This contract describes the integration gate for the registry stack
`#160 → #193 → #198 → #199 → #200 → #202`. It does not add another
identity, credential, scheduler, registry, or BackendFacade implementation.

## Identity and registration

- `app_id`: immutable canonical application from `public."ultrst-apps"`.
  Do not derive it from URL, OAuth client, browser, native installation,
  session or user.
- `deployment_id`: stable UUID identifying one deployed target instance.
  Different deployments may share an `app_id`; runtime restart must not mint
  another ID. Existing verified URL and legacy capability claims are pinned.
- `environment`: one of `development|preview|staging|production`; a caller
  must request the exact environment, never fall back to another environment.
- `verification_state`: `unverified|verified|revoked`. Legacy writes never
  confer verified status. Revoked UUIDs are terminal.
- `verification_proof_digest` and `lease_expires_at` are necessary but **not
  sufficient**. The independent trusted registrar must validate application
  ownership and deployment endpoint control, authenticate the deployer, issue
  bounded leases, and reauthorize renewals. Only that registrar may issue
  `verification_state='verified'`. Ordinary app heartbeats cannot attest
  an endpoint, renew verified leases or change a verified endpoint.
- Move a verified endpoint only through authenticated withdrawal of existing
  verification, new independent endpoint proof and a new lease. To recover a
  revoked instance, use a new deployment UUID. Rollback does not promote legacy
  entries or rotate canonical IDs.

## Static capability publication

- `deployment_capability_revisions` is an immutable, per-deployment **complete
  snapshot** ordered by positive integer `revision`. Repeating an identical
  snapshot is idempotent; replacing/withdrawing operations creates a new
  revision. No historical snapshot may be used for new discovery.
- The publisher must enumerate its actual registered
  `BackendFacade.services[serviceId].execute(operationId, ...)` operations and
  bind each safe public descriptor to an installed callable
  `capabilities`/`serviceCapabilities` handler ID. A static manifest or
  caller-provided descriptor is not authority to invent a method. The current
  Skipo runtime checks callable ID presence; the **Kloks owning composition**
  still must verify the `serviceId` + `operationId` origin and positive
  authorization metadata.
- Static `StaticCapabilityDescriptor` keys: `id`, `description`,
  `inputSchema`, `outputSchema`, `invocation: {serviceId,operationId}`,
  and optional `name`, `serviceName`, `access`, `requiredRoles`,
  `discoverable`. Do not publish secrets, workflow code, session endpoint,
  bearer, provider credentials, host-local state or private graph definitions.
- For GutTS `StaticCapabilityV1`, map canonical `appId`, `deploymentId`,
  descriptor `id` to `operationId`, numeric registry `revision` to string
  `revision`, and safe display/scopes/typed parameter metadata. `kind='backend'`
  requires the verified backend deployment; `kind='frontend'` is only a
  **capability class** and must never make a session/window discoverable.
  Frontend invocation requires an independently bound live session and consent.

## Discovery and invocation (Kloks #111)

- Skipo's `resolveVerifiedCapabilityDeployment(query,appId,capabilityId,
  environment,exactRevision?)` returns either `null` or
  `{deploymentId,url,revision,descriptor}`. Selection enforces proof fields,
  verified state, unexpired lease, fresh heartbeat, exact app/environment,
  latest complete snapshot and exact optional revision. Re-resolve on invocation;
  a prior discovery result is never enduring authority.
- Kloks `FacadeInvocationOptions.listCurrentOperations(workspaceId)` must
  return only safe current static descriptors and explicitly published workflow
  metadata, materialized as `FacadeOperationDescriptor`: `id,version,name,
  kind,targetWorkspaceId,serviceId?,serviceOperation?,workflowId?`.
  `serviceOperation` maps from Skipo `invocation.operationId`. `version`
  pins the immutable snapshot/workflow version.
- Kloks `deploymentEligible(decision)` must combine verified Skipo eligibility
  with availability of the exact target workspace for that credential. A valid
  URL alone never establishes target workspace access.
- Kloks `verifyLuthCredential(bearer,targetAppId)` must validate signature,
  audience, principal/session expiry/revocation and delegated ancestry for
  **each** HTTP/MCP/graph/agent hop. `authorize(decision,phase,value)` must
  re-evaluate publication ownership, caller/source workspace/target workspace
  grants and ACL during **discovery, invoke and output**; withdrawals and
  revocations take effect immediately.
- Kloks `consumeInvocation` must be durable and atomic (replay rejection,
  budget debit). `delegateCredential` is issued by Luth for the selected
  target audience. Do not accept caller-supplied user IDs, app ancestry,
  grants, or session IDs as authority. Enforce budget, recursion limit,
  deadline and cancellation.
- All supported transports must use Kloks' **single** host-owned
  `createFacadeInvocationBoundary`, with the target's existing
  `BackendFacade`. A legacy `/api/ecosystem/invoke` single-use ticket and
  `findDeployment` alone are **not** production cross-app authorization.

## Rollout and independent gates

1. Trusted app/deployer enrollment and DB authority separation: untrusted
   application SQL role cannot issue or extend verified proofs/leases.
2. Canonical Kloks operation enumeration, GutTS contract mapping, safe
   frontend-class publication; no forged or unbound methods.
3. Exact-head tests (including generated Vite), isolated nonproduction SQL
   negative cases (forged ID/origin, replay, stale lease, revoked row, wrong
   environment, stale revision), and independent two-app invocation/ACL tests.
4. Demonstrate rollback preserving app IDs, historical revisions and grants.
   Never enable verified-only consumer cutover or delete legacy records until
   the authorized migration and independent certification are complete.

No production SQL mutation, merge, release or auth cutover is implied.


## Validated source-of-truth contract

Skipo `createEcosystemRuntime` requires `backendFacadeOperations` when
`capabilityDescriptors` are provided. The source must expose the real
Kloks `BackendRegistry.getCommand/getQuery` registered handler and a
matching live `BackendFacade.services[serviceId].execute`. No invented
operation, alternate registry or metadata-only method can pass.
The target's `createFacadeInvocationBoundary` remains responsible for
Luth and workspace/ACL authorization. Snapshots cannot be edited after
publication; publish a new complete immutable revision to withdraw operations.

## Trusted lease registrar handoff

The private Skipo backend now has a registrar-only
`verifiedDeploymentAuthority_Impure.ts` adapter with trusted callbacks
for independently proven app/deployer ownership and endpoint challenge.
It offers bounded attestation-driven first registration/renewal and
owner-approved terminal, idempotent revocation. It is **not** included in
generated Vite runtimes. The trusted host must wire real Luth/deployer
verification and a distinct least-privilege registry SQL role; neither a
frontend session nor local project manifest may serve as the verifier.
Callers cannot extend a lease or mutate a verified origin through ordinary
app heartbeats. Only after verified registrar integration should the
authority flag in Skipo enrollment/Luth consumer PRs #161/#180/#187 be enabled.

A rollback-safe DB fixture is committed at
`db/tests/005_verified_deployment_registry_negative.test.sql`. It must
be run with error-stop on an isolated fork after exact migration replay,
not against production.
