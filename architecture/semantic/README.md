# Standalone semantic architecture analyser (v1)

This analyser is an independent, **read-only** TypeScript compiler API consumer. It does not invoke Skipo's CLI, repair engine, capabilities registry, or ATAX. The files in `scripts/skipo_semantic_*` own its implementation; `owners.json` describes canonical ownership and narrow import allowances. There is **no automatic mutation**.

## Interface

```bash
node scripts/skipo_semantic_analyzer.cjs --root /path/to/app --json
node --test tests/semantic_architecture_analyzer.test.cjs
```

From CommonJS code, call `const { analyzeProject } = require('./scripts/skipo_semantic_analyzer.cjs')`, then `analyzeProject(absoluteOrRelativeRoot, { policyPath?: string, includeTests?: boolean })`. Returns a pure JSON-compatible object with `schemaVersion: 1`, `status`, `scannedFiles`, `dependencies`, `findings` and `summary`. Findings have stable `ruleId`, `severity`, `certainty`, `file`, 1-based `line` and `column`, structured `evidence`, and `suggestedReplacement`. Paths are relative to the scanned root. No timestamps or absolute filesystem paths appear in normal reports; findings and dependencies are sorted deterministically. A found violation yields CLI exit code **1**; compliant or ambiguity-only yields **0**; malformed policies, parse failures, or missing compiler yield **2** (fail closed).

## Rules

| ID | Meaning | Certainty |
| --- | --- | --- |
| SEM000 | Invalid configuration, unavailable parser or blocked scan | blocked |
| SEM101 | Forbidden direct dependency direction | violation |
| SEM102 | Frontend/shared code importing server-only dependencies | violation |
| SEM103 | Cross-package relative import | violation |
| SEM104 | Private canonical provider import | violation |
| SEM105 | Direct raw-provider SDK use with convincing duplicate capability signals | violation |
| SEM106 | Suspicious local capability implementation without sufficient proof | ambiguous |
| SEM107 | Dynamically computed import that cannot be resolved statically | ambiguous |
| SEM108 | Missing relative import target | ambiguous |
| SEM109 | Indirect dependency on a backend module or server-only provider | violation |

The compiler resolves aliases through the nearest `tsconfig.json`, ES and CommonJS imports, re-exports, static `require()`, literal `import()`, and extension rewrites for TypeScript source. Cyclic dependency traversals are bounded. A public `src/backend/index.ts` is an intentional Skipo facade exception; a normal frontend-to-internal-backend import is not. `@ultrst-armada/kloks/auth` and `@dinilmusick/gutts/browser` are browser-safe provider entrypoints, unlike the package-root Kloks server interface.

`SEM105` requires a direct external SDK and supporting structural evidence. A module that delegates through an official Kloks/Floks entrypoint is an app-specific extension and is not flagged solely for naming collisions. Static evidence that might be a replacement is instead labeled `SEM106`; reviewers must resolve these cases. An unresolved import is not automatically deleted or rewritten.

## Limitations and reconciliation contract

Static analysis cannot prove runtime loading paths in computed `import()` calls, dynamic dependency injection, or whether an ambiguous user-defined feature semantically replaces a canonical provider. Package public exports are conservatively checked for unmistakable private path segments, not assumed from arbitrary naming conventions. The JSON report is a diagnostic input for a **later, separate** integration/reconciliation PR; this tool does not change source code, policy-engine files, or CI configuration.

For new capabilities, update the versioned `owners.json` with canonical packages and evidence signatures, and add both legitimate-extension and adversarial fixtures. Changing published rule semantics or JSON shape requires a version bump. Root dependencies are unchanged because Skipo already declares `typescript` as a development dependency.
