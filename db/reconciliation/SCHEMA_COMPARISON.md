# Neon schema comparison — E2E03 (19 November 2026)

Project `red-mode-38205509`. Inspected production branch `br-calm-glitter-ae5fen6h` **read-only**. All writes/tests were transactionally rolled back on isolated branches `br-icy-math-aeaz1vu2` and `br-polished-rain-aegwhtcf`.

| Contract | Production observation | Migration authority / target |
| --- | --- | --- |
| Canonical app IDs | 11 rows in `public."ultrst-apps"`; IDs nonnull/distinct | Keep same `app_id` and historic `id`, immutability trigger, status-based retirement |
| Historical auth origins | 14 rows in `luth_auth_origins` | Read-only matching; no silent trust upgrade |
| Legacy service routes | 1 Luth + 1 SRKL route | Keep both throughout staged adoption |
| Legacy Skipo deployments | 1 row in `skipo_ecosystem.deployments` | Add stable UUID, environment, attested proof, lease and app FK; no implicit verified status |
| OAuth clients & redirects | Both absent | Luth main `003_canonical_oauth_app_clients.sql` |
| PKCE authorization-code state | Absent | Luth main `004_pkce_authorization_codes.sql` (single-use, session binding at runtime) |
| Cross-app grant & token state | Both absent | Luth main `005_invocation_grants.sql` (scope, owner, app IDs and workspaces) |
| Capability revisions | Absent | Skipo #198 normalized source + E2E03 integrity: immutable, strictly sequential, live lease |
| Workflow publications & grants | Both absent | Skipo #198 normalized source: immutable owner/workspace/version pointers and one-way revocation |
| Registry RLS | No normalized RLS to inspect | E2E03 `20261119_registry_integrity.sql` default-deny and private ACL |
| Runtime authorization | Cannot be proved from schema | Luth authenticated token/session checks; Skipo attested deployment resolution; Kloks target-side ACL and FOD invocation |

**Normalized preflight:** Six migration-blocking checks were zero after isolated historical-branch migration. This does not imply no conflicting historical records exist on today's production branch, nor that the SQL engine can verify network origin ownership, authenticated user consent, or client-side callback security.

**Mapping policy:** Preserve every existing catalog ID, app association, origin row, user/session and legacy route. Do not auto-create missing apps, approve OAuth clients, move users/workspaces, rewrite deployment URLs or classify preview deployments as verified. The read-only `20261118_existing_record_mapping.sql` flags exceptions for manual owner verification.

**Blocking gate:** A current-production clone is required for independent complete replay and rollback. No production cutover has been authorized.
