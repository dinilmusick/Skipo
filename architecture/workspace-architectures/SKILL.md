---
name: workspace-architectures
description: Architecture specification for Direct-Vault vs Working-Workspace paradigms with secondary redundant backup clones.
---

# Workspace Storage Architectures & Redundant Clones

This specification establishes the dual workspace storage architecture defined under Skipo Law $L_{27}$.

$$\text{Workspace}(\mathcal{W}) \implies \left(\mathcal{W}_{\text{DirectVault}} \vee \mathcal{W}_{\text{WorkingWorkspace}}\right) \wedge \mathcal{W}_{\text{RedundantClones}} \subseteq \text{Replication}$$

---

## 1. Direct-Vault Architecture (`direct-vault`)

### Characteristics
- Designed for document managers, knowledge bases, or low-frequency runtime I/O (e.g., `DocuStack-Engine`, `Depm-Engine`).
- **No local working directory (`./workspace`)** is needed or instantiated.
- Reads and writes communicate directly with the Primary Storage Vault:
  - Remote Backblaze B2 bucket (`ultrst-apps` or custom bucket).
  - Local non-working storage vault (`ultrst_<app>_<user>_<ws>`).
- Secondary redundant clones mirror the primary vault on-write or on-demand.

---

## 2. Working-Workspace Architecture (`working-workspace`)

### Characteristics
- Designed for audio DSP engines, graph compilers, and high-frequency real-time I/O (e.g., `Qwnsr-Engine`, `Loky-Engine`).
- Operates on a dedicated, high-speed **local working workspace** (`./workspace` or custom working path).
- **Bidirectional Timestamp Synchronization**:
  - Compares local file modification times (`mtime`) against primary vault storage (Backblaze B2 or local non-working storage vault).
  - Newer local changes are uploaded to the primary vault; newer remote files are downloaded.
- **Secondary Redundant Storage Clones**:
  - Replicate from the Primary Storage Vault to all configured secondary clones (`WorkspaceSecondaryClone[]`) with single-click manual sync or auto-sync.
