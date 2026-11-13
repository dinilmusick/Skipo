# Skipo Guest Access — Lease, Isolation & Capability Security Model

**Status:** Proposed canonical security contract  
**Scope:** Skipo-generated applications and the Skipo runtime; Luth is explicitly excluded.  
**Authority:** Skipo owns the guest runtime lease and route policy. Luth remains the sole authority for authenticated identity and sessions.

## 1. Security objective

Guest access is an anonymous, temporary execution mode, not a lightweight account. A guest receives a short-lived, revocable capability to use a bounded workspace/runtime allocation belonging to one application deployment. The guest may use application features only when the server explicitly classifies the operation as guest-safe.

The active workspace API remains the application-facing abstraction. In guest mode its backing provider is ephemeral and lease-scoped; no durable workspace provider is selected, hydrated, synchronized, backed up, or reconciled. Closing a page should request prompt cleanup, but browser events are unreliable: server-side expiry is the authoritative reclamation mechanism.

This contract applies to every eligible Skipo app except Luth. Luth must neither expose nor issue Skipo guest leases.

## 2. Trust boundaries and principal model

| Principal / credential | Meaning | Authority |
|---|---|---|
| Luth authenticated session | Verified user identity and session returned by Luth | Authenticated routes and user-owned resources |
| Skipo guest lease | Opaque, temporary capability for one app + deployment + lease + workspace | Explicitly guest-enabled routes and that lease's ephemeral resources only |
| Client-supplied user ID, role, workspace ID or app ID | Untrusted input | No authorization authority |
| Public request without a credential | Unauthenticated caller | Public routes only |

A guest lease MUST NOT create a user, application profile, account, Luth session, synthetic user ID, role, or durable ownership record. Guest state MUST NOT be represented using `x-user-id`, `x-user-role`, `x-session-id`, a Luth cookie, or a Luth bearer token. Do not manufacture sentinel identities such as `guest`, `anonymous`, or `system` and pass them through user-owned service APIs.

The lease identifier is a resource-scope identifier, not an identity. A guest request context should be a distinct discriminated type, for example:

```ts
type RequestPrincipal =
  | { kind: 'luth-user'; userId: string; sessionId: string }
  | { kind: 'guest'; leaseId: string; appId: string; deploymentId: string; workspaceId: string; capabilities: string[] }
  | { kind: 'anonymous' };
```

No implicit conversion exists between these variants. User-only service functions accept only the Luth-user variant.

## 3. Lease credential and lifecycle

### 3.1 Issuance

1. A guest-entry request is accepted only by an eligible Skipo deployment whose machine-readable policy enables guest mode. Luth is denied before issuance.
2. The server generates a cryptographically random, unguessable opaque secret. It stores only a one-way hash of that secret in the authoritative lease store.
3. The lease record binds the credential to immutable `appId`, `deploymentId`, `leaseId`, and `workspaceId` values, a policy version, explicit capabilities, quota profile, issue time, expiry time, and revocation state.
4. The server allocates an isolated ephemeral workspace/runtime before returning success. If allocation fails, no usable lease is issued and no persistent-storage fallback is permitted.
5. The raw credential is delivered only through a dedicated guest channel, never as a Luth token or user identity.

### 3.2 Transport and validation

Use a dedicated host-only, Secure, HttpOnly, SameSite=Strict guest cookie (for example, `__Host-skipo_guest`) scoped to the application origin. Do not reuse Luth's cookie name, Authorization bearer format, or session endpoint. Cross-origin deployments must use an explicitly reviewed origin policy; do not weaken cookie or CSRF protections to make a cross-origin setup work.

Every guest request is validated server-side against the lease store. Validation checks the secret hash, active/revoked state, expiry, policy version, app and deployment binding, workspace binding, capability required by the route, and quota state. Client-supplied lease/app/deployment/workspace identifiers are selectors at most; the validated server record is authoritative.

For state-changing requests, require an exact allowed Origin and apply Fetch Metadata / CSRF checks. Reject missing or untrusted origins where the deployment's browser contract requires them. CORS must not grant credentialed access to arbitrary origins. Rate-limit issuance and requests by both source network signal and lease; do not treat IP address as identity.

### 3.3 State machine

```text
UNALLOCATED -> ALLOCATING -> ACTIVE -> REVOKING -> REVOKED
                    |          |
                    v          v
                  FAILED     EXPIRED
```

- `ACTIVE` is valid only before expiry, while not revoked, and while its app/deployment/workspace bindings still match.
- Renewal, if supported, is an explicit server operation with a bounded maximum lifetime. It must not silently extend a lease forever.
- Revocation and expiry invalidate subsequent requests immediately, even if cleanup is still running.
- Teardown is idempotent and scoped to the exact lease/workspace/runtime instance. A lease can never authorize cleanup of another lease or a persistent workspace.
- Browser page-exit / tab-close signaling is best-effort only. A server-side TTL reaper is authoritative and must reclaim abandoned leases after disconnect, browser crash, network loss, or missed events.
- Partial cleanup failures are observable and retried with bounded backoff. Repeated cleanup must be safe.

