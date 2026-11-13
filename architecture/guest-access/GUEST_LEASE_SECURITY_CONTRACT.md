# Skipo Guest Lease Security Contract

**Status:** Proposed framework contract for implementation  
**Scope:** Every Skipo application except Luth  
**Authority:** Skipo owns the guest-mode contract; Luth remains the only identity and authenticated-session authority.

## 1. Security boundary

Guest access is an **anonymous runtime lease**, not a user, account, synthetic profile, Luth session, or application-local identity.

A guest lease grants a narrowly scoped right to use one application deployment and one temporary workspace for a bounded period. It does not create an account, user row, authenticated session, refresh token, or durable workspace.

The request principal is a discriminated union:

```ts
type RequestPrincipal =
  | { kind: "authenticated"; userId: string; luthSessionId: string; roles: string[] }
  | { kind: "guest"; leaseId: string; appId: string; deploymentId: string; workspaceId: string; capabilities: string[] };
```

A guest principal MUST NOT populate `userId`, `luthSessionId`, `x-user-id`, `x-session-id`, or authenticated role claims. The existing Luth verifier remains authoritative for authenticated requests.

## 2. Lease credential and lifecycle

### Credential format

- Generate at least 256 bits of cryptographically secure random entropy for each lease credential.
- Treat it as an opaque bearer secret; do not encode user identity or trust client-supplied lease/workspace identifiers.
- Store only a keyed hash or cryptographic hash of the credential in the lease control record. Never log or persist the raw credential.
- Deliver it only over HTTPS in a host-only, `Secure`, `HttpOnly`, `SameSite=Lax` cookie scoped to the application. Do not put it in URLs, localStorage, sessionStorage, analytics, or error reports.
- The server-side record binds the credential hash to `leaseId`, immutable `appId`, `deploymentId`, `workspaceId`, issued/expiry timestamps, last activity, status, and the server-approved capability set.

### Lifecycle

```text
NONE
  -> ISSUED (server creates isolated workspace + lease record)
  -> ACTIVE (each request validates lease and scope)
  -> REVOKED | EXPIRED | CLEANING
  -> DESTROYED (workspace/runtime resources reclaimed)
```

- Validate the credential on every guest request, including the app/deployment binding, expiry, revocation state, and capability required by the route.
- Use an atomic, shared, deployment-compatible lease store. An in-process map, sticky-memory assumption, or local `/tmp` directory is not a portable source of truth.
- Lease metadata may be retained for the short lease/cleanup window; guest workspace content MUST NOT be written to durable user storage, backups, synchronization providers, or cross-session restore.
- Renewal is server-controlled and bounded by an absolute maximum lifetime. Renewal MUST NOT revive revoked leases.
- Proposed initial defaults for deployment configuration (not hard-coded policy): 2-hour idle expiry and 8-hour absolute lifetime. Deployment owners may tighten these values; they must not make them unbounded.
- Page-exit signaling is best effort only. Server-side TTL/idle expiry and cleanup are authoritative when a tab crashes, device sleeps, or the network disappears.

### Required storage adapter semantics

The lease store must provide atomic create-if-absent, read/validate, touch/renew, revoke, and compare-and-set cleanup transitions. It must support TTL/expiry and concurrency-safe updates across all instances serving the same deployment. If the configured adapter cannot provide these semantics, guest allocation fails closed; it MUST NOT fall back to process memory or persistent workspace storage.

## 3. App and deployment scoping

A lease is valid only for the exact immutable application identity and deployment identity that issued it. Derive those values from trusted deployment configuration, not request body, query string, or caller-controlled headers.

A lease from app A cannot be used by app B, staging cannot use production leases, and a workspace identifier supplied by the browser never selects another workspace. Resolve the workspace from the validated lease record.

Every guest operation must be scoped by the tuple `(appId, deploymentId, leaseId, workspaceId)`. Any mismatch returns an unauthenticated/forbidden response without revealing whether another lease exists.

