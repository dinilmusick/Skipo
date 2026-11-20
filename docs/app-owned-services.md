# Deterministic app-owned service scaffolding

Skipo **composes** canonical Kloks services; it does not copy their implementation.
Use `skipo add service storage` or `skipo add service midi` for the existing
registered capabilities. The separate `skipo service` command family creates
**application-owned** Krnl service implementations when no canonical equivalent
exists.

## Commands

```sh
skipo service create Weather                   # Generate a new backend service
skipo service new Weather                      # Alias for create
skipo service functionality Weather getForecast
skipo service helper Weather normaliseForecast
skipo service bind Weather                     # Opt in to AppBackend.services
skipo service verify Weather                   # Structural verification
skipo service repair Weather                   # Restore missing managed assets
skipo service repair Weather --plan            # Review exact write-set
skipo service repair Weather --reset           # Backup, then reset edited managed assets
```

Every command accepts an optional final project directory; mutations support
`--plan` (no writes). For example, `skipo service create Weather ./my-app --plan`.
A Skipo application with `package.json` and an existing
`@ultrst-armada/krnl` dependency is required; the CLI never guesses a Krnl
package version or silently edits the lockfile.

## Generated assets

```text
src/backend/services/weather/
  manifest.json
  index.ts
  service.ts
  functionalities/
    index.ts
    getForecast.ts
  helpers/
    index.ts
    normaliseForecast.ts
src/backend/services/__skipo/registry.ts    # Only after explicit bind
.skipo/service-scaffolds.json              # Ownership and drift metadata
```

`service.ts` uses Krnl `createServiceDefinition` / `createService`.
Functionality and helper stubs **throw until implemented**, rather than returning
fake successes. The files for individual functionalities and helpers are
application-owned: users can freely edit them without the generator rewriting
their code. The generated indexes, entrypoint and manifest are Skipo-managed
and may only be refreshed if the recorded checksum matches. `repair --reset`
must be explicitly requested for modified managed files; it stores a
content-addressed backup under `.skipo/service-backups/`.

`bind` updates the standard backend service registry at the canonical
`src/backend/AppBackend.ts` integration point and no other application code.
If that point is missing or ambiguous, the operation fails without touching
user-owned code. It does **not** expose a service as an HTTP route, grant Luth
permissions or register an app's public external capability automatically.
Those actions require explicit authorization and versioned publication.

## Design constraints

- Canonical Kloks services (including auth, storage, workspace, database,
  control-plane and SRKL) cannot be reimplemented through `service create`.
- Service names are alphanumeric TypeScript identifiers; function/helper names
  use lower camel case. Unsafe paths and symlinks inside the project are rejected.
- Repeated commands are idempotent. Plans disclose the write-set before execution.
- Collisions with untracked files and modified Skipo-managed files fail closed.
- `service verify` asserts structural file and binding integrity only. Runtime
  behavior requires separate generated-app typecheck, unit tests, build and
  authenticated service execution tests.
- Authentication shell and workspace-scoped invocation remain owned by the
  canonical Luth/Kloks integration, not generated app-local implementations.
