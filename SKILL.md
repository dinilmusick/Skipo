---
name: skipo-agent-router
description: Master router and deterministic dispatcher directing the AI agent to modular sub-skills across UI, API, Data, Database, Architecture, Features, and Docs, powered by assistant.py, generators/, and mutators/.
---

# SKIPO AGENT ROUTER & DETERMINISTIC ENGINE

$$\mathcal{T}_{\text{agent}} = \langle \text{Advise}(\text{assistant.py}), \text{Mutate}(\text{mutators/}), \text{Generate}(\text{generators/}), \text{Gate}(\text{checklists/}) \rangle$$

## 1. ROUTING LOGIC FLOW

```python
def turn_start(workspace="."):
    # Step 0: Cadence Turn Counter Guard
    state_file = f"{workspace}/.skipo/agent-state.json"
    state = read_json(state_file) if exists(state_file) else {"turns": 0, "threshold": 5}
    state["turns"] += 1
    if state["turns"] >= state["threshold"]:
        exec("python3 assistant.py validate .")
        state["turns"] = 0
    write_json(state_file, state)

    # Step 1: Detect Mode & Load Root Router
    if has_dep("@skipo/core") or exists("pnpm-workspace.yaml"):
        load_skill("./standalone/SKILL.md")   # Mode A: Standalone Skipo Monorepo
    else:
        load_skill("./architecture/SKILL.md") # Mode B: Baseline Architecture
```

## 2. DETERMINISTIC AGENT ASSISTANT COMMANDS

AI coding agents should invoke `python3 assistant.py` as their primary interface:

```bash
# Get strategic advice and skill links for any task:
python3 assistant.py advise "<task description>"

# Check active environment and turn count:
python3 assistant.py status

# Scaffold complete multi-file directory suites:
python3 assistant.py generate component <path> --name <Name>
python3 assistant.py generate entity <path> --name <Name>
python3 assistant.py generate shell <path>
python3 assistant.py generate nodegraph <path> --name <Name>
python3 assistant.py generate driver <path> --name <Name>
python3 assistant.py generate route <path> --name <Name>
python3 assistant.py generate subapp <path> --name <Name>

# Restructure and auto-remediate existing codebases:
python3 assistant.py mutate planes <dir>    # Consolidate into src/frontend & src/backend
python3 assistant.py mutate tokens <dir>    # Replace #hex/rgb with var(--skipo-*)
python3 assistant.py mutate sections <dir>  # Inject // ════ banners and ASCII flowcharts
python3 assistant.py mutate split <file>    # Split oversized files >200 lines
python3 assistant.py mutate all <dir>       # Full autonomous remediation pipeline

# Gate architectural compliance:
python3 assistant.py validate .
```

## 3. DOMAIN DISPATCH MATRIX

| Intent Keywords | Target Skill | Core Constraint & Generator Command |
| :--- | :--- | :--- |
| `turn_counter`, `cadence`, `dedup`, `remediate` | [`architecture/deduplication/SKILL.md`](./architecture/deduplication/SKILL.md) | `python3 assistant.py mutate all .` |
| `code_limits`, `file_lines`, `1_component` | [`architecture/code-limits/SKILL.md`](./architecture/code-limits/SKILL.md) | $\le 200\text{L/file}$, `python3 assistant.py mutate split <file>` |
| `purity`, `layers`, `L0_L3`, `helpers` | [`architecture/function-layers/SKILL.md`](./architecture/function-layers/SKILL.md) | `python3 assistant.py generate logic <path> --name <Name>` |
| `subapp`, `subapp_engine`, `manifest` | [`architecture/sub-app-engine/SKILL.md`](./architecture/sub-app-engine/SKILL.md) | `python3 assistant.py generate subapp <path> --name <Name>` |
| `entity`, `functionality`, `quad_unit` | [`architecture/entity-functionality/SKILL.md`](./architecture/entity-functionality/SKILL.md) | `python3 assistant.py generate entity <path> --name <Name>` |
| `ui_primitive`, `button`, `input`, `theme` | [`ui/styling/SKILL.md`](./ui/styling/SKILL.md) | `python3 assistant.py generate component <path> --name <Name>` |
| `layout`, `top_toolbar`, `bottom_strip`, `panel` | [`ui/dock-toolbar/SKILL.md`](./ui/dock-toolbar/SKILL.md) | `python3 assistant.py generate shell <path>` |
| `backend`, `control_plane`, `data_plane` | [`backend/SKILL.md`](./backend/SKILL.md) | ControlPlane $\cap$ DataPlane = $\emptyset$ |
| `storage`, `b2`, `s3`, `presigned`, `upload` | [`backend/workspace-storage/SKILL.md`](./backend/workspace-storage/SKILL.md) | `python3 assistant.py generate storage <path>` |
| `auth`, `multi_session`, `refresh_token` | [`backend/control-plane/SKILL.md`](./backend/control-plane/SKILL.md) | Token rotation, progressive trust tiers |
| `api`, `8_gate`, `rate_limit`, `security` | [`api/SKILL.md`](./api/SKILL.md) | `python3 assistant.py generate route <path> --name <Name>` |
| `app_contract`, `application_shape`, `spec` | [`architecture/app-architecture/SKILL.md`](./architecture/app-architecture/SKILL.md) | Single facade, plane isolation, universal backend |
| `test`, `coverage`, `anti_stub`, `zero_mock` | [`features/SKILL.md`](./features/SKILL.md) | `python3 assistant.py generate test <path> --name <Name>` |

## 4. BLOCKING VERIFICATION GATE

$$\text{TaskDone} \iff \text{exitCode}(\text{python3 assistant.py validate .}) == 0$$
