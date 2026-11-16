# Skipo Capability Composition

Capabilities are the application composition unit. Skipo does not use modules as an application architecture primitive.

## Model

```
Capability Registry
  -> Resolver
  -> Composer
  -> Application
  -> Verifier
       ^       |
       |       v
   Drift Detector
       ^
       |
    Repair/Migrate
```

A capability declares the canonical provider packages, public symbols, generated wiring surfaces, duplicate-implementation patterns, and verification requirements.

Skipo never copies Floks or Kloks implementation code into an application. It installs the canonical dependency and generates only thin application-owned wiring/adapters.

## Commands

```bash
skipo adopt .
skipo inspect .
skipo diagnose .
skipo plan .
skipo add auth
skipo add workspace
skipo add service storage
skipo add service midi
skipo add ui settings
skipo remove capability-name
skipo sync .
skipo update .
skipo repair .
skipo verify .
skipo test .
```

All composition operations are idempotent. `plan` is read-only. `diagnose` classifies findings as keep, adapt or retire. `repair` applies the same composition engine used by `add`.

## Canonical ownership

- Floks owns reusable UI implementations.
- Kloks owns reusable backend services.
- Luth remains the authentication authority.
- Skipo owns application composition, contracts, generated wiring, migration state and verification.
- ATAX owns agent coordination and persistent work state; Skipo does not manage agents.

## Application state

Every adopted application gets:

```text
.skipo/
  project.json
  dependencies.json
  capabilities.json
  overrides.json
  migration-state.json
```

Generated files are recorded with their owner and capability. Local implementations of canonical capabilities are drift, not a second source of truth.

## Safety

Repair never deletes arbitrary application code. A duplicate is retired only when a capability registry entry explicitly identifies the file/pattern as safe to replace. Unknown or app-specific code is classified as `keep` or `adapt`.
