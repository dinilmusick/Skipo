---
name: skipo-agent-router
description: Master router and deterministic dispatcher directing the AI agent to modular sub-skills across UI, API, Data, Database, Architecture, Features, and Docs.
---

# AGENT MASTER ROUTER & DISPATCH DIRECTORY

## 0. MANDATORY TURN-COUNTER & ROUTINE CADENCE AUDIT PROTOCOL (STEP 0)
Whenever this Skipo framework is present in an agent workspace, the AI agent **MUST deterministically execute Step 0 before performing any code generation or editing**:

```python
def pre_action_turn_counter_guard(workspace_root: str = "."):
    state_file = f"{workspace_root}/.skipo/agent-state.json"
    
    # 1. Initialize or load persistent agent state
    if not file_exists(state_file):
        mkdir_p(f"{workspace_root}/.skipo")
        state = {
            "schemaVersion": "1.0.0",
            "turnsSinceLastAudit": 0,
            "auditCadenceThreshold": 5,  # Mandatory audit triggered every 5 editing turns
            "totalTurns": 0,
            "lastAudit": {
                "timestamp": current_iso_timestamp(),
                "status": "INITIALIZED",
                "refactorsPerformed": [],
                "checksPassed": []
            },
            "history": []
        }
        write_json(state_file, state)
    else:
        state = read_json(state_file)

    # 2. Check Cadence Threshold
    if state["turnsSinceLastAudit"] >= state["auditCadenceThreshold"]:
        # CADENCE TRIGGERED: MANDATORY ROUTINE SYSTEM AUDIT & APP DEBUGGING
        print("🚨 [Skipo Cadence Trigger]: Threshold reached. Executing mandatory system audit & refactoring...")
        
        # A. Execute 5-Pillar Architectural Audit & Deduplication
        audit_results = execute_full_architectural_audit(scope="ALL_PROJECT_FILES")
        
        # B. Run Diagnostic Build & Automated Regression Checks
        diagnostic_results = run_app_diagnostics_and_tests()
        
        # C. Auto-Remediate Violations (Quad-Units, Purity L0-L3, Line Limits, Anti-Polling, Zero-Mock)
        refactors = auto_remediate_deviations(audit_results, diagnostic_results)
        
        # D. Reset Turn Counter & Record Audit State
        state["turnsSinceLastAudit"] = 0
        state["totalTurns"] += 1
        state["lastAudit"] = {
            "timestamp": current_iso_timestamp(),
            "status": "PASSED" if diagnostic_results["success"] else "REMEDIATED",
            "refactorsPerformed": refactors,
            "checksPassed": ["quad_units", "4_layer_purity", "line_limits", "anti_polling", "zero_mock", "diagnostics"]
        }
        state["history"].append(state["lastAudit"])
        write_json(state_file, state)
        
        # E. Record in docs/HISTORY.md
        append_to_project_history(state["lastAudit"])
    else:
        # CADENCE BELOW THRESHOLD: PROCEED WITH NORMAL EDIT
        state["turnsSinceLastAudit"] += 1
        state["totalTurns"] += 1
        write_json(state_file, state)

    return state
```

---

## 1. MANDATORY PRE-ACTION ROUTING PROTOCOL
```
∀ task ∈ Agent_Actions:
  0. Execute pre_action_turn_counter_guard("."):
     - If turnsSinceLastAudit >= threshold -> Run routine audit & debug app, refactor deviations, reset counter to 0.
     - Else -> Increment turn counter in .skipo/agent-state.json and proceed with normal edit.
  1. Inspect workspace to detect Runtime Mode:
     if (has_dependency("@dinilmusick/krnlts") ∨ file_exists("krnl.json") ∨ has_import("@dinilmusick/krnlts")):
         load_skill("./krnlts/SKILL.md")  # Mode A: KrnlTS Runtime Subsystem Extensions
     elif (has_dependency("@skipo/core") ∨ has_dependency("@skipo/ui") ∨ has_dependency("@skipo/backend") ∨ file_exists("pnpm-workspace.yaml")):
         load_skill("./standalone/SKILL.md")  # Mode B: Standalone Skipo Architecture & Base Classes
     else:
         load_skill("./architecture/SKILL.md") # Mode C: Baseline Skipo Specification Catalog
  2. Classify task intent(s) into Domain(s).
  3. Consult corresponding leaf SKILL.md before proposing or writing code.
  4. If task spans multiple domains, load all relevant skills in dependency order:
     [ Backend / Database -> Architecture / Deduplication -> KrnlTS -> Data -> API -> UI -> Features -> Docs ]
  5. Abide strictly by the loaded skill constraints.
```

