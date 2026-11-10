# Generic Skipo Module Fixture

This directory is a small, product-neutral Skipo application used to exercise the module contract. It is independent of Aiko, FOD, and SRKL.

## Standalone execution

The standalone entrypoint is standalone.ts. It creates its own mock backend, application context, and host, discovers and mounts the module, then activates its overview surface. It does not require a parent application.

## Embedded execution

Tests mount the same application module into a parent host context. The parent supplies application/workspace/user context, a BackendFacade, and explicit capability grants.

## Backend capability contract

The mock backend exposes three capabilities:

- inventory.list — approved; demonstrates input/output schema inspection and invocation.
- inventory.reserve — approved; demonstrates a second representative operation.
- billing.refund — discoverable but not approved; invocation must be rejected.

The broker validates inputs before dispatch and validates backend outputs before returning them to the module.

## UI contract

The module declares and exports three independently activatable surfaces: Overview, Activity, and Settings.

## Lifecycle

The host drives initialize → mount → unmount → dispose. The same fixture supports standalone and embedded modes.