### 3.4 Guest-to-authenticated transition

Guest and authenticated modes are mutually exclusive request-principal states. Switching to Luth authentication first revokes and tears down the guest lease, then starts the normal Floks/Luth authentication flow. Guest workspace contents are discarded by default and MUST NOT be silently copied into a persistent authenticated workspace. Any future export/import feature must be a separate explicit user action with its own authorization and content review; it is not part of guest login.

## 4. Default-deny route and capability policy

Every route must declare one of: `public`, `luth-user`, or `guest:<capability>`. An unclassified route is denied. The frontend may hide controls, but server-side route metadata and guards are the authorization boundary.

| Operation / route family | Guest decision | Required rule |
|---|---|---|
| Static assets, health and explicitly public metadata | ALLOW | No private data; bounded response |
| Guest bootstrap, lease status and lease teardown | ALLOW | Dedicated guest lease validation; issuance throttled |
| Core application read APIs | CONDITIONAL | Explicit guest-safe capability and lease-scoped data |
| Active workspace filesystem CRUD | ALLOW | Ephemeral provider only; lease namespace enforced on every operation |
| App runtime / execution | CONDITIONAL | Guest execution capability, strict resource quotas and timeout |
| App-specific writes | CONDITIONAL | Only writes confined to the guest lease workspace; no durable side effects |
| Luth sign-in, registration, OAuth and session endpoints | AUTH FLOW ONLY | Existing canonical Floks/Luth flow remains unchanged; guest credential is never accepted as authentication |
| User profile, account settings and account recovery | DENY | Requires a verified Luth user |
| Secrets, API keys, credentials and environment bindings | DENY | Never expose or mutate user/deployment secrets |
| Billing, subscriptions, payments and usage administration | DENY | Requires authenticated owner / authorized billing role |
| Admin, operator, deployment management and privileged diagnostics | DENY | Requires explicit privileged authenticated role |
| External account linking, OAuth grants and service-account connections | DENY | Requires authenticated user consent and ownership |
| Persistent workspace creation, attachment or provider selection | DENY | No Local Folder, S3/B2, Google Drive or other durable adapter |
| Sync, backup, replication, restore, export-to-cloud or reconciliation | DENY | Guest data must not cross the ephemeral boundary |
| Cross-session sharing, collaboration, invitations and durable publishing | DENY | No durable identity or ownership exists |
| Unclassified or newly added route | DENY | Must be explicitly classified before guest access |

“Core application features” means features whose complete effects remain inside the guest lease and its bounded runtime. A UI feature is not guest-safe merely because it is visible or because its first request is read-only; classify every server-side effect, including background jobs, webhooks, callbacks and service-to-service calls.

## 5. Request authorization algorithm

```text
request
  |
  +-- route metadata missing? --------------------> DENY
  |
  +-- public route? ------------------------------> PUBLIC HANDLER
  |
  +-- luth-user route?
  |      +-- validate with Luth session endpoint
  |      +-- verified user + real session? -------> AUTHENTICATED HANDLER
  |      +-- otherwise ---------------------------> 401
  |
  +-- guest route?
         +-- app policy guest-enabled and app != Luth?
         +-- validate dedicated guest lease server-side
         +-- verify app/deployment/workspace scope
         +-- verify required capability + quotas
         +-- verify Origin/CSRF for mutation
         +-- all checks pass? --------------------> GUEST HANDLER
         +-- otherwise ---------------------------> DENY
```

Guest validation is a separate branch, not a fallback that makes an unauthenticated Luth request succeed. A guest credential presented to a Luth-user route MUST fail. A Luth credential presented to a guest route does not automatically grant guest capabilities; the route's principal policy remains authoritative. The existing Luth session validation path and its identity-header overwrite behavior must remain intact.

## 6. Isolation, quotas and data handling

- Each lease receives a unique workspace namespace and runtime allocation. Two leases must not share mutable files, process state, caches, environment bindings or authorization context.
- The workspace abstraction may remain identical to the application's active workspace API, but the guest provider must not implement or expose durable-provider attachment, hydration, sync, backup or reconciliation operations.
- Allocation and request routing must work across the supported deployment model. Do not assume sticky in-process memory, a long-lived process, local `/tmp`, or a single worker instance unless the provider adapter proves that guarantee.
- Define deployment-configurable hard limits for workspace bytes, file count, runtime CPU/memory, execution duration, concurrent requests, active leases per deployment/source, lease lifetime and idle timeout. Fail closed on exhaustion; never fall back to persistent storage.
- Background work, timers, sockets, workers, subscriptions, child processes and caches created by a lease are lease-owned resources and must be registered for teardown.
- Telemetry may include lease lifecycle, aggregate resource usage, expiry, quota exhaustion and cleanup outcomes. It must not record guest file contents, secrets, raw lease tokens or sensitive request payloads.
- Guest content is disposable. Do not promise recovery after expiry, deployment loss or browser exit.

