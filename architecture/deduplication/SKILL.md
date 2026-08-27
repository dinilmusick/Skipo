---
name: architecture-audit-cadence-and-deduplication
description: Mandatory persistent turn-counter state engine, routine cadence audit, app debugging, KrnlTS quad-unit compliance, deduplication, and 4-layer function isolation.
---

# TURN-COUNTER STATE ENGINE & ROUTINE ARCHITECTURAL AUDIT

## 1. PERSISTENT TURN-COUNTER STATE ENGINE (`.skipo/agent-state.json`)
The AI agent **MUST maintain and check** a persistent state file at `.skipo/agent-state.json` (relative to the workspace root) on every interaction turn.

### Canonical Schema:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "schemaVersion": "1.0.0",
  "turnsSinceLastAudit": 0,
  "auditCadenceThreshold": 5,
  "totalTurns": 0,
  "lastAudit": {
    "timestamp": "2026-08-26T12:00:00.000Z",
    "status": "PASSED",
    "refactorsPerformed": [],
    "checksPassed": [
      "quad_units_structure",
      "layer_purity_L0_to_L3",
      "multi_tier_line_limits",
      "deduplication_and_concepts",
      "anti_polling_reactive_events",
      "zero_mock_backend_wiring",
      "app_diagnostics_compilation"
    ]
  },
  "history": []
}
```

### Deterministic State Transition Algorithm:
```python
def evaluate_turn_cadence_and_execute(workspace_root: str = "."):
    state_path = f"{workspace_root}/.skipo/agent-state.json"
    
    # Step 1: Ensure .skipo directory and state file exist
    if not file_exists(state_path):
        mkdir_p(f"{workspace_root}/.skipo")
        state = {
            "schemaVersion": "1.0.0",
            "turnsSinceLastAudit": 0,
            "auditCadenceThreshold": 5,
            "totalTurns": 0,
            "lastAudit": {
                "timestamp": current_iso_timestamp(),
                "status": "INITIALIZED",
                "refactorsPerformed": [],
                "checksPassed": []
            },
            "history": []
        }
    else:
        state = read_json(state_path)

    # Step 2: Evaluate Cadence
    if state["turnsSinceLastAudit"] >= state["auditCadenceThreshold"]:
        # ═══ CADENCE TRIGGERED: MANDATORY ROUTINE AUDIT & DEBUGGING ═══
        print("🚨 [CADENCE TRIGGER]: Executing routine audit and debugging...")
        
        # 1. Run 6-Pillar Audit
        audit_report = run_6_pillar_architectural_audit()
        
        # 2. Run App Diagnostics & Regression Suite
        test_report = run_app_diagnostics_and_tests()
        
        # 3. Auto-Remediate Any Deviations
        remediated_actions = auto_remediate_all_violations(audit_report, test_report)
        
        # 4. Reset Cadence Counter
        state["turnsSinceLastAudit"] = 0
        state["totalTurns"] += 1
        state["lastAudit"] = {
            "timestamp": current_iso_timestamp(),
            "status": "PASSED" if (len(remediated_actions) == 0 and test_report["passed"]) else "REMEDIATED",
            "refactorsPerformed": remediated_actions,
            "checksPassed": ["quad_units", "layer_purity", "line_limits", "deduplication", "anti_polling", "diagnostics"]
        }
        state["history"].append(state["lastAudit"])
        write_json(state_path, state)
        
        # 5. Log in docs/HISTORY.md
        record_audit_in_project_history(state["lastAudit"])
        
        return {"mode": "AUDIT_AND_EDIT", "state": state}
    else:
        # ═══ NORMAL TURN: INCREMENT COUNTER & PROCEED ═══
        state["turnsSinceLastAudit"] += 1
        state["totalTurns"] += 1
        write_json(state_path, state)
        return {"mode": "NORMAL_EDIT", "state": state}