---

## 2. DOMAIN ROUTING & INTENT MATRIX

| Task Intent / Keywords | Target Skill / Sub-Router | Core Directives & Constraints |
| :--- | :--- | :--- |
| `turn_counter`, `agent_state`, `cadence_audit`, `routine_debug`, `5_turn_audit`, `deduplicate_structs`, `unify_functions`, `remediate_deviations` | [`architecture/deduplication/SKILL.md`](./architecture/deduplication/SKILL.md) | **Step 0 Turn Counter Engine**: `.skipo/agent-state.json` persistence, routine 5-turn audit cadence, automated app debugging, KrnlTS quad-unit compliance, deduplication, 4-layer purity, anti-polling audit |
| `standalone_app`, `skipo_ui`, `base_components`, `base_classes`, `container_classes`, `skipo_backend`, `skipo_systems`, `skipo_validate`, `create_skipo` | [`standalone/SKILL.md`](./standalone/SKILL.md) | **Standalone App Architecture**: `@skipo/*` modular package suite (zero KrnlTS runtime exposure). Base classes, container inheritance, Universal Backend, interactive systems, AST constraint enforcement |
| `universal_backend`, `control_plane`, `data_plane`, `workspace_storage`, `local_fs`, `local_hosted`, `remote_backend`, `admin_auth`, `vercel_backend`, `decoupled_storage` | [`backend/SKILL.md`](./backend/SKILL.md) | Universal Backend Architecture: Control Plane vs Data Plane separation, 3 Storage Modes (Local FS, Local-Hosted, Remote BaaS), Decoupled Data/Storage providers, Admin authorization, Vercel/Desktop readiness |
| `theme`, `colors`, `biome`, `parallax`, `particles`, `scrollbars`, `dropdowns` | [`ui/styling/SKILL.md`](./ui/styling/SKILL.md) | Neo-brutalism 2.5D biome, locked coffee/black-gold palettes, custom scrollbars, top-edge downward tooltips |
| `dock_toolbar`, `window_switcher`, `auto_hide`, `dock_position`, `main_toolbar` | [`ui/dock-toolbar/SKILL.md`](./ui/dock-toolbar/SKILL.md) | macOS-style main window switcher dock, 4-edge positioning (top/bottom/left/right), auto-hide trigger zone, icon-only |
| `tiled_menu`, `dnd_kit`, `tile_grid`, `icon_only`, `hover_tooltip` | [`ui/tiled-menus/SKILL.md`](./ui/tiled-menus/SKILL.md) | `@dnd-kit` sortable tiles, icon-only (zero persistent text), hover tooltips (top-edge elements pop downward) |
| `button_logic`, `form_submit`, `input_wiring`, `input_empty_state`, `form_validation`, `ui_stub` | [`ui/wiring/SKILL.md`](./ui/wiring/SKILL.md) | Mandatory backend wiring, zero unlinked UI stubs, anti-polling reactivity, input empty-state buffering & blur validation |
| `tag_canvas`, `force_graph`, `simulation_physics`, `vsync_scheduler`, `dpr_cap` | [`ui/force-graph/SKILL.md`](./ui/force-graph/SKILL.md) | Physics optimizations (alphaDecay 0.08, charge -70), single-frame VSync, 2x DPR |
| `node_graph`, `react_flow`, `connect_nodes`, `wire_drag`, `auto_spawn`, `context_menu` | [`ui/react-flow/SKILL.md`](./ui/react-flow/SKILL.md) | Middle-mouse pan, box select, scroll zoom, wire drag auto-spawn, full hotkeys, context menu only (zero tutorial/button clutter) |
| `pure_function`, `state_accessor`, `impure_function`, `complex_impure`, `layer_flow` | [`architecture/function-layers/SKILL.md`](./architecture/function-layers/SKILL.md) | 4-layer purity flow (Pure/State -> Impure -> Complex Impure -> API), zero layer bypassing |
| `create_feature`, `entity_structure`, `quad_unit`, `system_entity`, `helpers_events` | [`architecture/entity-functionality/SKILL.md`](./architecture/entity-functionality/SKILL.md) | KrnlTS quad-units, recursive Entity tree, strict event-driven communication (zero onTick/polling loops) |
| `shared_utils`, `canonical_structs`, `concept_file`, `libraries_folder` | [`architecture/libraries-concepts/SKILL.md`](./architecture/libraries-concepts/SKILL.md) | `libraries/{Domain}Concepts.ts` at system root level with uniform polymorphic generic templates |
| `skeleton`, `structural_entity`, `component_composition`, `behavioral_unit` | [`architecture/skeleton-components/SKILL.md`](./architecture/skeleton-components/SKILL.md) | `Entity<TState, TEvents>` Skeletons = Impure Orchestrators (`@role skeleton`), Components = Pure/Atomic (`@role component`) |
| `file_length`, `line_limit`, `split_file`, `atomic_sizing`, `200_lines`, `top_level_purity`, `one_component_per_file`, `app_tsx_raw_code`, `index_ts_raw_code` | [`architecture/code-limits/SKILL.md`](./architecture/code-limits/SKILL.md) | Top-level File Purity Law (App.tsx/main.ts/index.ts = imports only, zero raw JSX/HTML/logic), One Component Per File, 200 lines/file max (frontend + backend), ≤ 30 lines in helpers before concept delegation, ≤ 20 lines in main before helper delegation |
| `subapp_engine`, `subapp_authoring`, `drag_and_drop_app`, `engine_wrapper`, `subapp_json` | [`architecture/sub-app-engine/SKILL.md`](./architecture/sub-app-engine/SKILL.md) | 100% drag-and-drop KrnlTS sub-app compatibility, zero-server rule, `subapp.json`, `register.ts`, pure operations |
| `krnlts`, `krnl_entity`, `magnetic_loader`, `flow_builder`, `krnl_tools`, `krnlts_validate`, `subapp_worker` | [`krnlts/SKILL.md`](./krnlts/SKILL.md) | KrnlTS runtime library extensions (`loadAll`, `Entity<TState, TEvents>`, flows, port gateway, `KrnlFS`, `krnlts-validate`) |
| `create_endpoint`, `expose_api`, `rpc_surface`, `external_trigger_ui_sync`, `headless_api`, `realtime_events`, `ui_mirroring`, `useRealtimeApiSync`, `events_stream`, `events_route`, `test_api_suite`, `workspace_headers` | [`api/SKILL.md`](./api/SKILL.md) | Absolute feature-to-API parity, real-time UI mirroring (SSE/fast-polling), zero phantom executions, `x-workspace-id` isolation, 5-step scaffolding algorithm, 21-point automated headless test suite (`scripts/test-api-suite.ts`) |
| `fetch_data`, `zero_mock`, `real_backend`, `error_state_render`, `ai_provider` | [`data/SKILL.md`](./data/SKILL.md) | Zero fake/mock data, explicit error states, user-specified AI providers only |
| `configure_db`, `sqlite_wal`, `postgres_supabase_ssl`, `firebase_mongo`, `test_db` | [`database/SKILL.md`](./database/SKILL.md) | Settings modal database tab, multi-engine support, `/api/database/test` latency ping |
| `major_change`, `refactor_feature`, `delete_feature`, `purge_pipeline`, `deprecate_flow` | [`features/SKILL.md`](./features/SKILL.md) | Incremental evolution (never nuke/rewrite from scratch on big changes), 100% complete zero-trace feature purge (zero zombie/commented code) |
| `update_docs`, `document_endpoint`, `sync_skills`, `project_history`, `pre_refactor_memory` | [`docs/SKILL.md`](./docs/SKILL.md) | Chronological user intent tracking in `docs/HISTORY.md`, pre-refactor memory refresh, continuous skill/API sync |

