# Skipo Modular Prompts & Architectural Validators

This directory contains **streamlined task-specific prompt attachments** for AI coding agents and human engineers, defining canonical architectures, security invariants, and authoring protocols across the Skipo ecosystem.

All code generation and refactoring operations are verified by executable Python 3 validators located in `checklists/` and executed via `assistant.py validate .`.

---

## 1. Architectural Validator Intentions (`checklists/`)

Each validator script in `checklists/` enforces a single, deterministic architectural pillar:

| Aspect | Validator Script | Primary Intention & Core Rule |
| :--- | :--- | :--- |
| **01: Structure & Governance** | `checklists/01_structure_governance.py` | Eliminates flat monolithic `src/`; enforces explicit planes (`src/frontend`, `src/backend`, `packages/*`) and anchored `.gitignore` patterns (`/dist/`, `/.next/`). |
| **02: UI Primitives & Themes** | `checklists/02_ui_primitives_themes.py` | Eliminates bespoke raw HTML controls (`<button>`, `<input>`); enforces 100% `@skipo/ui` primitives and `var(--skipo-*)` theme token usage. |
| **03: Layout Shell Invariants** | `checklists/03_layout_shell_invariants.py` | Enforces single flat `TopToolbar` (44px, anti-nested-tabs), dynamic hover inspection via thin `BottomStrip` (30px), and bans floating tooltip bubbles. |
| **04: Code Limits & Purity** | `checklists/04_code_limits_purity.py` | Limits files to max 200 lines, enforces exactly one component per file, wrapper-only top-level files (`App.tsx`), and ASCII flowchart docblocks. |
| **05: Real Data & Anti-Mock** | `checklists/05_real_data_anti_mock.py` | Eliminates synthetic dummy arrays and `"placeholder"` tokens; requires authentic drivers or explicit `<EmptyState>`. |
| **06: Anti-Stub & Asset Depth** | `checklists/06_anti_stub_asset_depth.py` | Eliminates hollow stubs, empty function bodies, `/* TODO */` comments, and trivial return statements; requires genuine service integrations. |
| **07: Backend Storage Decoupling** | `checklists/07_backend_storage_isolation.py` | Decouples Control Plane (`/api/auth`) from Data Plane (`/api/storage`); enforces direct presigned uploads and bans `/tmp` buffer proxying. |
| **08: API Security & Governance** | `checklists/08_api_security_governance.py` | Enforces the 8-gate request lifecycle pipeline, sliding window rate limits, anti-burst protection, and sanitized error responses. |
| **09: Test Coverage Integrity** | `checklists/09_test_coverage_integrity.py` | Mandates companion `*.test.ts(x)` test files for modules; bans test stubs (`expect(true).toBe(true)`) and requires real assertions. |
| **10: App Architecture Spec** | `checklists/10_app_architecture_spec_validator.py` | Enforces 4 canonical planes (`src/{frontend, backend, libraries, frontend-state}`), single facade entrypoints, and root preservation. |
| **11: Multi-Target Build Spec** | `checklists/11_multi_target_build_spec_validator.py` | Validates multi-target build manifests (`fullstack.json`, `api.json`), `httpsAdapter.ts`, and environment-agnostic orchestrations. |
| **12: Serverless Deployment Budget** | `checklists/12_serverless_deployment_limits.py` | Enforces serverless bundle size limits (50MB Hobby / 250MB Pro), Next.js `output: 'standalone'`, devDependencies isolation, and external CDN media. |
| **Master System Validator** | `checklists/full_system_validator.py` | Executes Aspects 01-12 in sequence, generating an executive compliance scorecard and gating turns with an exit code. |

---

## 2. Streamlined Task Prompt Matrix (`prompts/`)

| Task Type | Prompt File | Core Directives & Playbook |
| :--- | :--- | :--- |
| **Update Codebase to Skipo Standards** | [`TASK_UPDATE_TO_SKIPO_STANDARDS.md`](./TASK_UPDATE_TO_SKIPO_STANDARDS.md) | Ingestion protocol for the 12 Inviolable Laws, 7-phase step-by-step refactoring playbook, and zero business logic regression ($\Delta\text{Logic} = 0$). |
| **Security & Session Infrastructure** | [`TASK_SECURITY_AND_SESSION_INFRASTRUCTURE.md`](./TASK_SECURITY_AND_SESSION_INFRASTRUCTURE.md) | Canonical 8-gate `createSecureRoute` wrapper, multi-session isolation, refresh token rotation with theft detection, progressive trust ($T_0 \dots T_4$), and 5-step verification gate. |
| **Usage Throttling & Burst Protection** | [`TASK_USAGE_THROTTLING_AND_BURST_PROTECTION.md`](./TASK_USAGE_THROTTLING_AND_BURST_PROTECTION.md) | Self-DoS elimination, 6 high-risk burst patterns, 6 client stream/polling invariants (`useRealtimeApiSync`, 4xx circuit breaker, jittered backoff), and request deduplication. |
| **Backend & Workspace Storage** | [`TASK_BACKEND_STORAGE.md`](./TASK_BACKEND_STORAGE.md) | Pure filesystem workspace storage (`WorkspaceFS`), environment-driven Control Plane auth, multi-cloud virtual adapters (Local FS, B2, R2, S3), and background replication. |
| **UI Components & Frontend** | [`TASK_UI_COMPONENT_FRONTEND.md`](./TASK_UI_COMPONENT_FRONTEND.md) | `@skipo/ui` primitive composition, `--skipo-*` theme token semantics, dynamic hover inspection via `BottomStripContext`, 4-word label cap, and 8-way `FloatingDetailsPanel`. |

---

## 3. Automation Scripts & Aggressive Looping Engine (`scripts/`)

To eliminate manual boilerplate work and stale code accumulation, Skipo provides dedicated automation scripts with **aggressive validation & auto-delete loops**:

| CLI Command | Script | Description & Invariant |
| :--- | :--- | :--- |
| `python3 assistant.py sync-libraries [target]` | `scripts/sync_to_libraries.py` | Synchronizes Skipo base assets into `src/libraries/skipo/`. Enforces Law L20: bans direct imports from root `Skipo/`. |
| `python3 assistant.py generate service <name>` | `scripts/create_service.py` | Scaffolds canonical 7-file service suite and auto-registers in `<AppName>Backend.ts`. Auto-deletes on validation failure. |
| `python3 assistant.py generate app-structure [path]` | `scripts/scaffold_app_structure.py` | Scaffolds canonical 4-plane structure, plane READMEs, and hydrates Skipo libraries. Auto-deletes on validation failure. |
| `python3 assistant.py generate orchestration <name>` | `scripts/create_orchestration.py` | Scaffolds client-side backend coordinator with ASCII flowchart and auto-registers in backend facade. |
| `python3 assistant.py generate route <name>` | `scripts/create_secure_route.py` | Scaffolds canonical 8-gate secure route with Zod schemas and tests. Auto-deletes on failure. |
| `python3 assistant.py mutate naming [path]` | `scripts/enforce_naming_conventions.py` | Injects bold section banners (`// ═════`), docblocks, and purity suffixes (`_Pure`, `_Impure`, etc.). |

---

## 4. How to Execute System Gates

AI coding agents should invoke the master router CLI:

```bash
# Run full system compliance verification gate
python3 assistant.py validate .

# Run a specific aspect validator directly
python3 checklists/08_api_security_governance.py .

# Hydrate Skipo libraries into target codebase
python3 assistant.py sync-libraries . --auto-fix
```
