# Guest volatile authority service

## Why this exists

The guest workspace provider needs a shared, request-independent volatile data plane. A Fetch handler deployed on Node, Cloudflare, or Vercel cannot assume that process memory or local disk is shared between invocations. Skipo therefore separates the guest application runtime from the volatile workspace authority.

- Generated applications use `HttpGuestWorkspaceStore` from their Fetch runtime.
- One dedicated authority process owns guest bytes and atomic quota counters in memory.
- The authority has no database, object-store, backup, disk, or persistent workspace adapter.
- Every namespace is scoped by the framework-generated app/deployment/lease/workspace key. Configure the authority's `namespacePrefix` to the exact `guest/<encoded-app-id>/<encoded-deployment-id>/` prefix and use a distinct service token per deployment.
- The authority requires a private service token of at least 256 bits; the token belongs only in server-side deployment secrets.
- Node, Cloudflare, and Vercel application handlers use the same HTTPS Fetch client. Their local process memory is never used for guest workspace state.

## Lifecycle

1. The server issues a lease and calls `createNamespace` exactly once as part of guest bootstrap.
2. It returns the guest credential only after namespace allocation succeeds. If allocation fails, revoke the lease and return an error.
3. Subsequent requests validate the lease and use the HTTP store without calling `createNamespace` again.
4. If the authority restarts, all volatile namespaces disappear. Existing lease reads/writes return `GUEST_WORKSPACE_UNAVAILABLE` (410); the application must revoke the affected lease and require a new guest session. Do not recreate the namespace for an existing lease.
5. A scheduled server-side reaper calls `deleteExpired(now)`. The authority also removes expired namespaces during allocation and on every operation. Browser page-exit signaling remains best-effort only.

## Deployment constraints

The authority is intentionally single-process and in-memory. Run exactly one authority instance for one app/deployment namespace unless a future shared-memory authority implementation proves the same atomic semantics across replicas. Set `namespacePrefix` at startup so a leaked token cannot address another app/deployment namespace. Do not run multiple independent instances behind round-robin routing. Use private networking or an HTTPS ingress with service-to-service authentication; never expose the token to browser code. Configure a scheduler to invoke the authenticated `deleteExpired` operation at a bounded interval. The included Node host is a thin adapter and must sit behind TLS termination.

The HTTP client can run in Node, Cloudflare Workers, and Vercel Functions because it depends only on Fetch. This does not certify those hosting providers by itself: each generated app must still prove its outbound authority binding, network policy, secret injection, quotas, and end-to-end lease behavior in its deployment environment.

## Failure semantics

- Missing/invalid authority URL or token: guest activation fails closed.
- Authority unavailable: guest operations fail; never fall back to local process memory or persistent storage.
- Authority restart: all existing namespaces are gone; stale leases fail closed and must be revoked.
- Capacity/quota exceeded: return a stable 429/413 error; never spill into persistent storage.
- Expired namespace: inaccessible immediately and reclaimed by the reaper.

The in-memory implementation is the reference authority and is suitable for a single-process deployment. A horizontally scaled or highly available deployment must provide a separately reviewed volatile atomic authority and pass the same conformance suite with two independently constructed clients.
