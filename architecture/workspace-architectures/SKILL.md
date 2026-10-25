---
name: workspace-architectures
description: Architecture specification for Direct-Vault vs Working-Workspace paradigms with secondary redundant backup clones.
---

# Workspace Storage Architectures & Redundant Clones

This specification establishes the unified workspace storage architecture defined under Skipo Law $L_{27}$. Every Skipo app uses the same active local workspace model; provider choice changes persistence only.

$$\text{Workspace}(\mathcal{W}) \implies \left(\mathcal{W}_{\text{DirectVault}} \vee \mathcal{W}_{\text{WorkingWorkspace}}\right) \wedge \mathcal{W}_{\text{RedundantClones}} \subseteq \text{Replication}$$

---

## 1. Unified Workspace Architecture

### Characteristics
- Every Skipo app uses a persistent selectable workspace plus an active local working representation.
- The workspace filesystem is the canonical project data model. No second workspace manifest is required.
- The active representation is materialized per workspace and selected through the mandatory Workspaces menu.
- Browser clients should use OPFS; native clients may use the host filesystem. WebContainers may consume the active workspace but do not define the workspace abstraction.
- Persistence providers are adapters. The initial supported persistent providers are Backblaze B2 and Google Drive.
- Workspace synchronization uses filesystem metadata (mtime/size) as the cheap change test and content hashes only when verification is required.
- Large binary assets are hydrated lazily; opening or switching workspaces does not require downloading the entire workspace.

### Workspace lifecycle

select workspace
      ↓
open active local workspace
      ↓
hydrate required files
      ↓
READY
      ↓
local reads/writes
      ↓
periodic autosave + important lifecycle events + manual Save
      ↓
persistent storage reconciliation

## 2. Persistent Storage

- **Backblaze B2**: existing bucket-backed persistence.
- **Google Drive**: user OAuth connection and selected Drive folder.
- Provider-specific credentials and APIs stay behind the workspace storage adapter.
- Applications never read/write the provider directly.
- Amazon S3 is not a selectable Skipo workspace provider.


