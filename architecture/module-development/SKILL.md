---
name: skipo-module-development
description: Generic rules for building a complete Skipo application that can later run standalone or as an embedded module.
---

# Generic Skipo Module Development

A module is a complete Skipo application, not a reduced plugin.

## Required structure

- Embedded location: `src/modules/<module-id>/`
- Root manifest: `skipo.module.json`
- `application.standalone` remains true.
- `application.moduleCapable` is true.
- The manifest declares capabilities, resources, UI exports and lifecycle support.
- The module owns its implementation and may provide a module-specific backend adapter.
- Parent access is only through the host context and capability-controlled ModuleBackendAdapter.

## Backend boundary

`Parent BackendFacade → ModuleBackendAdapter → module-specific representation`.

The adapter never exposes service implementations, libraries, or the raw parent facade. Capability discovery and invocation are default-deny and authorization is checked at invocation time.

## UI boundary

`Module → host-owned UI registry → parent bottom bar → module UI surface`.

The parent owns registration lifetime, opening/closing, focus management, and surface mounting. The module owns the React surface implementation.

## External interfaces

Every Skipo application exposes the canonical backend capability layer through both HTTPS and MCP. Neither protocol may implement business logic independently.

## Aiko exclusion

Aiko is not part of this generic layer. No Aiko module, FOD mapping, Aiko UI export, or Aiko-specific backend representation belongs here.
