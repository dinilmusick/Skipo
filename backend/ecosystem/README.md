# Ecosystem deployment registry and capability calls

Apply `db/skipo-ecosystem-deployments.sql` once to the primary Postgres database
referenced by the apps' `SYSTEM_DATABASE_URL`. The migration creates only the
private `skipo_ecosystem` schema. The application role needs schema usage,
select/insert/update on deployments, and select/insert/delete on invocations.
Grant these only to trusted ecosystem backend roles. Database writers share a
trust boundary and can act on behalf of the code running on those servers.

Set each deployment's `APP_URL` to its canonical public HTTPS origin. Skipo
uses the configured origin and a stable application ID from the backend
composition. It never derives a registration URL from incoming request headers.
The database preserves the first registration time and updates
`last_refresh_at` on each heartbeat for the same app and URL. Different URLs
for the same app have separate rows.

Long-running Node processes refresh every five minutes from startup. Cloudflare
Workers refresh on first traffic and use the five-minute scheduled trigger.
Request-driven serverless deployments refresh on invocation. For idle Vercel
deployments that must remain discoverable, configure a platform monitor to call
`/api/health` at least every five minutes. The registry retains historical rows
and routes only to deployments refreshed within the last 15 minutes.

## Additive canonical app identity migration (v2)

The same `db/skipo-ecosystem-deployments.sql` remains re-runnable on existing
installations. It adds a UUID `deployment_id`, a foreign key to the existing
Neon `public."ultrst-apps"(app_id)` unique catalog, an environment,
verification state/proof digest and an optional lease expiry. Existing rows
are automatically backfilled with immutable UUIDs and remain **unverified**
until a separately approved deployment-control verification; no registration
acquires trust merely by running this migration. Unknown `app_id` values fail
closed. Deployment `app_id` and `deployment_id` are immutable even when
endpoints are updated. Existing `(app_id, app_url)` heartbeats, primary key
and invocation routing are retained for compatibility.

Approved deployers can opt in to `createEcosystemRuntime({ appId,
deploymentId, ... })` with a **persistently provisioned** deployment UUID.
The opt-in `refreshDeploymentById` upsert can change the endpoint without
changing the deployment's identity, and rejects attempts to reuse an existing
deployment ID for another app. The ID is not generated from `APP_URL` or a
device URL. Do not invent a UUID on every runtime boot; do not enable
production OAuth/native callbacks or authorization from this schema alone.

**Rollback:** Deploy rollback of the new Skipo code first (legacy heartbeat
and registration remain compatible). On a disconnected test database, the
reversible schema delta is the new trigger/function, new app FK/check
constraints, unique UUID index and the five additive columns. Do not remove
them from production until all code and recorded references have been audited.
A dry-run SQL fixture can be enclosed in a savepoint/exception subtransaction,
demonstrating that successful/failed test writes leave zero persistent rows.
The Neon migration must be tested independently before any production cutover.

Use the backend facade's ecosystem member:

```ts
const apps = await AppBackend.ecosystem.client(request, env);
const workspaces = await apps.aiko.listWorkspaces({});

const services = AppBackend.ecosystem.serviceClient(env);
const providers = await services.frnes.listStorageProviders({});
```

`client` verifies the incoming Luth session. `serviceClient` carries the caller
app identity and can invoke only service capabilities. Each receiving backend
explicitly binds its exposed names to operations through its facade composition.
The default workspace list returns IDs and names for the verified user. Never
bind credential or raw-storage operations to the invocation surface.

For each call Skipo chooses the most recently refreshed deployment advertising
the requested capability. It uses a single-use database ticket bound to the app
and URL. The HTTP call carries only that ticket. The target consumes it
atomically and applies its local capability authorization. Calls have a timeout
and no automatic replay. Restrict the database roles that can register origins
and apply the deployment platform's outbound network policy.

Generated projects ship the portable runtime and SQL. To refresh an adopted
project's generated files, run `python3 scripts/sync-ecosystem-runtime.py APP`
from the framework checkout. The app's composition and provider adapters own
its application ID, capability choices, and lifecycle wiring.


## Versioned static capability snapshots

Stable deployment identities may publish complete static capability descriptor
snapshots with `publishDeploymentCapabilityRevision`. Each deployment has an
independent monotonic revision stream. An unchanged descriptor set is a no-op;
a changed set creates a new immutable revision, so removing an operation
withdraws it from the current snapshot instead of leaving stale unioned data.

Only deployments with `verification_state = 'verified'`, a nonblank
`verification_proof_digest`, and a future `lease_expires_at` can publish or
resolve a current snapshot. Field presence is not deployment attestation: only
a separately authenticated registry authority can establish control and issue
or renew the lease. Existing
unverified deployments remain unavailable to this descriptor resolver.
Descriptors are allowlisted static metadata (schemas, access policy and
BackendFacade service/operation mapping); session endpoints, credentials,
tokens, workflow definitions and secret material are rejected/not stored.
The Vite scaffold receives byte-identical SQL and runtime copies.

## Metadata-only workflow publication and grants (v3)

The registry stores only a workflow descriptor: canonical app, owner, owning
workspace, stable workflow ID, immutable version, display name, description,
and publish/withdraw state. Workflow definitions, graph nodes, source,
execution inputs/outputs, credentials and runtime payloads remain in the
owning application's workspace.

A publication's identity, version and display metadata cannot be changed after
creation. Withdrawal is one-way. Publish a changed workflow as a new version;
never rewrite an existing published version.

A grant binds one publication to an exact caller app, source workspace and
target owning workspace. The grant scope and grantor are immutable. Only the
publication owner may grant or revoke. Revocation is permanent and leaves an
auditable row. Publication and grant history cannot be deleted. A later grant creates a new row; a partial unique index allows
only one active grant for a given publication/caller/source/target scope.
New grants are refused for withdrawn publications.

Registry rows are metadata, not authorization tokens. The publishing API must
authenticate the Luth principal and verify publication ownership before
granting or revoking. Every target invocation and nested hop must re-check the
current publication state, owner, caller app, source and target workspaces,
requested version, and active grant. A withdrawn publication or revoked grant
must fail closed immediately. Do not infer authorization from discovery
results, cached descriptors, deployment leases or caller-supplied user IDs.

The migration explicitly drops the earlier all-history `workflow_grants_scope_unique`
constraint before creating the active-only partial index, so re-applying over
an existing first-draft N5 schema still permits auditable re-grants.

The isolated Neon test fixture is
`db/tests/004_workflow_publication_grants.test.sql`. Run it only after
applying the migration on the approved isolated development branch. It verifies
owner/workspace isolation, immutable publication and grant fields, one-way
withdrawal/revocation, auditable new-row re-grants, duplicate-active refusal,
withdrawal gating and zero-fixture rollback.
