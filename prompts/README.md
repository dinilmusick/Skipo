# KrnlTS & Skipo Modular Prompt & Dynamic Checklist Library

This directory contains **task-specific, token-efficient prompt attachments** formalized in math/pseudocode, accompanied by **pure Python 3 dynamic checklist scripts** in `checklists/` that actively validate codebases in environments like **Google AI Studio** (Gemini Python Code Execution), Project IDX, and local CLI terminals.

---

## Universal Prescriptive Governance Laws (Mandatory Across All Tasks)

0. **Turn-Counter State Engine & Cadence Trigger**: Inspect `.skipo/agent-state.json`. If `turnsSinceLastAudit >= 5`, trigger mandatory routine audit, app debugging, and auto-remediation before resetting `turnsSinceLastAudit = 0`.
1. **Scaffold & Plane Separation**: Never tolerate monolithic `src/`. Decompose into `src/frontend` and `src/backend` (or `packages/*` monorepos).
2. **Anti-Stub & Genuine Asset Depth**: Absolute zero tolerance for hollow stubs, empty function bodies, `/* TODO */` comments, no-op handlers (`() => {}`), or hardcoded dummy returns. Connect all assets to authentic drivers and SDKs.
3. **Zero-Custom-UI & 100% Theme Tokens**: Always use `@skipo/ui` primitives and `var(--skipo-*)` tokens.
4. **Shell Invariants**: TopToolbar (44px) flat tabs, BottomStrip (30px) inspection, anti-floating tooltips, FloatingDetailsPanel 8-way resize and pinning.
5. **Code Limits & Flowcharts**: File line limits $\le 200$, single component per file, bold unicode borders (`// ═══`), ASCII flowchart docblocks.
6. **Real Data & Zero-Mock**: Absolute ban on `"placeholder"`, `"lorem ipsum"`, or dummy arrays. Render `@skipo/ui` `<EmptyState>`.

---

## Dynamic Architectural Checklist Suite (Aspects 01 - 10)

Use these prescriptive checklists to focus an AI agent on **one specific architectural pillar at a time**, backed by executable Python 3 scripts in `checklists/`:

| Aspect Pillar | Focused Prompt File | Dynamic Validator Script | Core Enforcements |
| :--- | :--- | :--- | :--- |
| **01: Structure & Governance** | [`CHECKLIST_01_STRUCTURE_GOVERNANCE.md`](./CHECKLIST_01_STRUCTURE_GOVERNANCE.md) | `checklists/01_structure_governance.py` | Monolithic `src/` ban, explicit frontend/backend planes, anchored `.gitignore` (`/dist/`). |
| **02: UI Primitives & Themes** | [`CHECKLIST_02_UI_PRIMITIVES_AND_THEMES.md`](./CHECKLIST_02_UI_PRIMITIVES_AND_THEMES.md) | `checklists/02_ui_primitives_themes.py` | Banned raw HTML (`<button>`, `<input>`), 100% theme tokens (`var(--skipo-*)`). |
| **03: Layout Shell Invariants** | [`CHECKLIST_03_LAYOUT_SHELL_INVARIANTS.md`](./CHECKLIST_03_LAYOUT_SHELL_INVARIANTS.md) | `checklists/03_layout_shell_invariants.py` | Flat `TopToolbar` (anti-nested-tabs), `BottomStrip` (30px), zero floating bubbles. |
| **04: Code Limits & Purity** | [`CHECKLIST_04_CODE_LIMITS_AND_PURITY.md`](./CHECKLIST_04_CODE_LIMITS_AND_PURITY.md) | `checklists/04_code_limits_purity.py` | $\le 200$ lines/file, one component/file, top-level purity (`App.tsx`), ASCII flowcharts. |
| **05: Real Data & Anti-Mock** | [`CHECKLIST_05_REAL_DATA_ANTI_MOCK.md`](./CHECKLIST_05_REAL_DATA_ANTI_MOCK.md) | `checklists/05_real_data_anti_mock.py` | Zero placeholder tokens (`"placeholder"`, `"dummy"`), ban on fake dummy arrays. |
| **06: Anti-Stub & Asset Depth** | [`CHECKLIST_06_ANTI_STUB_ASSET_DEPTH.md`](./CHECKLIST_06_ANTI_STUB_ASSET_DEPTH.md) | `checklists/06_anti_stub_asset_depth.py` | **CRITICAL**: Zero stubs, non-trivial returns, real service & library connectivity. |
| **07: Backend Storage Decoupling**| [`CHECKLIST_07_BACKEND_STORAGE_ISOLATION.md`](./CHECKLIST_07_BACKEND_STORAGE_ISOLATION.md)| `checklists/07_backend_storage_isolation.py`| Control Plane vs Data Plane isolation, direct presigned uploads (zero `/tmp` buffer). |
| **08: API Security & Governance** | [`CHECKLIST_08_API_SECURITY_GOVERNANCE.md`](./CHECKLIST_08_API_SECURITY_GOVERNANCE.md) | `checklists/08_api_security_governance.py` | 8-gate request lifecycle, sliding rate limiting, anti-polling ($\ge 5000\text{ms}$ delay). |
| **09: Test Coverage Integrity** | [`CHECKLIST_09_TEST_COVERAGE_INTEGRITY.md`](./CHECKLIST_09_TEST_COVERAGE_INTEGRITY.md) | `checklists/09_test_coverage_integrity.py` | Companion `*.test.ts(x)` for every module, real assertions, anti-test-stub. |
| **10: Full System Audit Gate** | [`CHECKLIST_10_FULL_SYSTEM_AUDIT.md`](./CHECKLIST_10_FULL_SYSTEM_AUDIT.md) | `checklists/full_system_validator.py` | **Master Pipeline**: Runs Aspects 01-09, emits executive compliance scorecard. |

