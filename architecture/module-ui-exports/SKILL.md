---
name: skipo-module-ui-exports
description: Canonical host-managed UI contribution contract for generic Skipo modules.
---

# Skipo Module UI Export Contract

## Ownership

A module declares one or more UI exports. Each export contains a stable module-local ID, label, icon/button asset, React surface component, surface type, and optional metadata. The host namespaces IDs as `moduleId:exportId`.

The module owns its component, internal state, and module-specific interactions. The host owns discovery, button placement, surface mounting/unmounting, open/close state, stacking, overlays, focus/lifecycle policy, and global layout.

## Contract

Import the types from `src/frontend/components/module-ui/contract.ts`:

- `SkipoModuleUIContribution`: one module and its exports.
- `ModuleUIExport`: one exported surface.
- `ModuleSurfaceType`: `floating-panel`, `overlay`, `drawer`, or `full-screen`.
- `ModuleSurfaceProps`: host-provided `open` and `onRequestClose`.

A module can export its entire frontend as a single `full-screen` surface. It can also export multiple independent surfaces.

## Discovery and registration

The module loader/host registers a contribution through `registerSkipoModuleUI(contribution)`. Registration validates IDs, labels, icon assets, components, and surface types, then publishes an immutable registry snapshot. The host subscribes to that registry and discovers exports automatically; modules do not render or position host buttons.

Call the returned disposer when the module is unloaded. The host closes and unmounts surfaces whose exports are removed.

## Bottom-right module dock

`ModuleUIHost` renders one icon button per discovered export in the fixed bottom-right module region. The bottom-center inspection channel remains untouched. Selecting a button opens its surface; selecting it again closes it. Multiple surfaces may remain open and are stacked by activation order. Escape closes the most recently opened surface.

## Genericity

This contract contains no application-specific module IDs, labels, icons, routes, or runtime dependencies. It does not implement FOD and does not replace or remove legacy application UI.