---

## 3. DETERMINISTIC AGENT DISPATCH PIPELINE
```python
def resolve_and_execute(task_intent: str, modified_domains: list[str]):
    # Step 0: Execute mandatory turn-counter state check & audit guard
    state = pre_action_turn_counter_guard(".")

    # Step 1: Detect KrnlTS library presence
    is_krnlts = has_dependency("@dinilmusick/krnlts") or file_exists("krnl.json") or has_import("@dinilmusick/krnlts")

    # Step 2: Resolve all required leaf skills
    leaf_skills = []
    if is_krnlts:
        leaf_skills.append(resolve_krnlts_subskill(task_intent))

    for domain in modified_domains:
        if domain == "BACKEND":
            leaf_skills.append(resolve_backend_subskill(task_intent))
        elif domain == "UI":
            leaf_skills.append(resolve_ui_subskill(task_intent))
        elif domain == "ARCHITECTURE":
            leaf_skills.append(resolve_architecture_subskill(task_intent))
        elif domain in ["API", "DATA", "DATABASE", "FEATURES", "DOCS"]:
            leaf_skills.append(f"./{domain.lower()}/SKILL.md")

    # Step 3: Enforce dependency-ordered skill inspection
    order = ["backend", "database", "architecture", "krnlts", "data", "api", "ui", "features", "docs"]
    ordered_skills = sorted(leaf_skills, key=lambda path: next((i for i, k in enumerate(order) if k in path), 99))

    # Step 4: Load constraints and execute
    for skill_path in ordered_skills:
        load_directives(skill_path)

    execute_code_generation_under_constraints()
```

