# Skipo Vite application scaffold guide

## Scope

This guide describes the **actual generated application**, not optional
libraries that might be installed later. The [Canonical Application Contract](./README.md)
and [SKILL.md](./SKILL.md) are the authoritative entrypoints.

## Ownership and integration

| Capability | Canonical owner | Application interaction |
| --- | --- | --- |
| Authentication, sessions and consent | Luth through Kloks and Floks | Configure approved client and callback; never mint app-local sessions |
| UI primitives, layout and theme tokens | Floks | Import published components and consume CSS variables |
| Shared backend services and execution boundaries | Kloks / Krnl | Import existing exported services and bind through canonical application backend |
| App-specific backend behavior | Application | Use `skipo service create`, `functionality`, `helper`, `bind`, `repair`, and `verify` |
| Main-page tabs | Application | Put each tab under `src/frontend/pages/main/tabs/`; leave global shell Skipo-managed |
| Provider deployment adapters | Skipo | Build the shared Fetch app and declared provider outputs |

## CLI workflow

```sh
skipo inspect .
skipo plan .
skipo verify .
skipo service create Weather
skipo service functionality Weather getForecast
skipo service helper Weather normalizeForecast
skipo service bind Weather
skipo service repair Weather --plan
skipo service verify Weather
```

These service commands scaffold and connect app-owned code; they **do not**
create an implementation of an already published Kloks service and they
do not invent business functionality. The app author still implements
domain behavior in the generated functionality and helper files.

## Existing source map

- `src/app.ts`: canonical Web Standard Fetch handler.
- `src/backend/AppBackend.ts`: backend service composition.
- `src/frontend/pages/main/`: Skipo-managed application main shell.
- `src/frontend/pages/main/tabs/`: app-owned UI extension.
- `src/frontend/pages/settings/`: managed settings shell.
- `src/libraries/client/`: generated client boundary.
- `src/index.css`: Floks theme-token consumer.
- `skipo.providers.json`: supported target adapters and output paths.

## Verification

Run `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run test`,
and `pnpm run build`. Treat `pnpm run validate` as a separate mandatory
architecture gate; standalone packaged-app validation is not certified
until the Skipo validator is available and the complete scorecard passes.

Never claim a working authenticated deployment from a successful build.
Two-user workspace isolation, registered redirects, revocation and
provider configuration require independent runtime verification.

## Boundaries

Do not add a second authentication authority, copy Kloks sources,
modify the generated shell to add feature pages, or persist raw secrets.
Application-specific frontend code belongs in main-page tab modules.
Repairs must preserve owned tabs and backend services byte-for-byte.
