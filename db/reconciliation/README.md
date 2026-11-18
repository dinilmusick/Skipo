# ULTRST Neon canonical schema reconciliation — 2026-11-18

**Scope:** Skipo N2/N4/N5 database contract and Luth N3/OAuth code storage. This is an **additive, isolated-stage review bundle**, stacked on Skipo #198. It is not activated by existing Skipo runtime startup SQL until an owner explicitly incorporates the guardrail file in the approved migration sequence. This PR is **not** production authorization.

## Authoritative identities and dependencies

- Canonical application identity remains `public."ultrst-apps"(app_id)`; `id` is a preserved legacy catalog identifier. Never mint a second app registry.
- `skipo_ecosystem.deployments` has an immutable `deployment_id`, canonical `app_id` FK, environment, verified proof digest and lease. Existing unclassified/unverified URL heartbeats remain intact.
- `deployment_capability_revisions` versions static backend descriptors against a stable deployment; never put workspace graph content or secrets there.
- Luth owns `luth_oauth_clients`, `luth_oauth_redirects`, `luth_oauth_authorization_codes` and authorization/session behavior. A DB proof reference is not a substitute for actual client ownership verification.
- `workflow_publications` contains immutable **metadata pointers** (app/owner/workspace/workflow/version), not workflow definitions. `workflow_grants` records exact caller app/source workspace/target workspace and one-way revocation. Target-side Luth/BackendFacade checks remain mandatory for every discovery/invocation, including nested calls.
- The Neon database owner is a trusted backend/migration role. SQL CHECK constraints cannot authenticate a claimant represented only by a writable text field. Do not expose its credentials to app/browser callers; enforce owner grants and execution authorization at the application boundary.

## Files

- `20261118_canonical_neon_guardrails.sql`: idempotent forward migration. Preserves all rows; forbids catalog `id` / `app_id` rewrites **and row deletion** (retire through status to prevent ID reuse); requires proof, environment and lease for `verified` deployments. The constraint is validated, not silently backfilled.
- `20261118_canonical_neon_guardrails.rollback.sql`: reverts **only** this forward migration's trigger, function and check, leaving every legacy and normalized table/row in place.
- `20261118_existing_record_mapping.sql`: four read-only reports for catalog classifications, origins, missing owner-enrolled apps and legacy web routes.
- `../tests/005_canonical_neon_guardrails.test.sql`: rollback-only fixture testing immutable identity, proof requirements, capability revisions, Luth callback/code binding, owner/target-workspace grants and irreversible revocation/withdrawal.

## Execution protocol (isolated Neon branches ONLY)

Confirm the concrete branch ID via Neon `list_branches` and confirm it is **not** the default production ID before any DDL. Do not infer a branch from its display name. Record database/table counts before and after every phase.

1. Start from an isolated branch with integrated Skipo #198 `backend/ecosystem/db/deployments.sql`, the **current hardened** Luth #18 `db/migrations/003_canonical_oauth_app_clients.sql`, and Luth #18 `db/migrations/004_pkce_authorization_codes.sql` applied. **Do not substitute the earlier Luth #4 version of 003**: it lacks the verified-parent callback guard and would invalidate the security test on a clean legacy baseline. Re-running each upstream source must be idempotent.
2. On that branch only, apply `20261118_canonical_neon_guardrails.sql` with `psql -v ON_ERROR_STOP=1 -f <file>`. A preexisting unproven `verified` record should make validation **fail**; inventory and resolve the record rather than modifying it automatically.
3. Apply the forward migration a second time. Verify one catalog identity trigger, one validated deployment evidence check and identical row counts.
4. Execute `../tests/005_canonical_neon_guardrails.test.sql` with `ON_ERROR_STOP=1`. Its successful SQL transaction rolls back; an error aborts and must fail the job.
5. Save the mapping report and exact before/after schema/row-count evidence. On a disposable isolated branch, run the rollback SQL and independently verify those two objects are absent, existing data intact, and legacy application URL routes unchanged. Reapply forward for a clean final-state test if desired.
6. No production application, live cutover, approval of new clients/deployments, removal of legacy relations, or merge is implied. Those operations require their separate governance gate.

