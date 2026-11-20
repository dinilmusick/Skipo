# MyApp — Canonical Application Contract

This is a generated Skipo Vite application. Skipo owns the application shell and lifecycle,
Kloks owns published backend service implementations, Floks owns shared UI components,
and Luth owns authentication authority. No application-local authentication authority
should be created. OAuth client enrolment and a working remote deployment are **not**
established merely by generating this app.

## Authoritative project references

- [SKILL.md](./SKILL.md) — instructions for agents and CLI-managed changes
- [SCAFFOLD_GUIDE.md](./SCAFFOLD_GUIDE.md) — verified project layout and development process
- [architecture/app-architecture/SKILL.md](./architecture/app-architecture/SKILL.md) — application-owned code boundaries
- [architecture/workspace-architectures/SKILL.md](./architecture/workspace-architectures/SKILL.md) — principal/workspace isolation

## Standard development lifecycle

Use the installed Skipo CLI to create a new project rather than running a
nonexistent copy of a source-checkout rename script:

```sh
skipo create MyApp ./my-app
cd my-app
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
```

Once created, use `skipo plan .`, `skipo inspect .`, `skipo verify .`, and
`skipo update .` for deterministic project inspection and reconciliation.
Do not overwrite an existing project with `skipo create --force`.

## Where changes belong

- **Application frontend:** `src/frontend/pages/main/tabs/<tab>/page.tsx`
  and its local supporting files. Skipo retains the login, workspace, settings
  and main-page shell.
- **Application backend:** `src/backend/services/` for app-owned domain behavior.
  Use `skipo service create Weather`, `skipo service functionality Weather getForecast`,
  `skipo service helper Weather normalizeForecast`, and `skipo service bind Weather`.
  New functionality/helper bodies deliberately throw until implemented.
- **Shared backend services:** Import a published Kloks export; do not copy its
  code or generate another implementation with the same authority.
- **Deployment:** `src/app.ts` is the canonical Fetch entrypoint. The
  provider outputs are declared in `skipo.providers.json`.
- **Theme:** Consume the `--skipo-*` design tokens from Floks. Do not override
  the canonical palette with hardcoded colour literals.

## Authentication and validation boundaries

The frontend consumes Floks authentication UI and the backend delegates to
Kloks/Luth. A real login depends on trusted OAuth client registration,
deployment secrets, callback verification, live sessions and workspace scope.
Do not substitute local password/session code when any external authority is
not provisioned.

The `validate` and `validate:strict` package scripts require the canonical
Skipo checklist engine. Standalone installed-app validation is still a
separate release gate; a missing validator or failed check is not success.

Never put secrets, tokens, or local user records in generated source files.
Always preserve application-owned tabs and backend behavior during repairs.
