# ULTRST Universal Luth Initialization — Authentication Skill

**Canonical identity authority:** Luth / Better Auth (official OAuth provider). **Canonical configuration authority:** existing ULTRST system Neon database, accessed through protected Luth configuration APIs. **SRKL:** account and connected-service management only. **ATAX:** separate persistent ledger; not the ULTRST application database.

## Required application initialization

1. Public `GET /api/discovery/v1?app_id=<registered_app_id>` at the pinned Luth issuer, before login. `app_id` is canonical; `APP_URL` is a deployment origin, not identity.
2. **Floks `LuthOidcGate`** presents the hosted Luth OAuth/Google/email sign-in. Use `ApplicationOidcAuth` and the Kloks `createApplicationAuthClient` only as the opaque app-origin HttpOnly session interface. Do **not** use the legacy `LuthAuthPage` browser bearer client for a BFF application.
3. The **Kloks** `createApplicationUniversalInitializationClient` validates GutTS v1 discovery metadata and issuer, then calls only the app-origin `/api/initialization/config` with `credentials: 'include'`. It never exposes or creates an OAuth token or confidential secret in frontend JavaScript.
4. A **protected backend route** mounts `createCanonicalApplicationOAuthBff(request, env, appId)` before generic proxy/API routes. Kloks verifies the first-party session cookie, retrieves the server-held OAuth bearer, calls Luth `/api/config/v1`, validates application identity/consent and exact principal, revalidates session revocation and returns explicitly allowlisted no-secret data.
5. Render services, accounts, workspace UI or agent/workflow execution only when `configuration.principal.userId === authenticatedSession.user.id`. On 401/403/503/issuer mismatch: fail closed with explicit unauthenticated/denied/unavailable/retry states. No silent fallback, security downgrade, or automatic login loop.
6. Logout invalidates application configuration, browser readiness and server-held session. No application-owned OAuth/password/session issuer.

## Shared ownership and source locations

- **GutTS**: public discovery/configuration types, protocol validation, issuer pinning, native public-client PKCE contracts.
- **Luth**: verified OAuth issuer, protected config read from Neon, canonical app registry and registered-origin/consent checks.
- **Kloks**: public runtime discovery client, OAuth BFF, encrypted session, protected config continuation, supported server/Worker adapters.
- **Floks**: shared `LuthOidcGate`, loading/error/login UI; do not rebuild it inside each app.
- **Skipo**: deterministic generic and Vite scaffolding, CLI generators, `checklists/21_skipo_authentication_contract.py`, exact-head integration and cleanroom verification.
- **SRKL/Aiko**: consumers of shared initialization, retaining their own account and workflow responsibilities.

Production BFF still requires protected operational connection(s) and registered OAuth credentials during the **transition**. `SYSTEM_DATABASE_URL_1` is canonical and optional `_2/_3` are fallbacks; old unsuffixed `SYSTEM_DATABASE_URL` is a reviewed compatibility alias. Do not move a privileged database credential into a browser or distribute it to native apps. Removing ordinary runtime direct access depends on separately verified trusted-workload authorization and secure provisioning; it cannot be simulated with caller headers or APP_URL.

## Generated CLI & compatibility contract

- The generic generator: `scripts/scaffold_app_structure.py` creates application pages, and **`scripts/generate_provider_packaging.py` owns the single generated Fetch `src/app.ts`** for Node, Cloudflare Workers and Vercel. Do not replace or duplicate that canonical Fetch entrypoint.
- Vite uses `scaffolds/vite/src/app.ts`; generated login UI uses Floks `LuthOidcGate`.
- `LoginGate` is a legacy compatibility facade but must use the same OIDC gate and independently verified config principal, never the old bearer client.
- `scaffolds/vite/src/libraries/client/luthAuthClient.ts` may use `createApplicationAuthClient`, but `luthFetch` must strip Authorization, reject cross-origin API URLs and use first-party cookies only.
- No custom `better-auth` import, password hash handling, token storage, client-secret retrieval, auth-table schema or fabricated JWTs in generated apps. No legacy `AuthServiceFacade`.
- Existing app-specific services, pages, workers, account settings and workflows must survive scaffold `add/repair`; refuse overlapping writes without ATAX claims.

## Verification required before merging

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run test
pnpm run typecheck
python3 checklists/21_skipo_authentication_contract.py
python3 -m pytest -q --import-mode=importlib tests/universal_initialization_scaffold.test.py
```

Test exactly installed **published** GutTS/Kloks/Floks exports plus independent packed CLI generated-app builds. Reconcile every failed check, not just compilation. E2E must validate actual Luth discovery, real admin-enrolled OAuth clients, PKCE/state/redirect, Google/email, user + app + workspace isolation, session expiry and revocation, Luth/Neon outage, Workers/Vercel/Node. Native/headless flows must be separately proven in their actual runtime and registered identity before calling them supported. Unverified published dependencies, missing legitimate enrollment or runner failures are **BLOCKED**, never PASS.

Record commits, PRs, dependency versions, verified CI, negative test evidence, and blockers to the canonical ATAX Supabase ledger before releasing claims. A passing source build is not production authorization evidence.