## 4. Default-deny capability matrix

A generated application declares guest-safe capabilities explicitly. Unknown capabilities and unclassified routes are denied. UI hiding is not authorization.

| Capability / operation | Guest policy | Enforcement |
|---|---|---|
| Read public app shell and static assets | Allow | Public route |
| Use app features that operate only on the lease workspace | Allow when explicitly declared | Guest capability + lease workspace |
| Create/read/update/delete files inside own temporary workspace | Allow within quotas | Workspace adapter scoped to lease |
| Execute app runtime actions | Allow only explicitly declared safe operations | Server-side capability guard + resource limits |
| Read another workspace, user profile, or another lease | Deny | Ownership/scope check |
| Create account, sign in, register, password reset, OAuth callback | Not a guest capability; use Luth flow | Canonical Luth routes only |
| User identity, profile, account settings, roles, memberships | Deny | Requires verified Luth session |
| Secrets, API keys, credentials, private tokens | Deny | Requires verified identity/authorization |
| Billing, payment, subscription, usage administration | Deny | Authenticated account authorization |
| Admin, operator, privileged diagnostics | Deny | Separate privileged authorization |
| External account linking, Google Drive, S3/B2 connections | Deny | Authenticated owner + provider authorization |
| Persistent storage attach, sync, backup, export, restore, cross-session writes | Deny | No durable provider may be attached to guest workspace |
| Guest lease create/renew/revoke | Allow only through dedicated lease lifecycle endpoints | CSRF/origin checks, rate limits, server validation |
| Luth session validation | Never satisfied by guest credential | Luth verifier only |

A capability allow-list is app-specific and server-owned. A browser-provided capability list is never authoritative. Any operation that creates an external side effect or outlives the lease is denied unless a later reviewed contract explicitly permits it.

## 5. Authentication and route composition

The current `src/backend/auth/luthSession.ts` validates authenticated requests by calling Luth `/api/session`; it creates trusted `x-user-id` and `x-session-id` headers only after that verification. Guest support must preserve this behavior unchanged.

The Fetch ingress must classify requests in this order:

1. Public/static routes explicitly marked public.
2. Dedicated guest lease endpoints (issue, validate/renew, revoke/teardown), each with strict origin, method, rate and input validation.
3. Routes explicitly marked guest-capable: validate guest lease, then enforce the route's required capability.
4. All remaining protected routes: require a real Luth session and derive identity only from Luth.

Do not make a guest credential a fallback in `getLuthSession`, `authenticateLuthRequest`, or `requireLuthSession`. Do not set `x-user-id` to a sentinel such as `guest`. External HTTP and MCP capability registries currently register capabilities as `authenticated`; they remain authenticated-only unless a future reviewed change adds an explicit guest-safe access policy.

Luth itself is excluded from guest entry and guest lease issuance by immutable app policy. The exclusion is enforced in the backend, not only by omitting a button.

## 6. CSRF, origin and browser protections

- Accept cookie-authenticated guest mutations only from the exact configured application origin; reject missing, malformed, or mismatched Origin on browser mutation routes.
- Use SameSite cookies as defense in depth, not as the only CSRF control.
- Do not enable wildcard credentialed CORS. Preflight and allowed-origin handling must use the app's configured origin.
- Reject cross-origin lease creation, renewal and teardown.
- Avoid reflecting untrusted Origin values into CORS headers.
- Apply request-size limits and strict schemas to guest endpoints.

## 7. Abuse and resource controls

Enforce limits server-side at both lease and deployment levels:

- Per-IP and per-lease issue/renew/request rate limits.
- Maximum active leases per IP/deployment.
- Maximum concurrent requests and runtime executions per lease.
- Workspace byte, file-count, path-depth and individual-file limits.
- Runtime CPU, memory, wall-clock and outbound-network limits.
- Maximum lease lifetime and idle TTL.
- Safe rejection on capacity exhaustion; never fall back to a durable workspace.

