# Skipo Guest Route Authorization

**Status:** Implemented as a fail-closed framework boundary.  
**Scope:** Skipo-generated applications other than Luth.  
**Owner:** Skipo framework.

## Route inventory

| Route group | Guest behavior | Enforcement |
|---|---|---|
| `GET /api/capabilities` | Lists only explicitly guest-enabled capabilities held by the validated lease. | `CapabilityRegistry.list` |
| `GET /api/openapi.json` | Publishes only the same authorized capability set. | Same registry policy as HTTP invocation |
| `GET /api/capabilities/:id` | Returns metadata only when the lease and framework policy both authorize the capability. | `CapabilityRegistry.isAuthorized` |
| `POST /api/capabilities/:id/invoke` | Allowed only for an explicitly guest-enabled capability present in the lease. | Registry invocation guard + request abuse controls |
| `POST /mcp`, `POST /api/mcp` | `tools/list` and `tools/call` use the same registry authorization as HTTP. | Same registry policy + request abuse controls |
| `/api/auth/**` | Remains a Luth authentication boundary; guest credentials are stripped before Luth proxy/session validation. | `luthSession.ts` |
| Other `/api/**` routes | No guest fallback; unsupported/unclassified routes remain not found or require their existing authenticated handler. | Canonical Fetch ingress / existing route handlers |
| Health and static app shell | Public, non-workspace surface only. | Existing public ingress behavior |

## Authorization invariants

1. A guest is represented by a distinct lease principal containing app, deployment, lease, workspace and capability scope. It has no `userId`, Luth session ID or authenticated role.
2. The framework allow-list (`guestCapabilities`) and the capability list on the validated lease must both contain the exact capability ID.
3. Unknown/unclassified capabilities default to authenticated-only.
4. Account/authentication, identity/profile, membership/role, admin, billing/payment, secrets/credentials, OAuth/external-account linking, backup/restore/sync, persistence and cross-session capabilities are hard-denied to guests even if a route is accidentally marked public or guest-enabled.
5. Public capabilities remain public to anonymous callers, but sensitive/durable capability identifiers are still rejected for a guest principal.
6. Luth remains the identity and authenticated-session authority. A guest lease never becomes a Luth identity or authenticated principal.

## Abuse controls

Every request carrying a guest lease to a guest-capable HTTP/MCP route must pass:

- exact same-origin checks for state-changing methods; missing or opaque origins are rejected;
- bounded request bodies (default 256 KiB);
- deployment-shared atomic per-IP and per-lease request counters (default 60/IP and 120/lease per 60 seconds);
- deployment-shared atomic per-IP and per-lease concurrency slots (default 10/IP and 5/lease);
- a trusted deployment-supplied client-IP resolver.

The limiter must provide atomic counters and concurrency acquisition/release across all instances serving a deployment. The framework intentionally does not substitute an in-process map. If the lease service, shared limiter or trusted IP resolver is absent or unavailable, guest requests fail closed with 503; no anonymous access is activated by merely enabling a UI button.

## Integration contract

`createAppExternalInterfaces` accepts a validated `GuestLeaseService`, the explicit `guestCapabilities` list and `GuestRequestGuardOptions`. The default exported interface is unconfigured and therefore cannot accept guest leases. Each deployment must inject a portable lease store and shared abuse-control implementation before guest access can be enabled. Luth is excluded by the lease service contract and remains unchanged.