---

## 4. GLOBAL INVIOLABLE STRUCTURAL INVARIANTS (ALL TASKS — NO EXCEPTIONS)

These rules apply to EVERY code generation and editing action, regardless of domain or task type.
The agent MUST verify compliance BEFORE finalizing any file write.

### A. TOP-LEVEL FILE PURITY LAW
```
TOP-LEVEL FILES = { App.tsx, main.ts, index.ts, server.ts, app.ts, index.tsx, _app.tsx,
                    main.tsx, entry.ts, entry.tsx, root.tsx }

THESE FILES MUST CONTAIN ONLY:
  1. Import statements
  2. A single root export that wires together imported components / modules

ABSOLUTELY FORBIDDEN IN TOP-LEVEL FILES:
  ✗ Raw JSX / HTML markup of ANY kind
  ✗ React hooks (useState, useEffect, useRef, useContext, etc.)
  ✗ Inline styles, CSS objects, or className strings
  ✗ Business logic, data fetching, API calls, conditionals that render markup
  ✗ Event handler definitions
  ✗ Backend route handlers, middleware registration, or Express/Fastify app config

CANONICAL VALID App.tsx:
  import React from "react";
  import { AppShell } from "./components/AppShell/AppShell";
  export default function App() { return <AppShell />; }

CANONICAL VALID server.ts / index.ts (backend):
  import { createApp } from "./app/AppFactory";
  const app = createApp();
  app.listen(process.env.PORT ?? 3000);

VIOLATION RESPONSE: If the agent generates or modifies a top-level file that contains
any forbidden content, it MUST immediately extract that content into a properly named
component or factory module and import it.
```

### B. ONE COMPONENT / ONE MODULE PER FILE
```
RULE:
  Every .tsx / .ts file contains exactly ONE primary exported entity:
    - Frontend: ONE React component
    - Backend:  ONE service class | ONE controller | ONE route-group factory | ONE utility

PERMITTED ALONGSIDE the primary export (small helpers only):
  ✓ Props interface / type (e.g., interface AppShellProps { ... })
  ✓ Up to 3 pure helper functions, each < 20 lines, exclusively used by the primary export
  ✓ Local enums / type aliases consumed only within this file

FORBIDDEN:
  ✗ Two or more React component definitions in one file
  ✗ Two or more service / controller classes in one file
  ✗ Unrelated utility functions bundled with a component

DECOMPOSITION PATTERN (when a component grows):
  ComponentName/
    ComponentName.tsx              ← root orchestrator (imports sub-components only)
    ComponentNameHeader.tsx        ← sub-component
    ComponentNameBody.tsx          ← sub-component
    ComponentNameSidebar.tsx       ← sub-component
    useComponentNameLogic.ts       ← extracted hook (stateful logic)
    ComponentName.types.ts         ← shared prop/state interfaces
    ComponentName.constants.ts     ← constants / static data
```

