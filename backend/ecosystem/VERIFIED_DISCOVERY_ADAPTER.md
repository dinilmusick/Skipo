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
