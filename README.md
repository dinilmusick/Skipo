# Skipo Canonical Skills & Prompt Catalog

## 1. Overview
`Skipo` is the canonical, source-of-truth repository containing:
1. **Modular Agent Skills**: Specialized domain instruction sets covering architecture, 4-layer function purity, Universal Backend, UI, APIs, databases, and system orchestration.
2. **Task-Specific Prompt Library** ([`prompts/`](./prompts/README.md)): Formalized, token-efficient prompt attachments ready to be appended to any agent task.
3. **Canonical Application Contract** ([`architecture/app-architecture/SKILL.md`](./architecture/app-architecture/SKILL.md)): The primary orientation document for humans and coding agents creating Skipo applications.

## 1.1 Canonical Skipo Application Frontend

Every package marked with a `skipo` application manifest uses this frontend contract:

```text
src/frontend/pages/
├── auth/page.tsx
├── menus/
│   ├── workspaces/page.tsx
│   └── <optional-menu>/page.tsx
├── main/
│   ├── page.tsx
│   └── tabs/<application-tab>/...
└── settings/
    ├── page.tsx
    └── tabs/
        ├── themes/page.tsx
        └── accounts/page.tsx
```

Auth and Workspace Tiles are mandatory ecosystem surfaces. Main owns the standardized top/bottom shell and application-level immersive mode; application-specific working UI belongs under `main/tabs/`. Settings is mandatory, with Themes and Accounts mandatory tabs. Accounts synchronize the authenticated user's app-relevant service accounts from SRKL.

The contract is enforced by `checklists/19_skipo_frontend_structure.py` and included in the full-system validator and application scaffold.

## 2. Directory Structure
| Directory | Focus Area |
| :--- | :--- |
| [`architecture/app-architecture/`](./architecture/app-architecture/SKILL.md) | Canonical application structure and agent workflow. |
| [`architecture/workspace-architectures/`](./architecture/workspace-architectures/SKILL.md) | Unified workspace and storage architecture. |
| [`architecture/`](./architecture/SKILL.md) | Architecture sub-router and domain specifications. |
| [`backend/`](./backend/SKILL.md) | Universal Backend Architecture: Control Plane, Workspace Data Plane, decoupled data/storage providers. |
| [`prompts/`](./prompts/README.md) | Task-specific prompt templates for features, refactoring, backend, UI, sub-apps, APIs, and debugging. |
| [`ui/`](./ui/SKILL.md) | Central style authority design tokens, reactive state listeners, docks, force graphs, and React Flow nodes. |
| [`api/`](./api/SKILL.md) | Single-port unified ingress protocol adapters (REST, WebSocket, MCP, ACP). |
| [`database/`](./database/SKILL.md) & [`data/`](./data/SKILL.md) | One-table-per-functionality rule, automatic migrations, and schema validation. |
| [`features/`](./features/SKILL.md) | Feature authoring and atomic functionality encapsulation rules. |
| [`docs/`](./docs/SKILL.md) | Project history tracking, in-code docblocks with flowcharts, bold section demarcations, long naming conventions, and folder explanation rules. |

## 3. Cloud-Agent Harness Contract

Skipo is designed to run without non-standard Python dependencies in browser-hosted coding environments, including Google AI Studio build workspaces and Cloud Shell.
Use `python3 assistant.py` as the entrypoint. Machine consumers must pass `--json`; that mode writes exactly one JSON document to stdout.

All generated applications have two required deployment targets:

- `build:fullstack` deploys the full-stack application to Vercel-compatible hosting.
- `build:api` emits the API target for Cloudflare Workers through `httpsAdapter.ts`.

`python3 assistant.py generate multi-target <app-root> --name <AppName>` creates the target manifests, Vercel and Wrangler configuration, API tsconfig, build scripts, and a non-secret `.env.example`. Real environment values are configured only in the hosting platform's secret store.

For arbitrary edits, cloud agents use `python3 assistant.py edit operations.json`. The operation document is path-contained and each successful edit is recorded in `.skipo/actions/`, giving subsequent agents an explicit return message and audit trail.