## Observed verification evidence (Neon project `red-mode-38205509`)

| Observation | Exact result |
| --- | --- |
| Production `br-calm-glitter-ae5fen6h` (read-only) | 19 tables, normalized OAuth/code/publication/grant/revision tables absent |
| Replay `br-icy-math-aeaz1vu2` before temporary test | 26 tables; 11 catalog apps, 1 unverified/unclassified deployment; zero clients, codes, capability revisions, publications or grants |
| Existing legacy routing | 1 Luth route, 1 SRKL route; both preserved |
| Legacy origins | 14 total, 5 production and 9 nonproduction; all current origin app IDs match catalog IDs, but matching is **not** proof of registration ownership |
| Earlier replay-branch idempotence | 53 statements from Skipo #198, earlier Luth #4 and Luth #18 replayed twice (106 executions) with stable 11-app/1-deployment counts; this alone does **not** certify the hardened callback contract. |\n| Legacy baseline full migration | On older independent branch `br-polished-rain-aegwhtcf`: Skipo #198 (36), current **Luth #18** OAuth clients/redirects (27), OAuth code migration (6), these guardrails (5) = **74 statements** per replay, **148 executions** across two runs. Table count **16 → 25 → 25**; catalog rows **10 → 10 → 10**, 1 Luth and 1 SRKL legacy route preserved, 6 origins unchanged. The committed SQL negative-path fixture passed in the same savepoint, including catalog deletion and verified-parent callbacks. No changes persisted. |
| Defect reproduction before guard | Changing the `app_id` of an unreferenced synthetic catalog app **succeeded**; test fixture rolled back. Updated forward migration now also prohibits catalog deletion/ID reuse. |
| Forward guard | Check validated; invalid proof/lease rejected; verified fixture with structural proof and lease accepted; immutable app ID rejected |
| Double application | Exactly 1 trigger and 1 validated constraint; 11 apps and 1 deployment preserved |
| Rollback rehearsal | Exactly 0 of the new trigger/constraint after reverse; original 11 apps / 1 deployment unchanged |
| Negative paths | Current committed SQL fixture passed on older legacy baseline and current isolated replay using savepoint rollback: immutable catalog keys and deletion, deployment proof, revision monotonicity, unverified OAuth redirect, single-use code, cross-owner/workspace grants, irrevocable grant and withdrawn publication. |\n| Conflicting existing data | A synthetic preexisting `verified` deployment without proof/lease was accepted by the unguarded replay schema, then correctly made `VALIDATE CONSTRAINT` fail; the test trapped the failure, checked no partial constraint survived, and rolled back the fixture. No existing record was repaired automatically. |
| ACL negative check | Temporary nonprivileged role denied schema access and direct SELECT on workflow publications and Luth code storage; role creation rolled back |
| Classification exceptions | Floks and Kloks are libraries, FOD a module; Krusbl and Qwnsr await evidence; Kal and Brwlr not yet in catalog and require owner enrollment |

**Important limitation:** A fresh verification branch could not be created because the Neon project reports `branches limit exceeded`. Tests therefore used existing **older isolated** and **current replay** branches, enclosed in PostgreSQL transaction savepoints and rolled back. The older branch is a November 5 historical snapshot (10 apps/6 origins), **not** a fresh current-production clone (11 apps/14 origins). Current-production-derived fresh-clone replay, operational client-ownership checks, and live cross-app authorization remain **uncertified**. No production database mutation was made.

## Rollout boundary

This bundle intentionally does not alter the active Skipo/Luth/BackendFacade implementation files or automatically add its migration to a deploy command. The Skipo registry owner must agree to the integration point after the upstream PR stack has been reconciled. Run independent CI and a fresh-branch verification when branch capacity is available. Do not mark a production rollout or live security certification complete based only on isolated schema tests.
