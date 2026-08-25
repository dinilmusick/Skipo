# Skipo Canonical Skills & Prompt Catalog

## 1. Overview
`Skipo` is the canonical, source-of-truth repository containing:
1. **Modular Agent Skills**: Specialized domain instruction sets covering architecture, 4-layer function purity, Universal Backend, UI, APIs, databases, and system orchestration.
2. **Task-Specific Prompt Library** ([`prompts/`](./prompts/README.md)): Formalized, token-efficient prompt attachments ready to be appended to any agent task.

## 2. Directory Structure
| Directory | Focus Area |
| :--- | :--- |
| [`architecture/`](./architecture/SKILL.md) | Gross Architecture principles: Entity-Functionality composition, 4-layer purity ($L_0 \dots L_3$), sub-apps, code limits ($\le 150$ lines). |
| [`backend/`](./backend/SKILL.md) | Universal Backend Architecture: Control Plane, Workspace Data Plane, decoupled data/storage providers. |
| [`prompts/`](./prompts/README.md) | Task-specific prompt templates for features, refactoring, backend, UI, sub-apps, APIs, and debugging. |
| [`ui/`](./ui/SKILL.md) | Central style authority design tokens, reactive state listeners, docks, force graphs, and React Flow nodes. |
| [`api/`](./api/SKILL.md) | Single-port unified ingress protocol adapters (REST, WebSocket, MCP, ACP). |
| [`database/`](./database/SKILL.md) & [`data/`](./data/SKILL.md) | One-table-per-functionality rule, automatic migrations, and schema validation. |
| [`krnlts/`](./krnlts/SKILL.md) | Magnetic Loader auto-mounting, network ingress, and validation CLI tooling. |
| [`features/`](./features/SKILL.md) | Feature authoring and atomic functionality encapsulation rules. |
| [`docs/`](./docs/SKILL.md) | Project history tracking, in-code docblocks with flowcharts, bold section demarcations, long naming conventions, and folder explanation rules. |
