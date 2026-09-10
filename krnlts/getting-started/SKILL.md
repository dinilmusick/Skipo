---
name: krnl-getting-started
description: Developer and agent guide for initializing Krnl workspaces, Krnl Studio visual node IDE, and CLI commands.
---

# KRNL WORKSPACE INITIALIZATION & QUICKSTART

## 1. SCAFFOLDING & LIFECYCLE

```bash
# Scaffolding
npx create-krnl <app-name> && cd <app-name>
pnpm install

# Development & Studio (http://localhost:8080)
npx krnl dev

# Quality Gate & Build
npx krnl validate   # AST purity, anti-polling, line limits
npx krnl build      # Compile to dist/
```

## 2. GENERATORS & CLI CHEAT SHEET

| Command | Action |
| :--- | :--- |
| `krnl generate entity <Name>` | Scaffolds flat entity `src/<Name>.ts` |
| `krnl generate functionality <Entity> <Name>` | Scaffolds Quad-Unit in `src/functionalities/<Name>/` |
| `krnl generate library <Domain>` | Scaffolds `src/libraries/{Domain}Concepts.ts` |
| `krnl generate subapp <Name>` | Scaffolds `src/subapps/<Name>/` with `subapp.json` |

## 3. STUDIO SURFACES (`http://localhost:8080`)

- **Architecture Canvas**: AST-synced node graph with Monaco source drawer.
- **UI Composer**: KrnlUI atom drag-and-drop with VanJS live preview.
- **Test Console**: Isolated Worker sandbox execution with JSON payload editor.
