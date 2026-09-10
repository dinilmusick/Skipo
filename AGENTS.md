# SKIPO AGENT GOVERNANCE & ARCHITECTURAL ENFORCEMENT LAWS

> [!IMPORTANT]
> **BLOCKING REQUIREMENT FOR ALL AI CODING AGENTS**:
> These laws are strictly prescriptive and executable. You are not merely an observer or reference consultant of the Skipo standards—you are the **prescriptive guardian and structural enforcer** of this codebase. Compliance is enforced via automated checklist scripts that must pass (exit code 0) before any task is considered complete.

---

## 1. The Architectural Enforcement Law (Frontend/Backend Decoupling)

1. **Anti-Monolith Mandate**:
   - All projects MUST strictly adhere to Frontend/Backend plane separation.
   - If a project contains a monolithic flat `src/` directory where backend APIs, database models, and frontend UI components are intermingled, the agent **MUST automatically refactor the codebase into compliant planes** (`src/frontend` & `src/backend`, or `packages/*` monorepo structure, or KrnlTS `entities/*`) **BEFORE** implementing any requested feature.
   - Never inherit a monolithic or flat file layout simply because "it was already there." Operational bias and path-of-least-resistance are strictly prohibited.

2. **Mandatory Scaffold-First Initialization**:
   - When initializing a new project or sub-app, the agent must perform a **Scaffold Validation** turn.
   - Present the planned folder structure for the specific project type to the user and generate directory-level `README.md` / `SKILL.md` explanations before writing business logic.

---

## 2. The Anti-Stub & Genuine Implementation Law (Zero-Hollow-Code)

1. **Absolute Ban on Stubs**:
   - The AI agent is STRICTLY FORBIDDEN from generating or leaving unimplemented stubs:
     - ❌ Empty function bodies (`function doWork() {}`)
     - ❌ `/* TODO */` or `// Not implemented yet` comments in lieu of logic
     - ❌ `throw new Error("Not implemented")` or `throw new Error("TODO")`
     - ❌ No-op event handlers (`onClick={() => {}}`, `onChange={() => {}}`)
2. **Authentic Processing & Return Integrity**:
   - Functions receiving parameters MUST perform genuine algorithmic processing, state transitions, or data transformations.
   - Never write functions that accept arguments and immediately return hardcoded primitives (`return null;`, `return {};`, `return [];`, `return true;`) without computation.
3. **Real Service & Library Connectivity**:
   - Code assets designated as services, clients, or repositories MUST authentically connect to real drivers and SDKs (`@aws-sdk`, `sqlite3`, `pg`, `fetch`, `@skipo/backend/storage`, `@skipo/backend/auth`, `crypto`).
   - Never simulate or fake service interactions with synthetic mock responses.
4. **API Route Handler Depth**:
   - Serverless route handlers (`route.ts`) must validate incoming request payloads, verify session tokens/roles, and invoke authentic storage or database transactions rather than returning static `{ success: true }` dummy payloads.

---

## 3. Dynamic Checklist Verification Pipeline (The 9 Pillars)

Every turn MUST be verified against the dynamic checklist suite located in `checklists/`. These scripts are written in pure **Python 3 standard library** (zero pip dependencies) for universal portability across **Google AI Studio Code Execution**, local terminals, and CI environments:

| Pillar | Aspect Script | Mandatory Verification Gate |
| :--- | :--- | :--- |
| **01** | `checklists/01_structure_governance.py` | Validates plane separation, anti-monolith, anchored `.gitignore` |
| **02** | `checklists/02_ui_primitives_themes.py` | Banned raw HTML (`<button>`, `<input>`), 100% theme tokens (`var(--skipo-*)`) |
| **03** | `checklists/03_layout_shell_invariants.py` | Flat `TopToolbar` (anti-nested-tabs), `BottomStrip` (30px), `FloatingDetailsPanel` |
| **04** | `checklists/04_code_limits_purity.py` | File line limit (<= 200L), 1-component/file, ASCII flowchart docblocks |
| **05** | `checklists/05_real_data_anti_mock.py` | Zero placeholder tokens (`"placeholder"`, `"dummy"`), real empty states |
| **06** | `checklists/06_anti_stub_asset_depth.py` | **CRITICAL**: Zero stubs, non-trivial returns, real service connectivity |
| **07** | `checklists/07_backend_storage_isolation.py`| Control Plane vs Data Plane isolation, direct presigned uploads |
| **08** | `checklists/08_api_security_governance.py` | 8-gate request lifecycle, rate limiting, anti-polling (>= 5000ms delay) |
| **09** | `checklists/09_test_coverage_integrity.py` | Companion `*.test.ts(x)` for every module, real non-trivial assertions |
| **10** | `checklists/full_system_validator.py` | **Master Pipeline**: Runs all 9 pillars, outputs scorecard, gates exit code 0 |

---

## 4. Standard Agent Execution Flow

```
[Agent Turn Start]
  │
  ├── 1. Scaffold & File Tree Audit
  │      └── If flat monolithic src/ -> REFACTOR FIRST to src/frontend & src/backend
  │
  ├── 2. Implement Requested Feature / Fix
  │      ├── Connect to authentic drivers (no mocks, no stubs)
  │      ├── Use @skipo/ui primitives and var(--skipo-*) tokens
  │      ├── Add docblocks with ASCII flowcharts & bold borders
  │      └── Author companion *.test.ts(x) unit test
  │
  ├── 3. Dynamic Checklist Execution (MANDATORY GATE)
  │      ├── In Google AI Studio: Run python3 checklists/full_system_validator.py .
  │      └── In Node.js / CLI: Run node checklists/runner.mjs .
  │
  ├── 4. Did the Full System Validator return Exit Code 0?
  │      ├── NO  -> Auto-remediate reported errors immediately. Do not exit turn.
  │      └── YES -> Present verified evidence and scorecard to user.
  │
[Agent Turn Complete]
```
