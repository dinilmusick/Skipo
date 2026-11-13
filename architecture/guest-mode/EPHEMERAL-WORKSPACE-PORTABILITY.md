# Guest Ephemeral Workspace & Deployment Portability Contract

**Status:** Proposed canonical contract for Skipo guest mode  
**Scope:** Every Skipo-generated application except Luth  
**Owner:** Skipo framework  
**Decision type:** Architecture / deployment portability  
**Related task:** Define ephemeral workspace and deployment portability contract

## 1. Decision summary

Guest mode is a short-lived, anonymous **runtime lease**, not an application user, Luth identity, Luth session, or persistent workspace.

A guest uses the same active workspace filesystem operations as an authenticated workspace, through the existing `WorkspaceFS` boundary. The guest implementation is a distinct `EphemeralWorkspaceProvider`; it must not manufacture a persistent `Workspace` record or attach a persistent storage adapter.

The canonical application remains the Web Fetch handler at `src/app.ts`. Cloudflare, Vercel, and Node adapters continue to delegate to that handler. Guest lease validation, workspace resolution, authorization, quotas, and teardown execute behind this boundary, not in provider-specific business logic.

**No deployment may advertise guest mode as supported unless it can provide lease affinity, isolated volatile workspace state, bounded quotas, and authoritative expiry cleanup.** Missing capabilities fail closed; they never fall back to Local Folder, OPFS, S3/B2, Google Drive, a database-backed user workspace, or an unbounded process-global map.

## 2. Existing contracts and evidence

The decision extends, rather than replaces, these existing Skipo contracts:

- `backend/workspace-storage/SKILL.md` defines the `WorkspaceFS` operations: `stat`, `readFile`, `writeFile`, `deleteFile`, `listDir`, and `createDir`. Its persistent `Workspace` record includes primary and backup storage endpoints; guest mode must not create that persistent record.
- `architecture/workspace-architectures/SKILL.md` makes the filesystem the canonical project-data model and requires application code to use the active workspace abstraction rather than provider APIs.
- `architecture/multi-target-build-spec/SKILL.md` defines one `src/app.ts` Fetch implementation, with generated Cloudflare, Vercel, and Node adapters. Provider files are wrappers, not independent application implementations.
- `scaffolds/vite/src/providers/cloudflare.ts`, `vercel.ts`, and `node.ts` delegate to the common Fetch handler. The same provider pattern is generated for Next.js.
- `scaffolds/vite/src/backend/adapters/httpsAdapter.ts` currently invokes Luth authentication before its application-specific protected routes. Guest support must add an explicit, separately validated guest branch; it must not treat a guest token as a Luth session.
- `architecture/authentication/SKILL.md` reserves identity, session creation, validation, refresh, logout, and revocation to Luth / Better Auth.

The current scaffold evidence does **not** establish a portable ephemeral workspace implementation or reliable cross-request affinity on all three deployment targets. The runtime compatibility table in `docs/runtime-compatibility.md` also marks Cloudflare execution as unverified. Therefore this document specifies a capability-gated contract; it does not claim that existing deployment adapters already satisfy it.

## 3. Workspace provider contract

The guest provider implements the same filesystem operation surface while exposing an explicit ephemeral lifecycle:

```typescript
interface EphemeralWorkspaceProvider extends WorkspaceFS {
  readonly mode: 'ephemeral';
  readonly leaseId: string;
  readonly workspaceId: string;
  readonly state: 'active' | 'disposing' | 'disposed';
  dispose(reason: GuestDisposeReason): Promise<void>;
}

type GuestDisposeReason =
  | 'page_exit'
  | 'lease_expired'
  | 'idle_timeout'
  | 'revoked'
  | 'quota_exceeded'
  | 'deployment_shutdown';
```

Contract invariants:

1. Every filesystem operation resolves the provider from a validated lease. A caller cannot choose another lease's workspace ID.
2. Each lease receives a fresh, unguessable namespace. Two leases cannot list, read, overwrite, rename, or delete each other's files.
3. The provider exposes no persistent storage endpoint, backup list, sync state, hydration job, or reconciliation target.
4. Guest writes remain in volatile/lease-scoped scratch state only. No persistent provider adapter may be constructed, called, or selected.
5. Provider cleanup is idempotent. Repeated or concurrent disposal of the same lease is safe and cannot dispose another lease.
6. Quota checks happen before accepting writes and before allocating additional files or runtime resources.
7. A provider must fail closed if its lease is expired, revoked, unknown, over quota, or no longer bound to the active deployment.

