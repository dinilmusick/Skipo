---
name: krnlts-runtime-router
description: Sub-router activated when @dinilmusick/krnl or @dinilmusick/krnlts is detected in a project.
---

# KRNLTS RUNTIME EXTENSION ROUTER

$$\text{Active}(\text{KrnlTS}) \iff \text{hasDependency}(\text{"@dinilmusick/krnl"}) \vee \exists \text{krnl.json}$$

$$\text{Route}(\tau) = \arg\max_{s \in \mathcal{S}_{\text{krnlts}}} |\text{Keywords}(s) \cap \text{Tokens}(\tau)|$$

| Subsystem | Target Skill | Core Directives |
| :--- | :--- | :--- |
| **Agentic API** | [`api-endpoints/SKILL.md`](./api-endpoints/SKILL.md) | REST/WS endpoints, Preemptive Documentation, sandboxed tests |
| **Getting Started** | [`getting-started/SKILL.md`](./getting-started/SKILL.md) | `create-krnl`, `krnl dev`, Krnl Studio visual node IDE |
| **Runtime Engine** | [`runtime/SKILL.md`](./runtime/SKILL.md) | `Entity<TState, TEvents>`, `this.flow()`, capability bubbling |
| **Magnetic Loader** | [`magnetic-loader/SKILL.md`](./magnetic-loader/SKILL.md) | `KrnlMagneticLoader.loadAll()`, boot order, subapp worker modes |
| **Utility Suite** | [`utility-tools/SKILL.md`](./utility-tools/SKILL.md) | `KrnlFS`, `KrnlEnv`, `AsyncKit`, `CacheKit` |
| **Network Ingress** | [`network-ingress/SKILL.md`](./network-ingress/SKILL.md) | Unified HTTP/WS port, fallback resolution, MCP tools |
| **AST Validator** | [`validation-cli/SKILL.md`](./validation-cli/SKILL.md) | `krnlts-validate`, 4-layer purity AST parser, line limits |

```python
def route_krnlts(intent: str) -> str:
    routes = {
        "api": "api-endpoints", "start": "getting-started", "dev": "getting-started",
        "runtime": "runtime", "flow": "runtime", "magnetic": "magnetic-loader",
        "tool": "utility-tools", "port": "network-ingress", "validate": "validation-cli"
    }
    return next((f"./{v}/SKILL.md" for k, v in routes.items() if k in intent.lower()), "./runtime/SKILL.md")
```
