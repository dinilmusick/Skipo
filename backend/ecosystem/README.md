# Ecosystem deployment registry and capability calls

Apply `db/skipo-ecosystem-deployments.sql` once to the primary Postgres database
referenced by the apps' `SYSTEM_DATABASE_URL`. The migration creates only the
private `skipo_ecosystem` schema. The application role needs schema usage,
select/insert/update on deployments, select/insert on deployment capability revisions, and select/insert/delete on invocations.
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
verification state/proof digest and an optional lease expiry. Existing and
legacy-heartbeat rows default to **unclassified** environment and **unverified**
ownership until the relevant facts are independently proved. No migration or
registration infers production/preview environment or acquires trust by itself. Unknown `app_id` values fail
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

 
## Versioned static capability snapshots (N4)

Each stable deployment UUID owns an independent, monotonic stream of complete
static capability descriptor snapshots. Identical snapshots are idempotent;
a changed snapshot creates the next revision, so removing an operation removes
it from the current snapshot rather than leaving a stale union. Only a
deployment with a verified control-plane proof and a live lease may publish or
resolve its latest snapshot.

The descriptor allowlist contains only public metadata and service/operation
mappings. The runtime and database both reject nested credential/key material,
session or endpoint fields, URL values, bearer values and JWT-like values.
Snapshots are append-only and immutable; their revision numbers must be
contiguous. Deployment rows with snapshots cannot be deleted.

Run `db/tests/005_deployment_capability_revisions.test.sql` only on the
approved isolated Neon branch after applying the migration. It verifies
independent deployment streams, monotonic revisions, verified/live-lease
gating, recursive descriptor safety, snapshot immutability and rollback.
