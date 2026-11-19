# Verified capability discovery — consumer integration

This is a **server-only** adapter. It recovers the proven Skipo registry runtime from the closed #198/#199/#202 stack without changing the canonical database schema or generated frontend AppShell.

## Calling contract

`createVerifiedCapabilityDiscovery(query, policy)` returns `list(request,appId,environment)`, `resolve(request,selector)`, and `revalidate(request,selector)`. It lives in `backend/ecosystem/verifiedCapabilityDiscovery_Impure.ts` and is mirrored byte-for-byte into the generated **Vite backend**, not the browser. Its source of truth is the existing `public."ultrst-apps"` canonical `app_id`. The deployment UUID is separate from OAuth client, workspace, user, or session.

`policy.authenticate` MUST verify a **live Luth session** and bind the authenticated user, session, caller application, source workspace, and target workspace. `policy.authorize` MUST check the live caller scope, target operation, current owner/workspace grant, requested revision and target application; both are mandatory callbacks. Never build either callback using client-submitted principal/workspace/grant identifiers. Missing, changed or revoked authentication fails closed.

The adapter lists only static backend capabilities in the latest verified revision of each deployment, matching an **explicit** environment, current positive ownership proof, unexpired lease, and fresh heartbeat. `list` re-resolves each candidate at the pinned latest revision and invokes the policy before returning it, rather than exposing raw SQL records. `resolve` rechecks the principal after the database lookup. `revalidate` has the same semantics and MUST be called again before invocation. These checks do not replace the **target-side Kloks invocation boundary** and Luth delegated credential revalidation.

## Integration map

| Consumer | Required server integration |
| --- | --- |
| Kloks | Supply trusted registry `Query`, Luth-verified discovery policy, and `FacadeInvocationOptions` operation mapping; enforce target-side authorization at discovery, invoke and output. |
| Aiko | Resolve an explicitly authorized operation in its Luth-bound source/target workspace; use Kloks for remote execution; do not route the legacy invocation ticket. |
| Kone | Persist `appId`, `deploymentId`, `environment`, `capabilityId`, exact numeric revision and typed schema in graph nodes; `revalidate` before execution, not navigation. |
| SRKL | Restrict discovery and storage operations to the authenticated user/workspace; no provider credentials in descriptors. |
| Generated Skipo Vite | The backend mirror is available under `src/backend/ecosystem/generated/`. Host code must supply `policy` and the target-owned Kloks/Luth boundary. Never import this module into the frontend AppShell or use `serviceClient` as trusted cross-app invocation. |

## Schema, ownership and verification gates

This PR does not modify **any** Neon/Skipo migration SQL. The Neon owner must reconcile #198/#203 with #202's verified endpoint pinning, immutable capability history, terminal revocation and role isolation in an isolated branch **before enabling stable-ID heartbeats**. Generated backend runtime and canonical backend runtime must stay byte-identical; the registrar-only `verifiedDeploymentAuthority_Impure.ts` must **never** ship in Vite generated code.

A trusted registrar must authenticate an app owner/deployer, independently prove the HTTPS origin and issue <=30-minute renewable leases in a **separate privileged SQL role**. A manifest, public URL, deployment UUID, OAuth callback, or digest self-assertion is not a valid attestation. SQL role separation prevents untrusted generated applications from writing verified states. Revocation for a deployment UUID is terminal. Rotating a verified origin requires fresh proof, and can require a new deployment identity depending on revocation state.

Actual certified E2E requires: (1) exact-head registry and generated Vite tests, (2) isolated Neon migration replay, role-permission tests and expired/revoked/wrong-environment/malformed descriptor negative cases, (3) integrated Luth/Skipo/Kloks two-user, two-workspace discovery and invocation with consent/revocation, and (4) independent reviewer approval. Do not enable production discovery, release, or migration based on this PR alone.

