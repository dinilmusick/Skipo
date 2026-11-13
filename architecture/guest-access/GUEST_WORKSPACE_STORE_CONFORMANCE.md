# Guest workspace store adapter conformance

## Purpose

Guest mode must not be activated merely because a deployment name is recognized. Each deployment adapter must prove that its guest workspace store satisfies the shared, volatile, lease-scoped contract in `src/guest/GuestWorkspace.ts`.

## Reusable suite

`tests/guest-workspace-store.conformance.ts` exports `defineGuestWorkspaceStoreConformance(adapterName, createPair)`. A concrete adapter should add a Vitest file that passes two separately constructed adapter instances backed by the same deployment-shared volatile authority. The suite checks:

- Request/provider reconstruction preserves the same lease namespace and contents.
- Namespace creation is idempotent and concurrent lease capacity is shared.
- Byte and file limits are enforced atomically across adapter instances.
- Operation, memory, CPU and duration budgets are shared and enforced atomically.
- Namespaces are isolated; teardown is exact-lease scoped and TTL reclamation is idempotent.

The reference fixture in `tests/guest-workspace-store.conformance.test.ts` validates the harness itself. It is an in-memory test double, not a production deployment adapter and not evidence of process- or restart-level affinity.

## Deployment certification requirements

A production adapter must run the suite against its real deployment backing service, not an in-process fake. Its integration evidence must additionally prove:

1. Separate requests and worker instances resolve the same lease namespace.
2. Atomic operations remain correct under concurrent requests.
3. Workspace bytes remain volatile and are never sent to persistent workspace providers.
4. Authoritative TTL cleanup continues without browser page-exit events.
5. Restart, eviction and loss of affinity fail closed or recover only through the explicitly configured shared volatile authority.

Node, Cloudflare and Vercel are not certified by this reference fixture. Guest mode must remain disabled on a target until that target's adapter and deployment integration tests pass. A Redis-like or platform-native store is acceptable only when its deployment configuration and retention semantics satisfy the volatile-data policy; the framework must not silently fall back to process memory, local disk, S3/B2, Google Drive or a durable workspace provider.
