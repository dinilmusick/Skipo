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

## Canonical application identity and enrollment

Skipo application identity is a durable reference to the **existing Neon app registry**.
An application name or `APP_URL` is never an enrollment certificate or identity generator.
The CLI records `app_id: null`, `app_identity_version: 1`, and
`registration_status: enrollment_required` in newly generated
`.skipo/project.json`. The `app_id` must be registered by the authorized
ecosystem registrar before applications use cross-app discovery or invocation;
this command does not create Neon records or assert deployment ownership.

```bash
skipo create my-app
skipo identity my-app          # shows enrollment_required, no forged app ID
skipo inspect my-app           # includes explicit app_identity status
skipo repair my-app            # preserves app_id
skipo update my-app            # preserves app_id
skipo verify my-app            # unresolved until identity authority is confirmed
skipo certify my-app           # cannot claim verified enrollment offline
```

Once a registrar has approved an immutable `app_id`, that value belongs in
the project's manifest and cannot be inferred from the deployment URL.
`deployment_id` and `oauth_client_id` are separate optional references.
Changes to `APP_URL` and repeated repairs do not modify `app_id`.
A local `registration_status: verified` string **does not establish trust**.
Live authority and deployment-control verification are provided by the
separate Luth/Neon enrollment stage, not by Skipo CLI or static certification.

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
