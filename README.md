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
skipo update --pages .                # aggressive whole-shell healing
skipo repair shell .                  # same canonical shell reconstruction
skipo repair shell . --plan           # enumerate rewrites/retirements first
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

**Canonical ownership invariant:** Every `src/**` source file outside `src/frontend/pages/main/tabs/**` is Skipo-controlled, including the auth/login, workspace, main, settings, backend facade/infrastructure, and canonical capabilities. No app-specific view or code may be kept in those shared locations. The only application-owned source is in main-page tab subtrees; standard runtime and service implementations remain in Skipo/Floks/Kloks. Environment values and deployment identity are configuration, not custom application code.

`skipo add main tab "Name"` creates a stable tab source and does not replace it on subsequent runs. `skipo update --pages .` and `skipo repair shell .` **aggressively reconstruct the standard Vite shell** from canonical Skipo scaffold and capability registry assets. These operations rewrite modified standard files and retire unknown `src/**` files outside tabs. They also restore broken auth/backend wiring, main/settings/workspace pages and standard build configuration, independent of pre-existing custom edits. `--plan` gives an exact list of rewrites/retirements without mutation; apply snapshots affected files and rolls back failed transactions. Repeating after successful repair yields `noop: true`.

**Migration requirement for older apps:** Aiko, SRKL, and Kone currently contain app-specific modules outside their tab trees. Before applying aggressive shell healing on those apps, migrate the app-specific functionality and its dependencies into their tab subtrees and declarative canonical capability registrations. Otherwise the command will intentionally retire the noncanonical source. Keep the first rollout as a PR, inspect `--plan`, verify builds and runtime behavior before merging.


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