```

---

## 2. 6-PILLAR ARCHITECTURAL AUDIT CHECKLIST

### Pillar I: Entity & Functionality Quad-Unit Structure Audit
- [ ] Every entity resides in `entities/<EntityName>/` with `<EntityName>.ts` (`@role skeleton`).
- [ ] Every feature resides in `entities/<EntityName>/functionalities/<FeatureName>/`.
- [ ] Each functionality contains:
  - `main_function/logic.ts` (`@role skeleton`, receiving `(input, { state, entity })`)
  - `state_data/state.ts` (`@role component`)
  - `helper_functions/` (`@role component`)
  - `events/` (`@role component`)
  - `manifest.json` (declared dependencies)
- [ ] Public features are exposed at the System Entity entrypoint (`assembler.ts` / `index.ts`).
- **Action on Deviation**: Reorganize loose files into KrnlTS quad-unit folders and register them in the entity orchestrator.

### Pillar II: Data Struct & Signature Deduplication Audit
- [ ] Data structures with overlap $S_{\text{struct}}(A, B) \ge 0.65$ folded into a base parent in `libraries/{Domain}Concepts.ts`.
- [ ] Functions with identical input/output signatures unified into polymorphic generic template functions (`<TIn, TOut>`).
- **Action on Deviation**: Extract common parents to `libraries/{Domain}Concepts.ts`.

### Pillar III: Function Layer Purity & Intermixing Audit
- [ ] Strict unidirectional flow: $\text{Layer 0 (Pure/State)} \to \text{Layer 1 (Impure)} \to \text{Layer 2 (Complex Impure)} \to \text{Layer 3 (API)}$.
- [ ] Zero inline pure calculations or complex regex inside Impure functions (Layer 1).
- [ ] Zero calls from Complex Impure (Layer 2) or Top-Level API (Layer 3) to Pure Functions (Layer 0) or State Accessors directly.
- **Action on Deviation**: Extract inline math to `helper_functions/` (Layer 0A); replace skipped layer calls with intermediate Layer 1 step functions.

### Pillar IV: Skeletons, Components & Multi-Tier Line Limits Audit
- [ ] All files comply with the 200-line strict limit (`lines(f) <= 200`).
- [ ] Helper functions in `helper_functions/` do not exceed 30 lines without calling `libraries/{Domain}Concepts.ts`.
- [ ] Main functions in `main_function/logic.ts` do not exceed 20 lines without delegating to `helpers/` or state accessors.
- [ ] Files tagged `@role skeleton` are impure orchestrators; files tagged `@role component` are pure or atomic accessors.
- **Action on Deviation**: Split bloated files ($> 200$ lines), extract helper logic, and enforce role purity.

### Pillar V: Event-Driven vs. Polling/onTick Audit
- [ ] Zero `onTick()`, `tick()`, or continuous RAF loops running while idle.
- [ ] Zero `setInterval()` / `setTimeout()` busy polling loops for state, IPC, or database checks.
- [ ] State changes communicate reactively via `entity.emitEvent()`, `entity.on()`, `state:changed`, or WebSocket/SSE streams.
- **Action on Deviation**: Refactor polling loops into reactive event subscriptions or push listeners.

### Pillar VI: Zero-Mock Data, DB Wiring & App Diagnostics Audit
- [ ] Zero mock data objects or fake simulated promises in production feature paths.
- [ ] Real backend/DB connectivity configured via `entity.configureBackend(...)` or canonical control plane adapters.
- [ ] Build & Test Diagnostic Suite passes with 0 compilation errors:
  - `npm run build` generates clean ESM/CJS/DTS bundles.
  - `node dist/bin/krnlts-validate.js` passes 4-layer AST purity checks with 0 warnings.
  - Regression test scripts (`node examples/test_*.js`) execute with exit code 0.
- **Action on Deviation**: Wire real database adapters, resolve compilation/type errors, and fix broken regression assertions.

---

## 3. AUDIT, DIAGNOSTICS & REMEDIATION ALGORITHM
```python
def run_routine_audit_and_debug():
    """
    Automated Self-Correction & App Debugging Loop
    """
    # 1. Structure Remediation
    for feature in scan_features():
        if not is_krnlts_quad_unit_structured(feature):
            remediate_to_krnlts_quad_unit(feature)
            
    # 2. Deduplication Remediation
    struct_pairs = find_similar_structs(threshold=0.65)
    for A, B in struct_pairs:
        extract_to_concept_library(A, B)
        
    fn_clusters = cluster_by_signature_similarity()
    for cluster in fn_clusters:
        unify_into_generic_template_function(cluster)
        
    # 3. Layer Intermixing Remediation
    for fn in scan_all_functions():
        if fn.is_impure and has_inline_pure_calculations(fn):
            extract_to_helper_functions_layer_0(fn)
        if fn.is_complex_impure_or_api and calls_layer_0_directly(fn):
            route_through_intermediate_layer_1(fn)
            
    # 4. Line Limits & Delegation Thresholds
    for f in scan_modified_files():
        if line_count(f) > 200:
            split_into_atomic_modules(f)
        for helper in get_helpers(f):
            if line_count(helper) > 30:
                delegate_to_concept_library(helper)
        for main_fn in get_main_logics(f):
            if line_count(main_fn) > 20:
                delegate_to_helpers(main_fn)

    # 5. Polling & onTick Violations
    for f in scan_all_files():
        if has_polling_or_ontick_loop(f):
            refactor_to_event_driven_subscription(f)

    # 6. Diagnostics & Test Verification
    compilation_res = run_command("npm run build")
    if compilation_res.exit_code != 0:
        patch_syntax_and_type_errors(compilation_res.stderr)
        run_command("npm run build")
```
