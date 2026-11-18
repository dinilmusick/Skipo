# Skipo — Application Builder, Installer & Composition Engine

Skipo is the deterministic application framework for the ULTRST ecosystem. It composes applications from canonical **Kloks backend services** and **Floks UI components** without copying their implementations into downstream apps.

## Core model

```text
Capability Registry
      ↓
    Resolver
      ↓
   Composer
      ↓
Application wiring
      ↓
   Verifier
      ↑
Drift Detector → Repair/Migrate
```

Skipo owns application construction, composition, migrations, generated wiring, architectural validation and verification. **ATAX owns agent coordination and persistent work state; Skipo does not manage agents.**

There is no application-level module architecture. Reusable functionality is expressed as a capability and resolved to its canonical provider.

## Deterministic commands

```bash
skipo create MyApp
skipo adopt .
skipo inspect .
skipo diagnose .
skipo plan .
skipo add auth
skipo add workspace
skipo add main
skipo add main tab "Mixer"
skipo add main tab "Diagnostics"
skipo update --pages .
skipo repair auth .
skipo repair workspace .
skipo repair main .
skipo update --pages . --plan
skipo add service storage
skipo add service midi
skipo add ui settings
skipo sync .
skipo update .
skipo repair .
skipo verify .
skipo test .
```

`add` is idempotent. It updates package dependencies and creates only thin app-owned wiring. Canonical UI/service implementations stay in Floks/Kloks.

Page commands target the Vite app in the current directory or accept an explicit app path. `login` aliases `auth`. The `main tab` command creates a stable named tab and never overwrites its app-owned body. `update --pages` reconciles auth, workspace and main together; `repair <page>` limits the same reconciliation to one page. `--plan` previews changes without writing. All page commands preflight declared wiring and refuse missing/ambiguous binding markers instead of inventing changes to app code. If an apply or post-repair idempotence check fails, touched managed files are restored from the pre-command snapshot. Rerunning a clean command reports `noop: true`. This repairs managed drift, not arbitrary unknown application-owned code.

`diagnose` detects local duplicate implementations and classifies them as **keep**, **adapt** or **retire**. `repair` uses the same composer as `add`, retires only registry-approved duplicate files, records migration state and re-verifies.

## Application state

Adopted applications carry:

```text
.skipo/
  project.json
  dependencies.json
  capabilities.json
  overrides.json
  migration-state.json
```

Generated surfaces are recorded as capability-owned state. Unknown application-specific code is not removed automatically.

## Canonical application frontend

Every Skipo application uses the canonical frontend planes:

```text
src/frontend/pages/
  auth/page.tsx
  menus/workspaces/page.tsx
  main/page.tsx
  settings/page.tsx
  settings/tabs/themes/page.tsx
  settings/tabs/accounts/page.tsx
```

Authentication is Luth-authoritative through Floks/Kloks. Workspace selection uses the canonical Floks workspace surface and Kloks workspace services.

## Provider boundary

Skipo consumes:
- `@ultrst-armada/floks) for reusable UI
- `@ultrst-armada/kloks) for reusable backend services
- `@ultrst-armada/frnlts) for application UI framework
- `@ultrst-armada/krnl) for application backend framework
- `@dinilmusick/gutts) for shared ecosystem utilities

Skipo never becomes the implementation owner of those underlying capabilities.

## Canonical Application Contract

The repository's canonical application contract remains [architecture/app-architecture/SKILL.md](./architecture/app-architecture/SKILL.md). Workspace and storage rules remain [architecture/workspace-architectures/SKILL.md](./architecture/workspace-architectures/SKILL.md).
