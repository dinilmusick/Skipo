---
name: skipo-standalone-app-architecture
description: Architectural standard for building standalone applications (Next.js, React SPA, Electron) using @skipo/* modular packages with base classes, container inheritance, and zero KrnlTS dependencies.
---

# SKIPO STANDALONE APPLICATION ARCHITECTURE

Standard guide for developing modern, framework-agnostic web and desktop applications using the standalone `@skipo/*` package suite without exposing or requiring `@dinilmusick/krnlts`.

---

## 1. Core Architectural Laws

$$\text{App} = \{\text{UI (Theme} \oplus \text{Base Components} \oplus \text{Containers)}, \text{Systems (Graphs, Menus, Canvas)}, \text{Backend (Control Plane} \oplus \text{Data Plane)}\}$$

$$\text{Enforcement} = @\text{skipo/validate (AST Purity} \wedge \text{Line Limits} \wedge \text{Base Class Usage)}$$

### Law 1: Component Inheritance Mandate
Every application UI element MUST inherit or compose directly from `@skipo/ui` base classes (`BaseButton`, `BaseInput`, `BaseTextarea`, `BaseSelect`, `BaseCard`, `BaseBadge`, `BaseToggle`, `BaseTooltip`).
- **Forbidden**: Raw HTML elements (`<button>`, `<input>`, `<textarea>`, `<select>`, unstyled `<div>` buttons).
- **Rationale**: Guarantees identical 2.5D Neo-Brutalism theme tokens (`--skipo-*`), active/hover elevation states, responsive tactile feedback, and accessibility compliance.

### Law 2: Container Law
All views, screens, and dialogs MUST be enclosed within `@skipo/ui` containers:
- `AppShell`: Top-level framework enclosing headers, sidebars, and viewport.
- `PageContainer`: Standardized padding, max-width clamping, and header/action slots.
- `SectionContainer`: Structured subsections with collapsible capabilities.
- `ModalContainer` / `DrawerContainer`: Overlays with backdrop blur and keyboard escape traps.

### Law 3: Universal Backend Separation
$$\text{Control Plane (User Auth / Config)} \cap \text{Data Plane (Workspace Storage)} = \emptyset$$
- Use `@skipo/backend/auth` (`BaseAccountProvider` / `LocalAccountProvider` / `HostedAccountProvider`) for identity, roles (`user` vs `admin`), and session tokens.
- Use `@skipo/backend/storage` (`WorkspaceFS` / `SyncEngine`) for workspace file and object operations.
- Application logic must NEVER assume workspace data and user accounts share the same database.

### Law 4: Interactive Systems Reuse
Never reinvent complex interactive systems:
- **Node Graphs**: Use `@skipo/systems/node-graph` (`NodeGraphCanvas`, `useNodeGraph`, `Viewport`).
- **Tile Menus**: Use `@skipo/systems/tile-menu` (`TileGrid`, `Tile`, `useTileMenu`).
- **Dock Toolbars**: Use `@skipo/systems/dock` (`DockBar`, `DockItem`, `useDock`).
- **Infinite Canvas**: Use `@skipo/systems/canvas` (`InfiniteCanvas`, `CanvasViewport`, `MiniMap`).
- **Code Editor**: Use `@skipo/systems/editor` (`MonacoEditor`, `skipo-dark` theme).

### Law 5: Compile-Time Verification
Run `@skipo/validate` (`skipo-validate`) on every build turn to enforce:
1. Max 200 lines per file.
2. 4-layer function purity ($L_0 \to L_1 \to L_2 \to L_3$).
3. Top-level file purity (imports + root composition only).
4. One component per file.
5. Base class usage across all React components.

---

## 2. Package Dependency Architecture

```
@skipo/core        --> Shared types, async, fs-lock, object, string, cache, env, http, events
    ^
    |------------------------|-------------------------|
    |                        |                         |
@skipo/ui               @skipo/backend           @skipo/validate
(Theme, Base, Cont.)     (Auth, Storage, API)     (ts-morph AST & ESLint)
    ^
    |
@skipo/systems
(Graphs, Tiles, Docks)
```

---

## 3. Scaffolding a Standalone App

Use `create-skipo` to instantly bootstrap a fully compliant workspace:

```bash
# Next.js App Router
npx create-skipo my-app --template nextjs

# React + Vite SPA
npx create-skipo my-spa --template react-vite

# Electron Desktop App
npx create-skipo my-desktop --template electron
```

---

## 4. Root Application Structure (Next.js Example)

```
my-skipo-app/
├── package.json
├── tsconfig.json
├── next.config.js
├── src/
│   ├── app/
│   │   ├── layout.tsx         --> Root layout wrapping <SkipoThemeProvider>
│   │   ├── page.tsx           --> Landing page wrapped in <PageContainer>
│   │   ├── login/page.tsx     --> User login via @skipo/backend auth
│   │   ├── admin/
│   │   │   ├── login/page.tsx --> Admin login route
│   │   │   └── page.tsx       --> Admin dashboard (<AdminPanel>)
│   │   └── api/
│   │       ├── auth/          --> BaseAccountProvider REST endpoints
│   │       ├── events/        --> Real-time SSE event stream
│   │       └── workspace/     --> WorkspaceFS file operations
│   ├── components/            --> Custom components inheriting from @skipo/ui
│   └── lib/                   --> Services extending SkipoBase
└── scripts/
    ├── create-admin.ts        --> Server-side admin account bootstrap
    └── validate.ts            --> Pre-commit / CI constraint validation
```

---

## 5. Verification Checklist

Before considering an app generation turn complete, run:
```bash
# 1. Typecheck
pnpm typecheck

# 2. Architectural constraints verification
npx skipo-validate

# 3. Unit and integration test suite
pnpm test
```
All three gates must pass with 0 errors.
