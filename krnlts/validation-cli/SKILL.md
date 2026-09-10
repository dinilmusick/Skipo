---
name: krnlts-validation-cli
description: Directives for KrnlTS AST validation engine (krnlts-validate, krnlts-watch), 4-layer purity gates, and line limits.
---

# KRNLTS AST VALIDATION ENGINE (`krnlts-validate`)

## 1. CLI COMMANDS

```bash
npx krnlts-validate   # One-off project gate (Exit code 0 on success)
npx krnlts-watch      # Continuous AST file-watcher daemon
```

## 2. COMPILER GATES & ERROR CODES

| Error Code | Formal Predicate |
| :--- | :--- |
| `[ERR_FILE_LINE_LIMIT_EXCEEDED]` | $\text{Lines}(f) \le 200$ |
| `[ERR_MAIN_DELEGATION_THRESHOLD]` | $\text{Lines}(\text{main\_function/logic.ts}) \le 20$ without helper delegation |
| `[ERR_HELPER_DELEGATION_THRESHOLD]` | $\text{Lines}(\text{helper}) \le 30$ without library concept delegation |
| `[ERR_HELPER_IMPURE]` | $\text{Imports}(\text{helper}) \cap \{\text{state}, \text{I/O}\} = \emptyset$ |
| `[ERR_CONTEXT_SYSTEM_DESTRUCTURING]` | Enforces `({ state, entity })`, bans `{ state, system }` |
| `[ERR_MISSING_JS_EXTENSION]` | NodeNext relative imports require `.js` suffix |
| `[ERR_BOOT_ORDER_VIOLATION]` | $\text{addLocal}(\text{uiSpec}) \prec \text{loadAll}()$ |
