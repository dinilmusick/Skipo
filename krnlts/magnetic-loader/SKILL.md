---
name: krnlts-magnetic-loader
description: Directives for KrnlMagneticLoader auto-discovery, subapp execution modes (in-process vs worker), registration contract detection, manifest aggregation, and boot order invariants.
---

# KRNLTS MAGNETIC LOADER & SUBAPP ENGINE

## 1. AUTOMATIC FILESYSTEM DISCOVERY (`KrnlMagneticLoader`)
```typescript
import { KrnlMagneticLoader } from "@dinilmusick/krnl";

// Scans functionalities/, entities/, subapps/ (subapps, sub-apps, src/sub-apps), and protocol_adapters/
await KrnlMagneticLoader.loadAll(rootEntity, projectRoot);
```

### Critical Boot Order Invariant:
```
RULE: ALL manual addLocal() calls with uiSpec MUST occur BEFORE KrnlMagneticLoader.loadAll().
WHY: loadAll() triggers frontend generation and sub-app discovery. Any late addLocal() calls are invisible to UI.
```

---

## 2. SUBAPP ENGINE CONTRACT DISCOVERY
`KrnlMagneticLoader` deterministically inspects candidate directories:
- `subapps/`
- `sub-apps/`
- `src/sub-apps/`

For each sub-app folder:
1. **Manifest Detection**: Parses `subapp.json` (or `package.json` fallback) to extract metadata, dependencies, and UI specs.
2. **Registration Detection**: Resolves `register.ts` / `src/register.ts` / `register.js` exporting `register(context: SubAppRegistrationContext): SubAppRegistration`.
3. **Atomic Projection**:
   - Qualified capabilities: `${SubAppName}.${operationName}`
   - Unqualified aliases: `${operationName}` (if no host collision exists)
   - Route exposure: `POST /call/${SubAppName}.${operationName}` and `POST /${subapp}/${op}`
4. **Git Auto-Cloning**: If `krnl.json` specifies remote git URLs for missing sub-apps, `KrnlMagneticLoader` automatically clones and builds them during boot.

---

## 3. SUBAPP EXECUTION MODES (`krnl.json`)
Subapps configured in `krnl.json` can run in two distinct execution modes:
1. **`in-process` (Local Mode)**:
   - Runs directly in the host Node.js event loop without IPC overhead.
   - Ideal for high-throughput, low-latency domain engines.
2. **`worker` (Worker Thread Mode)**:
   - Spawns in an isolated Node.js worker thread (`K_LIB_Krnl_SubApp_Worker_Host.js`).
   - Fault-isolated: unhandled errors in the subapp worker thread do not crash the host entity.

---

## 4. WORKSPACE MANIFEST AGGREGATION
```typescript
const requirements = rootEntity.getWorkspaceRequirements();
// Yields aggregated npm dependencies, build requirements, and conflicts:
// { dependencies: Record<string, string>, conflicts: Array<{ package, versions }> }
```
If `conflicts.length > 0`, workspace materialization halts to prevent dependency corruption.
