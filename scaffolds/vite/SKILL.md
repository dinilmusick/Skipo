# Skipo generated application skill

## Canonical Application Contract

Read [README.md](./README.md) and
[architecture/app-architecture/SKILL.md](./architecture/app-architecture/SKILL.md)
before modifying an application. For user identity and workspace scope, read
[architecture/workspace-architectures/SKILL.md](./architecture/workspace-architectures/SKILL.md).

## Inspect before mutation

Run `skipo inspect .` and `skipo plan .` to identify the app and its managed
assets. Prefer existing framework CLI actions to ad hoc source changes.
Do not assume successful authentication, service deployment, or migration
merely from the presence of generated TypeScript files.

## Code ownership

- Frontend application features: `src/frontend/pages/main/tabs/**`.
- Application backend service: `skipo service create <Name>` and explicitly
  bind it; use commands to add a functionality or helper.
- Shared features: consume exported Kloks/Floks packages, never duplicate them.
- Framework shell, login and workspace selection: keep Skipo-managed.

## Safety

Use `skipo service repair <Name> --plan` before a repair; modified managed
assets require explicit backup/reset. Never overwrite user-owned functions
or tabs. Never bypass typed validation, Luth authorization, workspace grants,
or the failed installed-application release gate.

## BLOCKING VERIFICATION GATE

Before release or publication, the application must pass frozen dependency
installation, typechecking, executable tests, provider builds and the full
canonical Skipo validation scorecard. A missing checklist engine or a failed
applicable aspect is blocking—not permission to relax the gate or report
success. Running `skipo verify .` tests managed structure and never replaces
live, authorized cross-user OAuth and workspace testing.
