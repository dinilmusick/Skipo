# Embedded Skipo modules

Complete standalone-capable Skipo applications may be embedded under `src/modules/<module>/` after declaring `application.moduleCapable: true` in `skipo.module.json`. The generic runtime lives in `src/module-runtime/`. Aiko is intentionally absent from this generic infrastructure.
