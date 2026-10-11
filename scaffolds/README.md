# Skipo App Scaffolds

Production-ready, zero-boilerplate starter templates designed for instant deployment, AI Studio ingestion, and local development.

---

## Workspace Storage Architectural Models

Skipo explicitly formalizes two distinct workspace storage paradigms based on application runtime I/O requirements:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ARCHITECTURAL SELECTION MATRIX                       │
├───────────────────────────────┬────────────────────────────────────────┤
│ Architecture Model            │ Target Use Cases & I/O Characteristics │
├───────────────────────────────┼────────────────────────────────────────┤
│ 1. Direct-Vault               │ Document managers, knowledge bases,    │
│    (scaffolds/*-direct-vault) │ low-frequency runtime I/O (e.g.        │
│                               │ DocuStack-Engine, Depm-Engine).        │
│                               │ Direct vault operations, zero local    │
│                               │ ./workspace cache folder required.     │
├───────────────────────────────┼────────────────────────────────────────┤
│ 2. Working-Workspace          │ Audio engines, DSP, graph compilers,  │
│    (scaffolds/*-working-ws)   │ high-frequency runtime I/O (e.g.       │
│                               │ Qwnsr-Engine, Loky-Engine).            │
│                               │ Fast local ./workspace working cache   │
│                               │ with timestamped sync to Primary Vault │
│                               │ and secondary backup clone mirroring.  │
└───────────────────────────────┴────────────────────────────────────────┘
```

---

## Available Scaffolds

### 1. Direct-Vault Architecture (Zero-Cache, Direct Storage Engine)
* **`scaffolds/vite-direct-vault/`**: Vite + React 19 + Express + Cloudflare Worker adapter. Direct I/O to Primary Storage Vault (`ultrst_<app>_<user>_<ws>`) or remote B2 bucket with Secondary Redundant Clones.
* **`scaffolds/nextjs-direct-vault/`**: Next.js 15/16 App Router. Direct I/O to storage backends.

### 2. Working-Workspace Architecture (Fast Local Working Directory + Vault Sync)
* **`scaffolds/vite-working-workspace/`**: Vite + React 19 + Express with active `./workspace` working directory, bi-directional timestamp sync (`workspaceSyncEngine.ts`), and redundant clone mirroring (`workspaceCloneSyncCore.ts`).
* **`scaffolds/nextjs-working-workspace/`**: Next.js 15/16 App Router with working workspace cache support.

---

## Shared Foundation in All Scaffolds
1. **Strict Neon System Database Authentication**:
   - Zero offline dummy fallbacks or fake admin accounts.
   - Verification against `ultrst-users` and `ultrst-credentials` using `SYSTEM_DATABASE_URL_1..3`.
2. **SRKL Backblaze B2 Auto-Discovery**:
   - Discovers provisioned Backblaze B2 accounts dynamically from user profiles.
3. **Secondary Redundant Storage Clones**:
   - Support for multiple clone destinations (`backblaze_b2`, `local_fs`) with one-click replication.
4. **Law L9 Compliance**:
   - Every file strictly $\le 200$ lines.
