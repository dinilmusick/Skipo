---
name: krnl-getting-started
description: Complete step-by-step developer and AI agent guide for initializing a fresh Krnl workspace, launching Krnl Studio visual node IDE, scaffolding quad-units, and building/validating projects.
---

# KRNL WORKSPACE INITIALIZATION & GETTING STARTED GUIDE

This skill specifies the standard workflow for initializing a new, clean full-stack application workspace using the **Krnl Framework** and exploring it via **Krnl Studio**.

---

## 1. QUICKSTART IN A FRESH DIRECTORY

### Method A: Interactive Scaffolder (`create-krnl`) — Recommended
To scaffold a ready-to-run Krnl workspace with all dependencies, configuration, root entity, and quad-unit functionality in one command:

```bash
# Using npm
npm create krnl my-krnl-app

# Using npx
npx create-krnl my-krnl-app

# Using pnpm
pnpm dlx create-krnl my-krnl-app
```

Then navigate into the project and launch the visual IDE:
```bash
cd my-krnl-app
npm install  # (or pnpm install)
npx krnl dev
```
> **Krnl Studio** will automatically start at `http://localhost:8080` with the Architecture Canvas, UI Composer, and Live Test Console.

---

### Method B: Manual Initialization in an Existing Empty Directory
If you prefer initializing in an existing folder:

```bash
mkdir my-app && cd my-app
npm init -y

# Install Krnl Framework dependencies
npm install @dinilmusick/krnl @dinilmusick/krnl-core @dinilmusick/krnl-ui
npm install -D @dinilmusick/krnl-validate @dinilmusick/krnl-cli typescript @types/node

# Generate standard configuration files
npx krnl generate entity App
npx krnl generate functionality App Welcome
npx krnl generate library CoreConcepts

# Start Krnl Studio Visual IDE
npx krnl dev
```

---

## 2. STANDARD KRNL WORKSPACE LAYOUT

A valid Krnl workspace created by `create-krnl` adheres strictly to the following directory structure:

```
my-krnl-app/
├── krnl.json                  → Workspace manifest (port, backend providers, entry)
├── package.json               → Framework dependencies and scripts
├── tsconfig.json              → TypeScript paths and strict compiler rules
├── docs/
│   └── HISTORY.md             → Project memory and architectural intent tracking
└── src/
    ├── entities/              → Layer 3 & API Ingress Entities
    │   └── App/
    │       ├── App.ts         → Root Entity extending Entity with boot() & flows
    │       ├── functionalities/
    │       │   └── Welcome/   → Quad-Unit Functionality
    │       │       ├── WelcomeAtom.ts            → Input & Output schema interfaces
    │       │       ├── main_function/logic.ts    → Layer 2 Complex Impure logic orchestrator
    │       │       ├── state_data/state.ts       → Layer 0 Pure State Accessor & initial state
    │       │       ├── helper_functions/         → Layer 1 Simple Impure helper functions
    │       │       └── events/                   → Event emitter/collector descriptors
    │       └── entities/      → Child Component Entities (Display, Logger, Engines)
    ├── libraries/             → Layer 0 Pure Domain Concepts ({Domain}Concepts.ts)
    │   └── AppConcepts.ts
    ├── subapps/               → Isolated Full-Stack Sub-Apps (subapp.json + operations)
    └── ui/                    → VanJS Direct-DOM UI Views (composed with KrnlUI atoms)
```

---

## 3. CORE CLI COMMANDS

| Command | Purpose |
| :--- | :--- |
| **`krnl dev`** | Launches **Krnl Studio Visual IDE** (`http://localhost:8080`) with live WebSocket RPC, AST synchronization, and isolated Worker sandbox. |
| **`krnl validate`** | Runs deep AST analysis enforcing 4-layer function purity, 200-line limits, anti-polling, and zero zombie code. |
| **`krnl build`** | Validates purity gates and compiles the workspace into self-contained `dist/` artifacts for production deployment. |
| **`krnl watch`** | Generates ambient TypeScript declarations (`krnl-magnetic.d.ts`) for magnetic auto-discovery. |
| **`krnl generate entity <Name>`** | Scaffolds a new Entity with magnetic loading hooks. |
| **`krnl generate functionality <Entity> <Name>`** | Generates a 4-part Quad-Unit (`Atom`, `logic.ts`, `state.ts`, `helper_functions/`). |
| **`krnl generate library <Domain>`** | Creates a Layer 0 pure domain concept library (`{Domain}Concepts.ts`). |
| **`krnl generate subapp <Name>`** | Scaffolds a self-contained sub-app with manifest and operation handlers. |

---

## 4. USING KRNL STUDIO (THE VISUAL ENVIRONMENT)

When `krnl dev` is running, open `http://localhost:8080` in your browser (Brave, Chrome, Safari):

1. **🏗️ Architecture Canvas**:
   - Visual interactive node graph of all entities, functionalities, concept libraries, and sub-apps.
   - Right-click anywhere on the canvas $\to$ **New Entity**, **New Functionality**, or **New Domain Library** (surgically generates code on disk via `ts-morph`).
   - Click any node to open the **Monaco Source Code Drawer** to inspect and verify source code.
2. **🎨 UI Composer Canvas**:
   - Drag KrnlUI atoms (`KrnlButton`, `KrnlTextInput`, `KrnlDropdown`, `KrnlTile`, `KrnlDock`) into the layout canvas.
   - Inspect the real-time **Monaco TypeScript Editor** showing generated VanJS component source code.
3. **🧪 Live Test Console**:
   - Pick any function from the left sidebar.
   - Edit test input in the **Monaco JSON Editor**.
   - Click **▶ Execute in Sandbox** to run the function in an isolated worker thread with millisecond latency metrics.
4. **⚡ Run AST Purity Audit**:
   - Click the audit button in the top header to run deep purity checks across the active workspace.
