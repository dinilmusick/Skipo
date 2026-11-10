---
name: skipo-module-development
description: Canonical contract for building, discovering, mounting, and testing generic Skipo application modules.
---

# Skipo Module Development

A Skipo module is a complete Skipo application that can execute independently or be hosted by another Skipo application. Module support is generic and must not require a specific downstream application.

## Contract

- Each module publishes a versioned manifest with a stable ID, description, required capability names, and declared UI surfaces.
- The host discovers modules by manifest and rejects duplicate IDs or inconsistent UI declarations.
- The host supplies a parent application context and a BackendFacade boundary when embedded.
- A module may run standalone with its own application context and backend implementation.
- Backend capabilities are discoverable with explicit input and output JSON schemas.
- The host grants capabilities explicitly. Discovery does not imply permission.
- Capability invocation validates input and output schemas and carries module/application identity.
- UI surfaces are declared in the manifest, exported by the module, discovered by the host, and activated through the host's mounted-module handle.
- Lifecycle order is initialize → mount → unmount → dispose.

## Security boundary

Modules must never receive the raw parent BackendFacade. They receive a broker that exposes schema metadata and only invokes capabilities explicitly approved by the host. Unknown and unapproved capabilities fail closed.

## Fixture

The product-neutral fixture at tests/fixtures/generic-skipo-module/ is the reference implementation. It demonstrates standalone and embedded execution, parent context, a mock BackendFacade, schema inspection, capability authorization, three UI surfaces, and lifecycle behavior.

## Scope discipline

Do not use this fixture to introduce Aiko, FOD, SRKL, or product-specific module behavior. Those integrations are separate consumers of the generic module contract.
