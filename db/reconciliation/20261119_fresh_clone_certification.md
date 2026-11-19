# E2E03 current-production-derived Neon certification (2026-11-19)

## Isolation and immutable source heads
- Source Neon project: `red-mode-38205509`; **production** `br-calm-glitter-ae5fen6h`, read-only throughout.
- Target newly created from production at 2026-11-19 07:57:47 UTC: `br-misty-cake-aefv6ko2`, name `e2e03-current-production-schema-20261119`.
- Branch quota: Neon was at ten. Explicit user authorization to remove blockers permitted retirement of historical disposable leaf `br-polished-rain-aegwhtcf` (10 apps/6 origins, no children or other live connections). Historical evidence remains recorded in PR #209 and ATAX; the old branch was deleted. Other isolated branches preserved.
- GitHub Skipo database review: PR #209. No runtime, registry, frontend, or production files changed.
- Luth main migration 003 blob `4198b1ac27f873495e32c9668d6aca2c8fbf6d32`, 004 `2d60df52bd585e919f9d37bef6b1d40b18685560`, 005 `58d3ed824482e2497f177fc2b8ecf661546a1a3c`.
- Skipo frozen normalized migration `20261119_skipo_normalized_schema.sql` blob `7abdf2c9ed97bd46c986e625381b7e9fb24ef6ec`. Catalog and proof guard `49981d4e7f2ac775c44deb759614986feb4b23f0`. RLS/revision integrity migration `784b33d39031bc3ab820d9b56b1906018d23dffa`.

## Original production snapshot parity
Exact initial counts observed on BOTH production and its new child (read-only):
11 canonical apps, 14 legacy authentication origins, 1 Luth route, 1 SRKL route, 1 legacy Skipo deployment. Before/after **five independent MD5 hashes** of catalog identity/status/origin, auth-origin associations, Luth routes, SRKL routes and legacy deployment app/URL/capabilities were identical on the isolated branch, proving row-level preservation for those measured attributes (not claiming every possible column).

## Executed verification
1. **255 SQL statement isolated fresh clone rehearsal: PASS.** Full normalized Skipo schema, Luth main 003 → 004 → 005, both guard migrations, complete replay, SQL fixtures, preflight, explicit reverse and re-forward inside a PostgreSQL transaction. Both schema passes yielded exactly 5 `skipo_ecosystem` tables. Six `migration_blocker` preflight findings were **zero**. RLS and revocation negative-path fixtures passed. Final savepoint rollback restored the unmodified clone baseline: 11 apps, 14 origins, 1/1 routes, 1 deployment and no OAuth or publication normalized tables.
2. **102 SQL statement durable migration: PASS** on the isolated clone (not production). Executed six migration files, then a second durable 102-statement replay: PASS. Post-readback: 11 apps, 14 origins, 1 deployment; zero synthetic OAuth clients/codes/grants/tokens/workflow publication/grant fixtures; exactly 3 E2E03 integrity triggers and 5 private Skipo tables with RLS.
3. **12 exact exported query statements prepared: PASS.** Four from Luth `src/backend/auth/pkceCode.ts` and `crossAppDelegation.ts`; eight from Skipo PR #198 `backend/ecosystem/deploymentStore_Impure.ts`. This confirms SQL syntax, parameters, schema object and type resolution against the deployed isolated schema.
4. **39 SQL statement positive/negative query-contract fixture: PASS**, source-snapshot in `db/tests/007_current_production_query_contracts.test.sql`. Actual Luth SQL successfully issues/redeems a PKCE code exactly once and issues/consumes a cross-app delegation token exactly once. Skipo actual capability publication SQL returns revision 1, idempotent 1, changed revision 2. Verified lookup resolves the synthetic active leased deployment; expired leases deny lookup and publication. Revoked grants cannot mint tokens. All fixture records gone after rollback.
5. **13 SQL statement default-deny/partial-failure fixture: PASS**, `db/tests/008_default_deny_partial_failure.test.sql`. An unprivileged test role, explicitly granted schema usage and table SELECT, cannot read the private publication due to default-deny row-level security. The deliberately conflicting verified deployment with missing proof/lease aborts constraint validation and the nested savepoint restores its original validated constraints without leaving partial rows. Test roles/publications rolled back.
6. Exact upstream Skipo #198 `db/tests/004_workflow_publication_grants.test.sql`: PASS on the current-production-derived clone; no retained fixtures.

## Explicitly unclaimed
- SQL tests do not authenticate a real owner, origin proof, live OAuth user consent or multi-app remote network transport. These are separate Luth, Skipo registry, Kloks and FOD runtime responsibilities.
- This is not a production rollout. No production schema, table or record has been changed; no production cutover, canary, merge, application session, grant enrollment or rollback executed.
- Before merging Skipo PR #209, the registry owner must reconcile its frozen database-only Skipo #198 snapshot with current Skipo registry runtime work. Do not establish a competing migration source. Explicit production authorization remains a separate gate.