Registry source recovery provenance: [#198](https://github.com/dinilmusick/Skipo/pull/198), [#199](https://github.com/dinilmusick/Skipo/pull/199), [#202](https://github.com/dinilmusick/Skipo/pull/202). Schema is coordinated through ATAX, not authored here.

## Concrete origin challenge (registrar-only, not a browser API)

`createHttpDeploymentProofAuthority(owner, transport)` is available from
`backend/ecosystem/httpDeploymentProofAuthority_Impure.ts`, **not** from generated
Vite code. It implements the previously abstract `TrustedDeploymentAuthority`
contract. Its injected `owner.authorizeEnrollment` MUST independently verify
the live Luth deployer/session, exact immutable canonical `app_id`, deployment
UUID, **pre-approved** HTTPS origin and declared environment; authorization must
not trust a posted app ID, client-submitted proof digest, guessed URL or bearer
claim without server verification. `authorizeRevocation` MUST separately verify
the owner/controller, including when the old origin is unreachable.

When the owner authority approves the exact binding, the registrar generates a
fresh cryptographic 256-bit nonce and fetches

`GET https://<attested-origin>/api/ecosystem/deployment-proof?nonce=<hex>`

with redirects disabled, no cache, a five-second deadline and a bounded JSON
response. The response must bind `appId`, `deploymentId`, `environment`,
`origin` and the exact nonce. A mismatched origin or redirect is denied. The
registrar computes a fresh SHA-256 proof digest and a fifteen-minute lease,
then passes this attestation to `registerOrRenewVerifiedDeployment`. No user
credential, grant or static capability metadata is transmitted to the target
proof endpoint.

The target backend exposes the proof route **only** when explicitly configured:

```ts
createEcosystemRuntime({
  appId: verifiedCanonicalAppId,
  deploymentId: persistentControlPlaneDeploymentId,
  deploymentEnvironment: registeredEnvironment,
  capabilities: actualBackendMethods,
  authenticate: authenticateViaLuth,
});
```

The target's `APP_URL` must match the HTTPS request origin exactly. Absence
of deployment ID, explicit environment, correct origin or a fresh correctly
formatted nonce yields HTTP 404. Do not derive deployment identity or environment
from the URL. This endpoint alone does not authorize enrollment; the Luth owner
gate and separately privileged registry database credentials remain mandatory.

**Network hardening:** The trusted registrar must impose outbound network
egress restrictions, DNS rebinding protections and approved-domain policy at
its host layer; a DNS-looking public HTTPS string alone cannot guarantee the
resolved IP is publicly routable. No generated application's ordinary database
role may update `verification_state`, proof digests or leases. Existing app
origin allowlists are necessary but do not substitute for owner authentication.

A fifteen-minute lease is renewed only on a newly authorized owner challenge.
Ordinary app heartbeats may update freshness for an unchanged verified
origin/capability set but cannot change verified URL, capability claims,
environment, proof or lease, and cannot resurrect a revoked UUID. Legacy ticket
calls are now restricted to a fresh *unverified* target record; verified app
invocation goes exclusively through Kloks' authenticated target boundary.

All proof tests are fixtures for the Skipo backend protocol, **not** evidence
of a live Luth enrollment endpoint, deployed origin or Neon least-privilege
registrar role. The latter require separate authorized integration gates.

## Exact deployment-instance binding

For invocation persist **all** of `appId`, `capabilityId`, `environment`,
`revision`, and `deploymentId` from an authorized discovery result.
`CapabilitySelector.deploymentId` is optional for broad discovery but
required for target-specific revalidation. Skipo parameterizes the deployment
UUID and rejects a row bound to another instance. Never silently substitute
a deployment with the same app ID or capability revision. Expired, revoked,
retired or missing exact targets must fail closed. Revalidate immediately
before the separate Kloks target-side invocation and output authorization.

## Canonical BackendFacade and BackendRegistry service provenance

The backend runtime's `verifyRegisteredBackendFacadeOperations` accepts the
real Skipo `BackendFacade` (`getService()` and `listCapabilities()`) and
a real Kloks `BackendRegistry` (`getCommand()`/`getQuery()`). The real
facade stores services in a **private Map**, not a public object. Compatibility
inventory inputs may also use a Map or service record, but no descriptor may
pass with only a display name or metadata. Published operations require an
executable installed service, an unambiguous registry handler with matching
domain/operation, and (when exposed) the facade's own capability catalog entry.
The handler is rechecked at every heartbeat so removal publishes a complete
withdrawal snapshot.

**Integration example (server-side only):**

```ts
const facadeOperations = {
  facade: actualBackendFacade,  // installed service facade, not metadata
  registry: actualKloksBackendRegistry, // registered command/query handler
};
verifyRegisteredBackendFacadeOperations(facadeOperations, descriptors);
```

The generated app's `AppBackend.backendFacade` must register its real services
and the Kloks registry must register their actual operations before supplying
these references. An empty default facade, hand-authored descriptor, static
application manifest or manually supplied function is insufficient. Existing
`AppBackend` composition is not automatically enrolled by the registry
library; application wiring is owned by the appropriate consumer.

## Shared capability-handle syntax

Registry publication, verified discovery, target-resolution and legacy
compatibility proxies use the same `validStaticHandle` validator. It accepts
bounded alphanumeric, underscore, dash, dot and colon-qualified identifiers
such as `workspace.list` and `storage:getConnections`. Prototype/thenable
property names and traversal patterns are denied. This closes the discrepancy
where valid immutable operation IDs could be discovered but not registered
by a generated backend runtime. Handle validity does **not** imply permission
to execute: verified operations require the Luth/Kloks target-owned boundary.
