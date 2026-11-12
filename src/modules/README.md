# Embedded Skipo modules

A Skipo module is a standalone-capable Skipo application declared by
`skipo.module.json`. It is **not** a Floks UI module or a folder of UI
components. Floks may supply UI components inside a module, but Skipo owns
module discovery, manifest validation, capability authorization, backend
adaptation, UI contributions, and lifecycle management.

A single module may combine several related product domains and workflows.
Do not split one cohesive module into separate modules merely because its
features have different historical names or appear on different pages.

The parent Skipo application retains the application shell, including
authentication and workspace selection. Modules receive approved parent
resources through `ModuleRuntimeContext`; they must not replace the parent
login or workspace-selection experience.

Place complete, module-capable Skipo applications in immediate child
directories:

```text
src/modules/<module-directory>/
├── skipo.module.json
├── package.json
└── src/
    ├── frontend/
    ├── backend/
    └── libraries/
```

Each module remains a complete standalone application. See
[the canonical module contract](../../architecture/module-contract/SKILL.md).
This directory is a discovery location, not a module host runtime.