Use privacy-safe counters for active leases, issuance failures, expiry, revocation, quota exhaustion and cleanup failures. Never log guest content, raw credentials, cookies, secrets, or full request bodies.

## 8. Threat model and mandatory mitigations

| Threat | Required mitigation |
|---|---|
| Forged credential | 256-bit random secret; server-side hash lookup; constant-time comparison where applicable |
| Credential theft/replay | HTTPS, HttpOnly/Secure/SameSite cookie, short TTL, revocation, no URL/log exposure |
| Cross-app/deployment replay | Exact server-derived app + deployment binding |
| Cross-lease/workspace IDOR | Resolve workspace from validated lease; scope every operation to lease tuple |
| Guest-to-user privilege escalation | Distinct principal type; never synthesize identity headers; Luth session remains separate |
| CSRF / origin abuse | Exact Origin validation and SameSite cookie defense |
| Resource exhaustion | IP/lease/deployment quotas, concurrency limits, timeouts and capacity fail-closed |
| Race during teardown/renewal | Atomic state transitions; monotonic terminal states; idempotent cleanup |
| Durable data leakage | Guest-only ephemeral provider; persistent adapters unattached; spy/negative tests |
| Luth accidentally enabled | Backend app-policy deny for Luth; test issuance and route rejection |

## 9. Guest-to-authenticated transition

Guest work is temporary and is not silently migrated.

1. Show an explicit warning that guest workspace contents will be discarded when leaving guest mode.
2. Start the canonical Floks/Luth authentication flow without converting the guest lease into an identity.
3. On successful Luth authentication, create or select the user's authenticated workspace through the normal workspace flow.
4. Do not copy guest files, session state, secrets, or runtime state into the authenticated workspace automatically.
5. Revoke and clean up the guest lease. If cleanup fails, its TTL remains authoritative and the authenticated workspace remains isolated.

A future explicit export/import flow would be a separate authenticated, user-confirmed feature and is outside this contract.

## 10. Acceptance and verification

Implementation is acceptable only when all of the following are demonstrated:

- Guest credentials never satisfy Luth session validation or protected routes.
- Forged, expired, revoked, replayed, wrong-app, wrong-deployment and cross-lease credentials are rejected.
- Unclassified routes and capabilities are denied by default.
- Luth cannot issue or accept guest leases.
- Guest workspace data cannot reach Local Folder, S3/B2, Google Drive, backups, sync or cross-session restore.
- CSRF/origin checks, rate limits, quotas and capacity failure are tested.
- Concurrent renewal/teardown is race-safe and idempotent.
- Authenticated Luth flows and existing persistent workspace behavior remain unchanged.
- Browser exit is best effort; server TTL cleanup works without a browser event.

Required test classes: unit tests for credential and policy primitives; Fetch integration tests for route classification; negative security tests for scope/privilege boundaries; concurrency tests for lease lifecycle; persistent-adapter spies proving no durable writes; regression tests for Luth and authenticated workspace flows.

## 11. Existing implementation insertion points (verified on current main)

- `src/app.ts`: canonical Web Fetch ingress; currently dispatches Luth auth proxy, MCP, HTTP and static assets.
- `src/backend/auth/luthSession.ts`: Luth-only session verifier and identity-header attachment. Preserve its authenticated semantics.
- `src/backend/externalInterfaces.ts`: external HTTP/MCP capabilities currently registered as `authenticated`.
- `src/backend/SkipoBackend.ts`: canonical service composition; do not create app-local guest identity services here.
- `architecture/authentication/SKILL.md`: Luth owns identity and authenticated sessions.
- `architecture/workspace-architectures/SKILL.md` and `backend/workspace-storage/SKILL.md`: active workspace abstraction and durable provider boundary; guest must add a non-durable provider path rather than changing authenticated persistence semantics.

This ADR defines the security boundary; it does not claim that guest issuance, storage, route guards, quotas, or cleanup are already implemented.