The application-facing workspace facade continues to expose the existing filesystem methods. It selects either a persistent provider or an ephemeral provider from a server-validated execution context. It must not weaken the persistent workspace contract or add guest-only filesystem methods to application code.

## 4. Lease and workspace lifecycle

```text
ANONYMOUS ENTRY
    |
    v
POST /guest/leases  -- reject Luth application explicitly
    |
    v
ISSUE scoped opaque lease credential
    |
    v
ALLOCATE isolated EphemeralWorkspaceProvider
    |
    v
VALIDATE lease on every guest request
    |
    v
WORKSPACE READ / WRITE through WorkspaceFS
    |
    +---- pagehide/sendBeacon ----> best-effort dispose
    |
    +---- idle/max TTL -----------> authoritative expiry reaper
    |
    v
REVOKE lease -> dispose resources -> erase volatile namespace
    |
    v
DISPOSED (terminal; credential cannot be reused)
```

A lease is bound to all of:

- Skipo application ID and deployment ID;
- a cryptographically random lease ID;
- the workspace namespace allocated for that lease;
- issue time, maximum expiry, and idle expiry;
- a policy/version identifier and revocation state.

The credential is an opaque, short-lived bearer capability (or a signed equivalent) held separately from Luth cookies/tokens. The server validates signature/integrity, expiry, revocation, application/deployment scope, origin policy, and lease state on every request. Do not encode or infer a user ID. Do not set a Luth session cookie or authenticated-user header from guest context.

Renewal, if enabled, may extend only the idle deadline and never the configured absolute maximum lifetime. Renewal must be server-authorized and rate-limited. Revocation is immediate at the lease authority.

## 5. Deployment portability and support gate

The Fetch API makes route behavior portable; it does **not** make process memory, filesystem semantics, scheduling, or request affinity portable. Each generated provider must declare and prove these capabilities:

```typescript
interface GuestRuntimeCapabilities {
  leaseAffinity: boolean;
  isolatedVolatileWorkspace: boolean;
  atomicQuotaAccounting: boolean;
  authoritativeExpiryReaper: boolean;
  boundedConcurrency: boolean;
  idempotentTeardown: boolean;
}
```

Guest activation requires every capability to be true. A provider that cannot prove one capability reports guest mode as unsupported and the guest entry is not rendered.

| Deployment target | Evidence in current Skipo scaffold | Portability decision |
|---|---|---|
| Node long-running server | `src/providers/node.ts` creates a long-lived HTTP server and delegates requests to Fetch. | Can use an in-process lease registry and volatile filesystem only when requests are pinned to the same worker/process. Multi-process or multi-instance deployments need a lease-affinity router and shared volatile scratch authority. Process restart loses guest data; this is an explicit session-loss failure, never a persistent fallback. |
| Cloudflare Workers | `src/providers/cloudflare.ts` is a stateless Fetch wrapper. Worker isolate globals are not a durable cross-request workspace or guaranteed affinity mechanism. | Not supported by the current wrapper alone. Requires a deployment-scoped lease coordinator/affinity mechanism and a separately proven volatile scratch provider. Durable Object persistent storage, R2, KV, or D1 must not silently become the guest workspace. A Durable Object used only as coordinator must not claim data continuity from in-memory state across eviction/restart. |
| Vercel Edge / Functions | `src/providers/vercel.ts` and generated Edge packaging delegate requests to Fetch; request execution does not guarantee a shared process or local disk. | Not supported by the current wrapper alone. Requires an explicit lease-affinity and volatile scratch service with bounded TTL and atomic quotas. Function memory and `/tmp` are not a cross-request workspace contract. |

A deployment may implement the volatile scratch authority using a platform-specific service only if its documented semantics meet the contract: no durable workspace attachment, no backups/snapshots, lease isolation, finite TTL, bounded capacity, and verifiable deletion. A service that merely offers durable object storage plus best-effort deletion does not satisfy the strict volatile-workspace requirement.

**No support claim may be inferred from successful compilation, a provider manifest, or the presence of an adapter file.** Each provider needs runtime integration evidence for continuity, isolation, quota enforcement, expiry, restart behavior, and cleanup.

## 6. Quotas and abuse boundaries

Every deployment must supply a finite, validated `GuestQuotaProfile`; missing, zero-as-unlimited, negative, or unbounded values reject guest activation.

Required limits:

