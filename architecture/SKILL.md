---
name: architecture-sub-router
description: Sub-router directing agents deterministically to modular architecture sub-skills.
---

# ARCHITECTURE AGENT SUB-ROUTER

$$\text{Route}(\tau) = \arg\max_{s \in \mathcal{S}_{\text{arch}}} |\text{Keywords}(s) \cap \text{Tokens}(\tau)|$$

| Sub-Skill | Scope / Formal Directives |
| :--- | :--- |
| [`deduplication/SKILL.md`](./deduplication/SKILL.md) | 5-turn routine review, struct/fn deduplication, state persistence |
| [`function-layers/SKILL.md`](./function-layers/SKILL.md) | 4-layer purity hierarchy: $\mathcal{L}_0 \to \mathcal{L}_1 \to \mathcal{L}_2 \to \mathcal{L}_3$ isolation |
| [`entity-functionality/SKILL.md`](./entity-functionality/SKILL.md) | Quad-units (`main_function/`, `state_data/`, `helper_functions/`, `events/`) |
| [`libraries-concepts/SKILL.md`](./libraries-concepts/SKILL.md) | `{Domain}Concepts.ts` universal shared pure libraries |
| [`skeleton-components/SKILL.md`](./skeleton-components/SKILL.md) | Inheritance (Skeleton) vs Composition (Component) |
| [`code-limits/SKILL.md`](./code-limits/SKILL.md) | $\le 200$L/file, $\le 30$L helpers, $\le 20$L orchestrators |
| [`sub-app-engine/SKILL.md`](./sub-app-engine/SKILL.md) | Drag-and-drop zero-server engine (`subapp.json`, `register.ts`) |
| [`../api/SKILL.md`](../api/SKILL.md) | Canonical 8-Gate Pipeline (`createSecureRoute`), rate limit |

```python
def route_arch(intent: str) -> str:
    routes = {
        "dedup": "deduplication/SKILL.md", "layer": "function-layers/SKILL.md",
        "entity": "entity-functionality/SKILL.md", "concept": "libraries-concepts/SKILL.md",
        "skeleton": "skeleton-components/SKILL.md", "limit": "code-limits/SKILL.md",
        "subapp": "sub-app-engine/SKILL.md", "gate": "../api/SKILL.md"
    }
    return next((path for k, path in routes.items() if k in intent.lower()), "entity-functionality/SKILL.md")
```