---

## Domain & Task Prompt Matrix

| Task Type | Prompt File | Key Enforcements |
| :--- | :--- | :--- |
| **Turn Counter & Routine Cadence Audit** | [`TASK_ROUTINE_AUDIT_CADENCE.md`](./TASK_ROUTINE_AUDIT_CADENCE.md) | `.skipo/agent-state.json` maintenance, 5-turn cadence trigger, 6-pillar audit, auto-remediation |
| **Documentation & Formatting Standards** | [`CODE_DOCUMENTATION_AND_FORMATTING_STANDARDS.md`](./CODE_DOCUMENTATION_AND_FORMATTING_STANDARDS.md) | Universal docblock template, ASCII flow charts, bold unicode borders, descriptive names |
| **New Feature / Capability** | [`TASK_CREATE_FEATURE.md`](./TASK_CREATE_FEATURE.md) | Atomic `krnlLocalFunctionality`, `backend` flag auto-table, L0-L3 layer separation |
| **Refactor & Routine Cleanup** | [`TASK_REFACTOR_CLEANUP.md`](./TASK_REFACTOR_CLEANUP.md) | **Zero logic deletion ($\Delta \text{Logic} = 0$)**, deduplication, line limits |
| **Backend, DB & Storage** | [`TASK_BACKEND_STORAGE.md`](./TASK_BACKEND_STORAGE.md) | Control Plane vs Data Plane separation, Mode 1/2/3, CRUD engine |
| **Sub-App & Entity Creation** | [`TASK_CREATE_SUBAPP_ENTITY.md`](./TASK_CREATE_SUBAPP_ENTITY.md) | Root vs Child positioning, Zero-Server rule, Sub-App Engine manifest |
| **UI Components & Frontend** | [`TASK_UI_COMPONENT_FRONTEND.md`](./TASK_UI_COMPONENT_FRONTEND.md) | Central style authority CSS tokens, reactive listeners, Docks, DetailsPanel |
| **APIs & Protocol Adapters** | [`TASK_API_PROTOCOL_ADAPTER.md`](./TASK_API_PROTOCOL_ADAPTER.md) | REST, WebSocket, MCP, ACP unified port adapters, Zod/Protobuf schema guards |
| **Bug Fixing & Verification** | [`TASK_DEBUG_FIX_VERIFY.md`](./TASK_DEBUG_FIX_VERIFY.md) | Invariant verification, regression test scripts, type-safety |
| **System Orchestration & P2P** | [`TASK_SYSTEM_ORCHESTRATION.md`](./TASK_SYSTEM_ORCHESTRATION.md) | Magnetic Loader autoloading, P2P Ingress network, cross-entity event bus |
| **API Security & Governance** | [`TASK_API_SECURITY_GOVERNANCE.md`](./TASK_API_SECURITY_GOVERNANCE.md) | Mandatory 8-gate request pipeline, multi-tier rate limiting, timeouts |
| **Multi-Session & Progressive Trust** | [`TASK_SESSION_PROGRESSIVE_TRUST.md`](./TASK_SESSION_PROGRESSIVE_TRUST.md) | Multi-session storage, refresh token rotation, token theft detection |
| **Enforce Security Infrastructure** | [`TASK_ENFORCE_SECURITY_AND_SESSION_INFRASTRUCTURE.md`](./TASK_ENFORCE_SECURITY_AND_SESSION_INFRASTRUCTURE.md) | Jump-start audit & enforcement of 8-gate pipeline and multi-session storage |
| **Align Codebase to Skipo Standards** | [`TASK_UPDATE_TO_SKIPO_STANDARDS.md`](./TASK_UPDATE_TO_SKIPO_STANDARDS.md) | Full 12 Core Architectural Laws ingestion, zero-custom UI migration |

---

## How to Run Checklists

### 1. In Google AI Studio (Python Code Execution Sandbox)
Ask Gemini or execute directly in Python:
```python
import subprocess
result = subprocess.run(["python3", "checklists/full_system_validator.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0
```

### 2. In Local Terminal / CI Environment
```bash
# Execute full system validator
python3 checklists/full_system_validator.py .

# Or run via Node.js runner
node checklists/runner.mjs .

# Run a specific aspect (e.g. anti-stub)
python3 checklists/06_anti_stub_asset_depth.py .
```