| Dimension | Required bound | Enforcement point |
|---|---|---|
| Workspace bytes | Maximum total bytes per lease | Provider before write |
| File count | Maximum files/directories per lease | Provider before create/write |
| Single file size | Maximum bytes per file | Provider before write |
| Lease lifetime | Absolute maximum lifetime | Lease authority |
| Idle lifetime | Maximum inactivity window | Lease authority / reaper |
| Concurrent leases | Per client/IP and per deployment | Atomic lease allocator |
| Concurrent requests | Per lease and deployment | Fetch ingress / coordinator |
| Request rate | Per IP and per lease, with burst ceiling | Fetch ingress |
| Runtime resources | CPU/time, memory, process/worker count | Runtime provider |
| Cleanup work | Bounded retries, batch size, and execution time | Reaper |

Quota values are deployment policy, not universal constants: Cloudflare, Vercel, and Node have different execution ceilings. The configuration schema must require explicit finite values and record the effective profile/version with the lease. Quota exhaustion returns a stable resource-limit response, revokes or freezes the affected lease as policy specifies, and never spills into persistent storage.

Abuse controls also include default-deny route capabilities, strict origin/CSRF checks for cookie-authenticated operations, request-body limits, token replay protection where stateful revocation is required, and privacy-safe telemetry. Logs may contain bounded counters and reason codes, never workspace contents, file names, bearer tokens, or secrets.

## 7. Exit, expiry, and cleanup guarantees

Browser exit is only a prompt:

- Register a `pagehide` handler and send a small, authenticated, lease-scoped `sendBeacon` teardown request where supported.
- Do not rely on `unload`, tab-close delivery, `visibilitychange`, or a browser callback for correctness.
- The server-side lease expiry reaper is authoritative. It must reclaim expired and idle leases even if the browser disappears, the network is unavailable, or the deployment restarts.
- The reaper must use a scheduler/queue supported by the deployment, not an untracked in-process timer as the only cleanup mechanism.
- Teardown first marks the lease as disposing/revoked, prevents new operations, then releases registered runtime resources and removes the scratch namespace. Cleanup is idempotent and uses a lease generation/fencing value to prevent stale cleanup from affecting a renewed or replacement lease.
- Partial cleanup failures are retried within finite bounds and surfaced as privacy-safe operational metrics. Expired leases remain inaccessible while cleanup is pending.

A normal page exit should trigger prompt best-effort disposal. Abrupt disconnect, lost beacon, browser crash, and network partition are handled by idle/absolute TTL expiry. The product must explain that the browser signal is best-effort and TTL cleanup is authoritative.

## 8. Authenticated mode and Luth non-interference

- Guest mode is enabled by Skipo application policy, not by application-local auth code.
- The Luth application is explicitly excluded at both lease issuance and scaffold/configuration validation.
- Guest credentials are never passed to Luth session validation as though they were user sessions.
- Luth-protected routes remain Luth-only. Guest routes are separately tagged with explicit capabilities; unclassified routes deny guests.
- Guest-to-authenticated transition starts the normal Luth flow and a new persistent workspace selection. It does not copy, sync, hydrate, or silently migrate guest files.
- Logging in, navigating away, or closing the page disposes the guest lease according to the lifecycle contract. Guest data loss is expected and must be disclosed.

## 9. Required conformance tests

The implementation and scaffold suites must prove:

1. Positive filesystem contract parity for `stat/readFile/writeFile/deleteFile/listDir/createDir`.
2. Two leases are isolated under parallel reads/writes and guessed workspace IDs are rejected.
3. No persistent adapter, sync engine, backup, reconciliation, or durable workspace record is invoked in guest mode (assert with adapter spies).
4. Missing or non-finite quota configuration prevents guest activation; each quota boundary and over-limit path is tested.
5. Lease credentials reject forged, expired, revoked, replayed, wrong-app, wrong-deployment, and wrong-origin requests.
6. Expiry and idle reaper cleanup works without browser events; duplicate and concurrent teardown is safe.
7. Partial cleanup failure retries within bounds and does not reopen the lease.
8. Process/worker restart behavior is explicit: either affinity restores access through a volatile authority, or the lease fails closed and its volatile data is lost.
9. Provider integration tests exercise the actual Cloudflare, Vercel, and Node runtime adapters; a compile-only test is insufficient.
10. Guest mode is absent for Luth; existing Luth sign-in, registration, OAuth, session refresh, and protected routes remain unchanged.

## 10. Rollout gate

Do not enable guest mode globally until each supported deployment has a completed capability declaration, a provider-specific runtime test report, and passing generated-app tests. Enable only providers that have passed. Unsupported providers continue to expose authenticated mode only.

The next implementation tasks are the lease authority, ephemeral provider/factory, provider affinity and scratch adapters, default-deny route policy, quotas/reaper, scaffold integration, and independent downstream runtime verification. This ADR is the binding design input for those tasks; it is not evidence that those implementations already exist.
