# Canonical Skipo application architecture

## Owner boundaries

Skipo generates the Vite application shell and maintains its lifecycle.
Floks provides UI components and theme tokens. Kloks provides published
backend capabilities. Krnl provides service definitions and execution
semantics. Luth owns identity and authentication. An application may own
domain behavior, but must not fork the shared framework implementations.

## Frontend

App-specific pages are registered only under
`src/frontend/pages/main/tabs/<tab>/page.tsx`.
Use the CLI page/capability commands and preserve the managed AppShell,
authentication gate, workspace menu and settings pages.

## Backend

`src/backend/AppBackend.ts` is the canonical composition boundary.
App-owned backend services live under `src/backend/services/<service>/`.
The CLI supports deterministic service creation, functionality/helper
scaffolding, explicit binding, repair planning and structural verification.
Functionalities are **not** automatically complete: their body must be
implemented and exercised against a real driver, then independently tested.

## Build and deployment

`src/app.ts` implements one Web Standard Fetch application.
`skipo.providers.json` declares the Node, Vercel and Cloudflare adapters.
Build targets must preserve shared request semantics. Browser/serverless
builds must never import native UDP/Android/iOS discovery code.
Native packaging requires separate platform builds and OS permission checks.

## Verify

Run frozen dependency installation, typecheck, tests, build and applicable
Skipo CLI verification. A missing validator or a failed compliance scorecard
blocks release; no auto-generated success or relaxed lockfile is acceptable.
