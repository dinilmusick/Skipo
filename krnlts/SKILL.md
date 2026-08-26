---
name: krnlts-runtime-router
description: Sub-router activated when @dinilmusick/krnl or @dinilmusick/krnlts is detected in a project, directing agents to getting-started scaffolding, Krnl Studio visual IDE, agentic API endpoints, runtime mechanisms, MagneticLoader, Flows, Utility Tools, and Ingress Gateway.
---

# KRNLTS RUNTIME EXTENSION ROUTER

This sub-router is activated **strictly when a project uses `@dinilmusick/krnl` or `@dinilmusick/krnlts`** (as detected via `package.json`, `krnl.json`, or `@dinilmusick/krnl*` imports).

It extends the universal **Skipo Base Skills** with concrete Krnl Framework and Krnl Studio mechanics.

---

## 1. KRNLTS SUBSYSTEM ROUTING MATRIX

| Subsystem / Task | Target Skill File | Directives & Primitives Covered | Trigger Keywords |
| :--- | :--- | :--- | :--- |
| **Agentic API Suite & Docs** | [`api-endpoints/SKILL.md`](./api-endpoints/SKILL.md) | REST/WebSocket endpoints (`/api/v1/*`), Preemptive Documentation, real-time UI observable sync, sandboxed testing | `agentic_api`, `preemptive_documentation`, `studio_api`, `api_endpoints`, `ai_agent_endpoints`, `programmatic_build` |
| **Getting Started & Studio IDE** | [`getting-started/SKILL.md`](./getting-started/SKILL.md) | `create-krnl`, `krnl dev`, Krnl Studio visual node IDE, Monaco editor suite, quad-unit scaffolding | `getting_started`, `create_krnl`, `krnl_dev`, `studio_ide`, `fresh_workspace`, `init_project`, `scaffold` |
| **Core Entity & Flows** | [`runtime/SKILL.md`](./runtime/SKILL.md) | `Entity<TState, TEvents>`, `this.flow()`, `this.call()`, capability bubbling, resolution | `krnl_entity`, `flow_builder`, `resolve_capability`, `emit_event` |
| **Magnetic Discovery & SubApps** | [`magnetic-loader/SKILL.md`](./magnetic-loader/SKILL.md) | `KrnlMagneticLoader.loadAll()`, boot order invariants, worker/local sub-apps | `magnetic_loader`, `load_all`, `subapp_registration`, `boot_order` |
| **Krnl-Tools Utility Suite** | [`utility-tools/SKILL.md`](./utility-tools/SKILL.md) | `KrnlFS`, `KrnlEnv`, `KrnlShell`, `AsyncKit`, `ObjectKit`, `CacheKit` | `krnl_fs`, `krnl_env`, `file_lock`, `p_limit`, `deep_clone` |
| **Ingress & Port Gateway** | [`network-ingress/SKILL.md`](./network-ingress/SKILL.md) | Unified HTTP/WS port (`/call/{fid}`), dynamic discovery fallback chain, MCP surface | `unified_adapter`, `comm_port`, `port_discovery`, `mcp_gateway` |
| **AST Validator & CI Gates** | [`validation-cli/SKILL.md`](./validation-cli/SKILL.md) | `krnlts-validate`, `krnlts-watch`, 4-layer purity AST parser, multi-tier line limits | `krnlts_validate`, `purity_rules`, `ast_validation`, `ci_gate` |

---

## 2. DETERMINISTIC KRNLTS DISPATCH LOGIC
```python
def dispatch_krnlts_subsystem(task_intent: str) -> str:
    mapping = {
        "api-endpoints": ["agentic_api", "preemptive_documentation", "studio_api", "api_endpoints", "ai_agent_endpoints", "programmatic_build"],
        "getting-started": ["getting_started", "create_krnl", "krnl_dev", "studio_ide", "fresh_workspace", "init_project", "scaffold", "new_project"],
        "runtime": ["krnl_entity", "flow_builder", "resolve_capability", "emit_event", "state_mutation"],
        "magnetic-loader": ["magnetic_loader", "load_all", "subapp_registration", "boot_order", "subapp_worker"],
        "utility-tools": ["krnl_fs", "krnl_env", "file_lock", "p_limit", "deep_clone", "cache_kit"],
        "network-ingress": ["unified_adapter", "comm_port", "port_discovery", "mcp_gateway", "websocket_rpc"],
        "validation-cli": ["krnlts_validate", "purity_rules", "ast_validation", "ci_gate", "compiler_rules"]
    }
    for subskill, keywords in mapping.items():
        if any(kw in task_intent.lower() for kw in keywords):
            return f"./{subskill}/SKILL.md"
    return "./runtime/SKILL.md"  # Default fallback
```