### C. 200-LINE MAXIMUM (FRONTEND AND BACKEND)
```
HARD LIMIT: 200 lines per file — applies to ALL .ts / .tsx / .js / .jsx files.
When a file reaches 180 lines, immediately begin extracting sub-units.
No exceptions: backend controllers, service layers, and schemas obey this limit equally.
```

### D. BASE CLASS AND CONTAINER INHERITANCE LAW (STANDALONE APPS)
```
RULE:
  In standalone non-KrnlTS applications, all custom UI elements MUST inherit from or compose
  @skipo/ui base classes, and all views MUST be wrapped in @skipo/ui containers:
  
  MANDATORY BASE PRIMITIVES:
    - Buttons:     BaseButton (never <button>)
    - Inputs:      BaseInput (never <input>)
    - Textareas:   BaseTextarea (never <textarea>)
    - Selects:     BaseSelect (never <select>)
    - Cards:       BaseCard (never unstyled <div>)
    - Badges:      BaseBadge
    - Toggles:     BaseToggle
    - Tooltips:    BaseTooltip
    
  MANDATORY CONTAINERS:
    - Page level:  PageContainer
    - Sections:    SectionContainer
    - Overlays:    ModalContainer / DrawerContainer
    - Root layout: AppShell
    
  FORBIDDEN:
    ✗ Raw HTML interactive elements (<button>, <input>, etc.)
    ✗ Custom components that bypass @skipo/ui tokens or base classes
    ✗ Unstyled root page content without PageContainer wrapping
    
  ENFORCEMENT:
    Run `skipo-validate` via @skipo/validate to statically assert compliance.
```

### E. ZERO-DUPLICATION PHYSICAL STORAGE & UNIFIED WORKSPACE INITIALIZATION LAW
```
1. CONTAINER RENAMING & DEDUPLICATION:
   - When any container node (Kanban board, folder, collection) is renamed:
     - Local disk: MUST rename directory atomically (renameNodeOnDisk), move contents recursively, and update document fileUrl pointers in documents_index.json.
     - Cloud storage: MUST invoke renameCloudWorkspaceFolder to copy files/markers to new prefix, ensure directory marker exists, and permanently delete old folder and versions (permanentDeleteS3Folder).
     - Bucket reconciliation: MUST sweep directory markers (keys ending in '/') using validDirPrefixes; NEVER blanket-skip directory markers.
     - Self-healing: saveGraphToFS MUST detect and migrate any orphaned board folder whose kanban_board.json matches an active board.
     - API & Client handles: UPDATE_NODE must return renamedFrom and renamedTo, and client handles must purge renamedFrom via purgeFromAllLocalHandles.
2. UNIFIED WORKSPACE INITIALIZATION:
   - Workspace creation scripts MUST be 100% identical and unified across all storage tiers (Local, Backblaze B2, S3, R2, Supabase).
   - Local storage MUST NOT create rogue default placeholder folders (inbox/welcome_guide.md) when cloud storage does not.
3. PRIMARY CLOUD STORAGE ELEVATION:
   - Elevating cloud storage (e.g. Backblaze B2) to Primary sets isCloudPrimary = true and vaultPath = ./${folderPrefix}.
   - Serverless requests MUST NOT default or expose /tmp/ serverless scratch paths in the UI or graph root nodes.
```

---

## 5. GLOBAL OUTPUT PREFERENCES
- **Style**: Minimal natural language. Prefer mathematics, pseudocode, graphs, flowcharts, and vector-space representations.
- **Acronyms**: Fully expand all acronyms on first reference.
- **Veracity**: Science-based and empirically verifiable claims only.
- **Summaries**: Provide a formal summarizing function per phenomenon or complex architecture discussed.
- **Code**: Terse, direct to the point, zero fluff.
