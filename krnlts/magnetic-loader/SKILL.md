---
name: krnlts-magnetic-loader
description: Directives for KrnlMagneticLoader auto-discovery, subapp execution modes, manifest aggregation, and boot order invariants.
---

# KRNLTS MAGNETIC LOADER & SUBAPP ENGINE

## 1. AUTO-DISCOVERY & BOOT INVARIANTS

$$\begin{array}{ll}
\mathbf{M_1} \text{ (Boot Order)} & \text{ManualAddLocal}(\text{uiSpec}) \prec \text{KrnlMagneticLoader.loadAll}(e, \text{url}) \\
\mathbf{M_2} \text{ (Flat Discovery)} & \text{DiscoveryPath} = \text{src/functionalities/} \cup \text{src/subapps/} \cup \text{protocol\_adapters/} \\
\mathbf{M_3} \text{ (Registry Binding)} & \forall e \in \text{Entities}: \text{loadAll}(e) \implies \text{KrnlEntityRegistry.register}(e)
\end{array}$$

## 2. SUBAPP CONTRACT & EXECUTION MODES

$$\text{SubAppContract}(s) = \{ \text{subapp.json}, \text{register.ts} \xrightarrow{\text{export}} \text{register}(\text{ctx}) \}$$

| Execution Mode | Isolation | Transport | Use Case |
| :--- | :--- | :--- | :--- |
| **`in-process`** | Host Event Loop | Direct invocation (0 overhead) | High-throughput domain engines |
| **`worker`** | Node.js Worker Thread | Thread IPC (`Worker_Host.js`) | Untrusted or CPU-heavy workloads |

- **Endpoints Exposed**: `POST /call/${SubApp}.${op}` and `POST /${subapp}/${op}`
- **Dependency Conflicts**: If `getWorkspaceRequirements().conflicts.length > 0` $\implies$ **HALT**
