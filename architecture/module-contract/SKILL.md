---
name: skipo-module-contract
description: Canonical contract for declaring, validating and discovering complete Skipo applications that can also run as embedded modules.
---

# SKIPO MODULE CONTRACT

## Authority and scope
A Skipo module is a **complete Skipo application** with an explicit module-capability declaration. It is not a reduced sub-app, plugin bundle, Aiko integration or FOD feature. The application remains independently executable and can be selected for embedded execution by a future host.

This contract defines metadata, structural validation, discovery and host-neutral lifecycle interfaces only. It does not implement a module host, mount runtime, UI shell, transport protocol or MCP.

## Canonical location
Embedded module candidates live in the immediate child directories of `src/modules/<module-directory>/`. Each candidate has a root `skipo.module.json` manifest. A module may retain a separate source repository and be copied/vendor-mounted into this location; the manifest's `application.root` identifies the complete application root relative to the module directory.

A module application root must retain `package.json` and complete `src/frontend/`, `src/backend/` and `src/libraries/` planes. It may contain all other standard Skipo application planes and tests.

## Manifest
The contract v1 manifest is `skipo.module.json`. The canonical JSON Schema is exported as `SKIPO_MODULE_MANIFEST_SCHEMA` from `src/module-contract/ModuleManifestSchema.ts`.

Required declarations:
- `contractVersion`: contract compatibility version.
- `module.id/name/version`: stable identity and semantic version.
- `application`: framework, root, standalone capability, module-capable declaration and supported execution modes.
- `api`: module API base route and backend-facade entry plus consumed parent-facade namespaces/resources.
- `capabilities`: stable capability IDs and descriptions.
- `runtime`: execution targets and runtime requirements.
- `resources.requires/optional`: parent-provided resources, with explicit requiredness.
- `ui.exports`: named UI entry points and export kinds.
- `lifecycle.supported`: lifecycle phases implemented by the module.

The module is module-capable only when `application.moduleCapable` is true. `application.standalone` must remain true. `execution` declares whether standalone, embedded or both modes are supported; it does not itself start either mode.

## Backend facade boundary
The module declares its own backend facade entry and the parent resources/namespaces it consumes. The host-facing interface is descriptive: no host implementation is assumed. Modules must not reach into host-private backend internals or assume a specific parent database, auth provider or storage adapter.

## UI boundary
UI exports are explicit, stable IDs pointing to application-owned frontend entry files. Discovery validates references but does not import or execute UI code. A future host may choose how to mount these exports.

## Lifecycle
The framework defines host-neutral lifecycle context and optional hooks for validate, initialize, start, stop and dispose. The manifest advertises supported phases. The contract layer does not invoke hooks; that belongs to a future runtime.

## Discovery and validation
`discoverModules(src/modules)` scans immediate child directories, parses each manifest, validates metadata and complete application structure, checks declared entry paths, and detects duplicate module IDs. Discovery never imports module code. Invalid candidates are returned as structured errors rather than silently ignored.

## Invariants
1. A module remains a complete standalone Skipo application.
2. Module identity is independent of the existing application-composition descriptor.
3. The module contract is independent of Aiko, FOD, MCP and legacy sub-app contracts.
4. `src/modules/` is the only canonical embedded-module discovery root.
5. Module declarations are data; validation/discovery never execute candidate code.
