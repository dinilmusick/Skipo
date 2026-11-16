# Skipo maintenance contract

## Purpose and ownership

Skipo is an installed application framework, not a one-time scaffold generator. Every adopted or generated Skipo application carries a local framework manifest and state directory. The installed Skipo CLI is the operator for inspecting, reconciling and validating that state.

Skipo owns framework composition and application wiring. Canonical provider packages remain the implementation owners for their services and UI capabilities. Applications may own application-specific behavior, but they must not fork or replace canonical framework infrastructure. Unknown or application-owned state is preserved and reported rather than destructively rewritten.

Skipo maintains application-side framework state under `.skipo/`:

| File | Responsibility |
|---|---|
| `.skipo/project.json` | Framework identity, installed framework version and migration metadata |
| `.skipo/dependencies.json` | Tracked ecosystem package versions |
| `.skipo/capabilities.json` | Installed capabilities and Skipo-generated file ownership/checksums |
| `.skipo/overrides.json` | Explicit capability overrides |
| `.skipo/migration-state.json` | Applied and pending migration identifiers |

The versioned canonical application-state registry is `architecture/capabilities/registry.json`. Its schema, version and required state sections are validated before capability resolution. The registry is the source of canonical framework capability metadata; the per-application `.skipo/` files record the application's local state.

## Deterministic maintenance lifecycle

The maintenance lifecycle is an ordered operating model. Each command is independently invocable; the CLI does not currently expose one command that runs the entire sequence as a transaction.

```text
inspect
  ↓
diagnose
  ↓
plan
  ↓
update
  ↓
repair
  ↓
sync
  ↓
verify
```

| Stage | Command | Contract |
|---|---|---|
| Inspect | `skipo inspect [target]` | Read the project manifest and capability state. It is an informational snapshot, not a drift repair. |
| Diagnose | `skipo diagnose [target]` | Scan application source for registry-declared patterns and classify findings as `keep`, `adapt` or `retire`. A pattern match alone is not proof that application code is a duplicate. |
| Plan | `skipo plan [target]` | Produce findings and safe retirement actions without applying them. |
| Update | `skipo update [target]` | Update the local Skipo project manifest to the version of the installed CLI and apply the currently implemented legacy capability-composition migration when applicable. |
| Repair | `skipo repair [target]` | Apply update, retire only registry-approved safe paths, and recompose the capabilities selected from diagnosis. `skipo repair --plan` reports the planned operation without applying it. |
| Sync | `skipo sync [target]` | Recompose the capabilities already recorded as installed. Use `--install` to run the detected package manager after composition. |
| Verify | `skipo verify [target]` | Gate capability-state cleanliness by checking installed capability validity, generated-file presence and checksums, and remaining legacy paths. |

The lifecycle is deterministic in ordering and decision inputs. Repeated composition and synchronization should converge on the same registry-derived wiring. Repair is conservative: it must not overwrite modified application-owned generated files, and it must not delete paths unless the registry explicitly declares them safe to retire.

### Related validation commands

- `skipo check [target]` invokes the full-system validator. It is broader than the capability-state checks performed by `skipo verify`.
- `skipo test [target]` runs the target application's available `typecheck`, `lint`, `test` and `build` scripts, then runs `skipo verify`.
- `skipo update` and `skipo repair` invoke verification before reporting successful completion through their CLI handlers (repair verifies after an applied repair).

A successful `verify` is not a substitute for the application's test, typecheck, build, deployment or external integration checks.

## Update and migration boundary

The installed framework CLI is the entry point for `skipo update`. The current implementation updates application-side Skipo metadata and migration state. It does **not** download or install a newer Skipo npm package; upgrading the installed CLI package remains the responsibility of the application's package manager or its dependency-update workflow.

The migration registry is `architecture/capabilities/migrations.json`; application progress is recorded in `.skipo/migration-state.json`. At present, the update executor recognizes the single migration identifier `1.1.0-capability-composition` and its declared retirement paths. The presence of additional migration metadata in the registry must not be interpreted as proof that a generic migration executor exists.

### Canonical dependency migration extension point

Future upstream dependency migrations must be expressed as versioned, declarative contracts, rather than application-specific scripts or duplicated downstream implementations. A contract should identify, at minimum:

- a stable migration identifier and schema/version;
- the canonical source dependency and target version/contract;
- applicable preconditions and supported source states;
- deterministic, ordered migration actions;
- ownership boundaries and explicit safe-to-change paths;
- unknown-state and conflict behavior (preserve and report by default);
- postconditions and machine-verifiable acceptance checks;
- an idempotency rule and recorded applied state.

The registry and migration-state file are the intended Skipo-owned extension points. The generic dependency-contract consumer, dependency-specific migration planning, and full migration validation are **not yet implemented**. Until they are implemented and tested, Skipo must not claim that it can automatically interpret arbitrary upstream dependency migration contracts.

## Environment contract

Skipo's standard application environment contract uses these names:

| Variable | Contract |
|---|---|
| `SYSTEM_DATABASE_URL` | Primary system database connection |
| `SYSTEM_DATABASE_URL_2` | Optional additional system database connection slot |
| `SYSTEM_DATABASE_URL_3` | Optional additional system database connection slot |
| `APP_URL` | Canonical application URL |

Values and credentials belong in the application's deployment environment or secret store, not in source control. Scaffold examples may leave secondary database slots unset. Runtime/tooling variables and explicitly governed exceptions are separate from these four standard application contract names; their presence does not change the canonical names above.

## Framework and dependency boundaries

- Skipo is installed in each Skipo application and maintains that application's Skipo-specific state.
- Canonical service and UI implementations remain in their owning provider packages; Skipo composes application wiring and records ownership.
- Skipo may consume versioned canonical dependency contracts through a future generic migration interface, but it must not embed downstream-application identities or downstream-specific repair logic in the framework registry.
- Downstream applications consume canonical framework and provider packages. They must not independently reimplement Skipo's registry, capability composition, migration-state, or verification infrastructure.
- Application-owned code and unknown state remain application-owned. Conflicts must be surfaced for review, not silently overwritten.

## Acceptance criteria for maintenance changes

A maintenance change is complete only when:

1. The documented behavior matches the actual CLI dispatch and implementation.
2. Registry inputs and generated output ordering are deterministic.
3. Re-running an already-applied operation does not introduce additional changes.
4. Unknown or application-owned state is preserved and reported.
5. Destructive retirement is limited to explicitly declared safe paths.
6. Migration state is persisted and can be independently verified.
7. `skipo verify` passes for the resulting capability state.
8. Relevant repository tests and GitHub Actions checks pass.
9. No downstream repository or downstream-specific application implementation is modified as part of a Skipo-only maintenance change.

This document defines the current maintenance contract and explicitly labels extension points that are not yet executable. When implementation changes, update this contract and its regression tests in the same Skipo change.
