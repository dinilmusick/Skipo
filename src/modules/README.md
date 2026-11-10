# Embedded Skipo modules

Place complete, module-capable Skipo applications in immediate child directories:

```text
src/modules/<module-directory>/
├── skipo.module.json
├── package.json
└── src/
    ├── frontend/
    ├── backend/
    └── libraries/
```

Each module remains a complete standalone application. See [the canonical module contract](../../architecture/module-contract/SKILL.md). This directory is a discovery location, not a module host runtime.
