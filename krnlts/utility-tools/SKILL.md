---
name: krnlts-utility-tools
description: Directives for KrnlTS utility tools suite: KrnlFS, KrnlEnv, KrnlShell, AsyncKit, ObjectKit, and CacheKit.
---

# KRNLTS UTILITY TOOLS SUITE (`@dinilmusick/krnlts`)

$$\forall \text{op} \in \{\text{FS}, \text{Lock}, \text{Env}, \text{TTL}, \text{pLimit}\}: \text{Use}(\text{@dinilmusick/krnlts}) \wedge \text{AdHocNPM} = \emptyset$$

## 1. TOOLKIT MATRIX

| Tool | Core Method | Invariant Behavior |
| :--- | :--- | :--- |
| `KrnlFS` | `writeJsonAtomic(path, val)` | Atomic write via temp file rename + mutex file locks |
| `KrnlEnv` | `loadAndValidate(zodSchema)` | Strictly typed env parsing with Zod coercion |
| `AsyncKit` | `pLimit(n)`, `timeout(p, ms)` | Concurrency throttling & deterministic timeouts |
| `ObjectKit` | `deepClone(obj)` | Structured clone with cycle support |
| `CacheKit` | `createTTL(ms)` | In-memory key-value cache with background eviction |

```typescript
import { KrnlFS, KrnlEnv, AsyncKit, CacheKit } from "@dinilmusick/krnlts";
const release = await KrnlFS.acquireFileLock("db.json");
try { await KrnlFS.writeJsonAtomic("db.json", payload); } finally { await release(); }
```
