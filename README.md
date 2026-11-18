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
skipo auth .                  # full-stack auth UI + routes + Kloks/Luth wiring
skipo workspaceMenu .         # full-stack workspace UI + services + storage routes
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

**Canonical application boundary:** All frontend code outside `src/frontend/pages/main/tabs/**` is generated, owned and repaired by Skipo. Application-specific backend capabilities and services are permitted. Canonical backend infrastructure (Luth authentication adapters, workspace/storage service facades, provider-facing routes, shared backend facade and deployment adapters) must conform to Skipo and delegate to Kloks; app-specific service code is preserved. When an existing local backend service duplicates a verified Kloks capability, migrate all callers to the Kloks facade and retire that duplicate only after successful integration tests.

**Page commands are full-stack operations:** `skipo auth .`, `skipo workspaceMenu .`, `skipo add auth .`, `skipo add workspace .`, `skipo add main .`, and `skipo add main tab "Name" .` reconcile the canonical frontend **and** backend adapters, API paths, Luth session validation, Kloks capability facades and deployment scaffolding, not just UI markup. `skipo update --pages .` and `skipo repair shell .` reconcile the complete standard shell. `--plan` lists frontend/backend stack ownership, routes, provider contracts, and changes without writing. Repeating a clean command yields `noop: true`; failures roll back exact files and leave custom tabs and backend services intact.

**Migration for Aiko, SRKL, Kone and Kal:** These apps still have custom UI and dependencies outside the tab subtrees. Preserve the functionality by moving app frontend code into main tabs and replacing local provider duplicates with canonical Floks/Kloks interfaces. Then apply the full-stack Skipo repair and independently verify auth callback, sign-out, workspace operations, saved app capabilities, typecheck, tests, and a production build before merging the consumer PRs. Avoid applying a destructive rewrite to consumer main branches before the code is migrated and verified.

## Read-only diagnostics and warned aggressive cleanup

The CLI separates observing problems from applying canonical transformations:

```bash
skipo check .                       # grouped human-readable report, never writes source
skipo check . --json                # structured policy/semantic/constraints/syntax/lint/types report
skipo clean . --plan                # exact prospective create/rewrite/retire file list
skipo clean . --plan --diff         # include readable before/after text diffs
skipo clean .                       # show plan, accept clean/fix/cancel, 60-second deadline
skipo clean . --timeout 120         # change human/agent response window
skipo clean . --on-timeout cancel   # opt out of automatic expiry cleanup
skipo clean . --approve            # explicit immediate execution (still prints preflight)
skipo clean . --json               # machine-readable preflight and result events for agents
```

`check` performs read-only architecture policy, semantic analysis, environmental governance,
the 26-aspect validator, exact canonical shell drift inventory, Python/JavaScript/JSON syntax,
lint, and TypeScript typechecking where tools are configured. It groups each finding with
a rule code, file, severity and suggested repair where available. Missing required analyzers
are marked blocked; nonconfigured checks are marked not-run rather than falsely passed.
Tests and production builds remain separate `skipo test` and project build operations,
since running arbitrary scripts may create artifacts and is not guaranteed read-only.

`clean` uses the canonical Vite shell reconciler, not a new unscoped deletion engine.
Before writing, it **prints every prospective path**, whether it will be created, rewritten
or retired, approximate existing bytes/lines at risk, plus the full impact summary and
managed/protected ownership boundaries. A human or line-oriented agent can enter
`fix` or `cancel` to stop, correct code manually, then rerun `skipo check` and
`skipo clean`. Enter `clean` to apply immediately, or let the configurable timeout
expire (default: clean). `--plan` never starts a timer or modifies the project.
In noninteractive agents, `--json` can be consumed as preflight and result events;
`--on-timeout cancel` disables unattended cleanup.

**Canonical ownership is mandatory, even when the caller requests aggressive cleanup.**
The existing repair engine allows authoritative Skipo-managed frontend/config and defined
backend-adapter rewrites, but does not erase app-specific `src/backend/**` services or
`src/frontend/pages/main/tabs/**` custom features. Symlinks, ambiguous targets and changed
plans fail closed. On failure, the reconciler rolls back affected files; successful cleanup
remains reviewable and revertible in Git. `clean` does not certify unrelated syntax, lint,
dependency or live-integration issues; rerun `check`, `test` and `certify` afterward.

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
