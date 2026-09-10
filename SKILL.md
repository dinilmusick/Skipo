---
name: skipo-agent-router
description: Master router and deterministic dispatcher directing the AI agent to modular sub-skills across UI, API, Data, Database, Architecture, Features, and Docs.
---

# SKIPO AGENT ROUTER (COMPACT KERNEL)

$$\mathcal{T}_{\text{agent}} = \langle \text{Guard}(\text{turns}), \text{DetectMode}(\text{deps}), \text{Dispatch}(\text{domain}), \text{Gate}(\text{exitCode}) \rangle$$

## 1. ROUTING LOGIC FLOW

```python
def turn_start(workspace="."):
    # Step 0: Cadence Turn Counter Guard
    state_file = f"{workspace}/.skipo/agent-state.json"
    state = read_json(state_file) if exists(state_file) else {"turns": 0, "threshold": 5}
    state["turns"] += 1
    if state["turns"] >= state["threshold"]:
        exec("python3 checklists/full_system_validator.py .")
        state["turns"] = 0
    write_json(state_file, state)

    # Step 1: Detect Mode & Load Root Router
    if exists("krnl.json") or has_dep("@dinilmusick/krnlts"):
        load_skill("./krnlts/SKILL.md")       # Mode A: KrnlTS Engine
    elif has_dep("@skipo/core") or exists("pnpm-workspace.yaml"):
        load_skill("./standalone/SKILL.md")   # Mode B: Standalone Skipo Monorepo
    else:
        load_skill("./architecture/SKILL.md") # Mode C: Baseline Architecture
```

## 2. DOMAIN DISPATCH MATRIX

| Intent Keywords | Target Skill | Core Constraint |
| :--- | :--- | :--- |
| `turn_counter`, `cadence`, `dedup`, `remediate` | [`architecture/deduplication/SKILL.md`](./architecture/deduplication/SKILL.md) | State file, $\Delta \text{Logic} = 0$, 5-turn cadence |
| `code_limits`, `file_lines`, `1_component` | [`architecture/code-limits/SKILL.md`](./architecture/code-limits/SKILL.md) | $\le 200\text{L/file}$, 1-comp/file, pure App.tsx |
| `purity`, `layers`, `L0_L3`, `helpers` | [`architecture/function-layers/SKILL.md`](./architecture/function-layers/SKILL.md) | $L_0 \dots L_3$ strict hierarchy ($L_a \not\to L_b, a < b$) |
| `subapp`, `subapp_engine`, `manifest` | [`architecture/sub-app-engine/SKILL.md`](./architecture/sub-app-engine/SKILL.md) | `subapp.json`, zero server, CoreEngine |
| `entity`, `functionality`, `quad_unit` | [`architecture/entity-functionality/SKILL.md`](./architecture/entity-functionality/SKILL.md) | 4-unit atom: Logic, Schema, Table, Tests |
| `ui_primitive`, `button`, `input`, `theme` | [`ui/styling/SKILL.md`](./ui/styling/SKILL.md) | Zero raw HTML, 100% `var(--skipo-*)` |
| `layout`, `top_toolbar`, `bottom_strip`, `panel` | [`ui/dock-toolbar/SKILL.md`](./ui/dock-toolbar/SKILL.md) | TopToolbar(44px), BottomStrip(30px), DetailsPanel |
| `backend`, `control_plane`, `data_plane` | [`backend/SKILL.md`](./backend/SKILL.md) | ControlPlane $\cap$ DataPlane = $\emptyset$ |
| `storage`, `b2`, `s3`, `presigned`, `upload` | [`backend/workspace-storage/SKILL.md`](./backend/workspace-storage/SKILL.md) | Presigned URLs, zero `/tmp` proxying |
| `auth`, `multi_session`, `refresh_token` | [`backend/control-plane/SKILL.md`](./backend/control-plane/SKILL.md) | Token rotation, progressive trust tiers |
| `api`, `8_gate`, `rate_limit`, `security` | [`api/SKILL.md`](./api/SKILL.md) | 8-gate request lifecycle, anti-polling $\ge 5\text{s}$ |
| `test`, `coverage`, `anti_stub`, `zero_mock` | [`features/SKILL.md`](./features/SKILL.md) | Companion `*.test.ts(x)`, real assertions, zero stubs |

## 3. BLOCKING VERIFICATION GATE

$$\text{TaskDone} \iff \text{exitCode}(\text{python3 checklists/full\_system\_validator.py .}) == 0$$
