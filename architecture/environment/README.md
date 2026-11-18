# Skipo application environment contract v2

`contract.json` is the machine-readable authority. The **only application-owned names** are:

| Name | Ownership | Required |
| --- | --- | --- |
| `SYSTEM_DATABASE_URL` | Primary application DB | Yes |
| `SYSTEM_DATABASE_URL_2` | DB fallback 1 | No |
| `SYSTEM_DATABASE_URL_3` | DB fallback 2 | No |
| `APP_URL` | Application's absolute origin | Yes |
| `SKIPO_DEPLOYMENT_ID` | Registry-provisioned deployment identity; never derived from `APP_URL` | No |
| `LUTH_OAUTH_CLIENT_ID` | Registry-provisioned OAuth client identity; distinct from `app_id` | No |

`NODE_ENV`, `PORT`, and a narrow, exact list of host-provided variables are classified as **runtime/platform inputs**. Internal release, CI, inspection and maintenance inputs are classified as **internal tooling**, accepted only in known tooling locations (not in application environment files). Neither category changes the application's four-name contract. These classifications do *not* allow arbitrary `GITHUB_*`, `VERCEL_*`, `CF_*` or `NEXT_PUBLIC_*` variables. An application declaring `GEMINI_API_KEY`, `STORAGE_SECRET_ACCESS_KEY`, `ADMIN_PASSWORD` or another application credential must move that requirement to its canonical authorization/service integration, not add a new exception.

The environment engine scans `.env*` files, source references (including JavaScript/TypeScript bracket access, Python environment access and GitHub workflow expressions), shell exports, and `env`/`environment`/`vars` blocks in YAML, JSON and TOML. Documentation is scanned only in fenced examples. Tests' source strings do not represent deployed application configuration, but fixture files do. Generated output, dependencies and caches are excluded.

`diagnose(root)`, `plan(root)`, `repair(root, apply=True)` and `verify(root)` remain the standalone integration API. Output is deterministic JSON-compatible data, without secret values. Planning fails closed for undeclared names, duplicate declarations, unsafe symlinks, unrecognized source contexts and ambiguous alias/target conflicts. `repair` changes only recognized environment declaration keys or static references and preserves the bytes of their values. It verifies after writing and attempts rollback on any failure; repeated repairs are no-ops. `APP_URL` is required, but a legacy `DEPM_GATEWAY_DOMAIN` declaration may satisfy the **plan** preflight if it can safely migrate. `SYSTEM_DATABASE_URL_1` migrates to `SYSTEM_DATABASE_URL` on the same terms.

This standalone contract intentionally does not alter the CLI, other agents' governance engines, or downstream apps. Integration may be performed separately once this independent PR is reviewed.