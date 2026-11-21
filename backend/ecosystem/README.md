# Ecosystem deployment registry and capability calls

> **Security scope:** The legacy URL-heartbeat, `findDeployment`, `client`,
> `serviceClient` and ticket-based `/api/ecosystem/invoke` examples below
> are **unverified compatibility only**. They are never evidence of a verified
> deployment or authorization to invoke a published operation. Their database
> paths now exclude verified and revoked deployment records. For trusted calls
> use the Luth-policy-gated `verifiedCapabilityDiscovery` adapter, pinned
> deployment UUID and exact revision, and the target-owned Kloks authenticated
> invocation boundary. See `VERIFIED_DISCOVERY_ADAPTER.md`.
>
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
