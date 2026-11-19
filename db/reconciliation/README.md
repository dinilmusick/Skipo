# ULTRST E2E03 — Canonical Neon schema migration and safe rollback

**Review-only. Production is not authorized for DDL, application cutover, grant enrollment or legacy cleanup.**
Project: `red-mode-38205509`. Production branch (read-only inspection): `br-calm-glitter-ae5fen6h`.
ATAX goal: `0382f1f3-33a7-43c4-9de2-f55011169afd`.
See [SCHEMA_COMPARISON.md](SCHEMA_COMPARISON.md) for the observed schema and limitations.

## Identity ownership and trust boundaries

- `public."ultrst-apps"(app_id)` is the only immutable app identity; its historic `id` is also retained. Neither deployment URL, user, OAuth client, nor workspace becomes an alternate app identity.
- `skipo_ecosystem.deployments` uses a distinct immutable `deployment_id`, environment, proof digest and expiry. Verified status/proof fields require an authenticated registry authority; a SQL proof-shaped string is NOT ownership attestation.
- `deployment_capability_revisions` stores immutable, sequential metadata snapshots of static BackendFacade operations. The caller-facing registry must check current proof, revocation, live lease, and exact revision.
- `workflow_publications` stores owner-app/workspace/version **pointers**, never source workflow bodies. `workflow_grants` binds the caller app/source workspace to the owner's target workspace; grant revocation and publication withdrawal are terminal.
- Luth owns OAuth clients, exact redirects, PKCE code hashes, invocation-grant and single-use token tables. Luth's live session/grant verification and Kloks target-side authorization are still required: RLS is defense in depth, not caller authorization.
- The schema is **backend-only**: no general user/anonymous RLS policies. Keep the Neon owner/service credential server-side; never expose it to browsers or client bundles.

## Exact migration order (isolated branch only)

First select the **explicit non-production Neon branch ID**. Always compare it against the production ID above. Make a current-production snapshot clone when branch capacity permits; no existing branch should be deleted to free capacity without authorization. Run every SQL file with `psql -X -v ON_ERROR_STOP=1 -f FILE`, under the selected branch's database-owner connection. Do not permit a default Neon branch fallback.

1. Inspect historical counts and preserve source-to-target app ID associations. Apply the existing deployed baseline, if absent: Luth `db/migrations/001_luth_registry.sql`, `002_system_credentials.sql`, and Skipo main `backend/ecosystem/db/deployments.sql`. These are already present on inspected production; do not re-seed client/origin approval.
2. `db/reconciliation/20261119_skipo_normalized_schema.sql` — database-only frozen Skipo #198 normalized deployment, revision, FOD publication/grant contract. This is deliberately **not** wired into app runtime or deploy scripts; reconcile the equivalent Skipo-owned source before merge to avoid two independent schema authorities.
3. Current Luth **main** migrations `db/migrations/003_canonical_oauth_app_clients.sql`, then `004_pkce_authorization_codes.sql`, then `005_invocation_grants.sql`. Do not use the older PR #4 version of 003; the current version enforces verified parent callbacks and revocation.
4. `db/reconciliation/20261118_canonical_neon_guardrails.sql` — immutable catalog key/app ID and verified proof/lease consistency. It fails on conflicting verified legacy rows rather than changing them.
5. `db/reconciliation/20261119_registry_integrity.sql` — private RLS/default-deny, terminal deployment revocation/deletion protection, immutable revision history and exact sequential live-lease publication.
6. Repeat steps 2–5 and assert no duplicate triggers/constraints, unchanged catalog/legacy route row counts, and unchanged app IDs. Run the read-only `20261118_existing_record_mapping.sql` and `20261119_normalized_contract_preflight.sql`; all six `migration_blocker` findings must be zero. The two `runtime_filter_only` counters require runtime checks even when zero.
7. Execute Skipo `db/tests/005_canonical_neon_guardrails.test.sql`, `006_neon_registry_integrity.test.sql`, and Luth `db/tests/003_canonical_oauth_app_clients.test.sql`, `004_pkce_live_app_session_guard.test.sql`, `005_invocation_grants.test.sql` in disposable transactions. Check unauthenticated-role SELECT denial, revocation, one-use token and version immutability.
8. Rehearse rollback on the isolated branch: `20261119_registry_integrity.rollback.sql` and `20261118_canonical_neon_guardrails.rollback.sql`, in that order. Verify the extra triggers disappear, app IDs/routes/counts survive. Reapply both migrations to test replay. For a production code rollback in the future, prefer disabling new writers/reads while **retaining additive tables and RLS**: dropping tables would lose workflow/grant history.

## Required deployment configuration and approval gates

- A vetted private Neon PostgreSQL connection for each relevant backend; Kloks uses `SYSTEM_DATABASE_URL`, with optional `SYSTEM_DATABASE_URL_2` and `SYSTEM_DATABASE_URL_3` failover URLs. Ensure all services are explicitly aimed at the same approved target environment and cannot silently fall back to production during isolated tests.
- `APP_URL` per web deployment must be an exact trusted origin. Record the immutable `app_id` separately from URL, OAuth `client_id`, `deployment_id`, users, workspaces and environment. Configure Luth service URL and exact client callback registrations from the application contract; do not derive them from untrusted request headers.
- Database migration identity/permissions must be restricted to operator-owned backend roles. No public `PUBLIC` grants; service roles must stay server-side. Explicitly provision any web/native registration ownership proof, deployment origin proof, user grants, and FOD authorizations through their respective authorities — this migration performs NONE automatically.
- No production migration or cutover until: upstream registry/Luth/Kloks versions are reconciled; current-production-derived isolated branch fresh/replay/negative/rollback tests pass; independent live two-user cross-app tests pass; preflight is zero; explicit production approval is recorded.

## Executed isolated evidence — November 19, 2026

- Existing current replay branch `br-icy-math-aeaz1vu2`: 40 SQL statements for Luth 005, additive catalog guards, security fixtures, guard rollback/reapply and final savepoint rollback. Guard counts `1 → 0 → 1 → 0`; 11 apps before/after; Luth grant tables absent after rollback.
- Same current replay branch: 62 SQL statements for integrity forward/replay, negative fixtures, rollback/re-forward and final savepoint rollback. E2E03 trigger counts `3 → 0 → 0` (final zero because entire test transaction was reverted). No persistent writes.
- Historical isolated baseline `br-polished-rain-aegwhtcf`: **145 SQL statement executions** from normalized Skipo schema, current Luth 003/004/005, both guardrails, both test fixtures, Luth grant fixture, preflight, explicit rollback/re-forward, and outer savepoint rollback. Six migration blockers reported zero; 10 preexisting app rows preserved (10→10); normalized revisions and Luth grant tables absent after rollback; new hardening triggers `0 → 3` after explicit rollback/re-forward.
- Read-only production inventory: 11 catalog apps, 14 origins, 1 Luth route, 1 SRKL route, 1 legacy Skipo deployment. The inspected production schema does not yet have normalized OAuth clients/codes/grants or Skipo revisions/publications/grants.
- **Limitations:** The Neon project is at 10 branches; a fresh clone from the latest production state was not made. Existing historical branches are not equivalent to a current-production clone. Runtime proof verification, native/web OAuth E2E, grant-target invocation and real production cutover were not tested here.

These are SQL-level results on isolated test transactions, **not** deployment or end-to-end authorization certification. No production schema or records were altered.