Numeric limits belong in a deployment policy with versioned defaults and operator-configurable ceilings. This contract intentionally does not invent universal numbers before supported runtime adapters and hosting budgets are measured.

## 7. Threat model and required controls

| Threat | Required control | Verification evidence |
|---|---|---|
| Forged or guessed lease | High-entropy opaque secret; hash at rest; constant-time comparison where applicable; server validation | Invalid/forged token tests |
| Replay after expiry/revocation | Server-side state and expiry check on every request | Expired/revoked credential tests |
| Cross-app / cross-deployment reuse | Bind lease to app and deployment; compare against trusted route/deployment context | Wrong-app and wrong-deployment tests |
| Cross-lease IDOR | Derive workspace scope from validated lease; ignore caller-selected owner IDs | Concurrent lease isolation tests |
| Guest-to-user privilege escalation | Distinct principal types; guest never sets user/session headers; Luth-only routes reject guest | Auth boundary negative tests |
| CSRF / origin confusion | Host-only cookie, SameSite policy, exact Origin validation, Fetch Metadata and strict credentialed CORS | Cross-origin mutation tests |
| Resource exhaustion | Per-source and per-lease rate limits; quotas; concurrency and execution timeouts | Abuse and quota exhaustion tests |
| Cleanup race / partial failure | Idempotent lease-scoped teardown; bounded retries; TTL reaper | Duplicate, concurrent and failure-injection tests |
| Persistence escape | Ephemeral-only provider; no persistent adapter resolution; deny sync/backup APIs | Persistent-adapter spy tests |
| Secret / content leakage through telemetry | Structured allowlisted metrics; redact tokens and payloads | Telemetry privacy assertions |

## 8. Luth non-interference and application eligibility

Luth is excluded from guest issuance, guest route policy, guest workspace provisioning and guest scaffold activation. This exclusion must be machine-readable and enforced by the server, not merely hidden in UI. No guest path may alter Luth's Better Auth configuration, cookies, session endpoint, account records, OAuth grants or authentication lifecycle.

Eligible applications retain the existing Floks `LuthAuthPage`, Luth sign-in/register/OAuth behavior and authenticated workspace path. Guest entry is an additional Skipo-owned entry choice alongside that canonical surface. The guest mode indicator must remain visible while active and explain that work is temporary and will be discarded.

## 9. Implementation seams and current source observations

The current canonical authentication contract places identity, credentials, OAuth, sessions, validation and revocation in Luth; Floks owns the authentication UI and lifecycle; Skipo composes the surface and enforces route protection. The Next.js and Vite scaffold session adapters currently validate Luth sessions and attach verified `x-user-id`, `x-session-id` and `x-user-role` headers. Guest support must be introduced as a distinct principal branch without weakening this behavior.

The current workspace contract models an active working filesystem followed by persistent storage reconciliation. Guest mode therefore needs a provider/factory boundary that makes durable adapter selection impossible rather than simply skipping a UI save button. The existing Next.js workspace route also reads a user ID from headers or query parameters; this must not become a guest authorization path. Guest workspace access must derive scope from the validated lease.

This document is the security design for subsequent implementation tasks. It does not claim that guest lease issuance, route guards, ephemeral provider allocation, TTL cleanup or quota enforcement already exist.

## 10. Acceptance and verification gates

A conforming implementation is not complete until all of the following are evidenced:

1. Threat model and route/capability matrix are reviewed and default-deny.
2. No guest credential creates or impersonates a user, Luth session, role or user-owned workspace.
3. Every route is classified; unclassified routes deny guest access.
4. Forged, expired, revoked, replayed, wrong-app and wrong-deployment leases fail.
5. Concurrent leases cannot read or mutate each other's workspace/runtime resources.
6. Guest workspace writes cannot reach persistent adapters or reconciliation pipelines.
7. Origin/CSRF, rate-limit, quota, cleanup-race and telemetry privacy tests pass.
8. Luth authentication and authenticated workspace regression tests remain green.
9. Luth guest exclusion is enforced by server policy and generated-app policy.
10. Deployment adapters document proven affinity, storage and cleanup guarantees; no unsupported runtime assumption is made.

**Related canonical contracts:** `architecture/authentication/SKILL.md`, `architecture/workspace-architectures/SKILL.md`, `backend/workspace-storage/SKILL.md`, `backend/SKILL.md`.
