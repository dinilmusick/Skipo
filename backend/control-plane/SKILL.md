---
name: backend-control-plane
description: Control Plane directives: User Accounts, Authentication, Workspace Registry, Admin Control, Multi-Database Redundancy Clusters, Vercel .env Blueprint Generator, Failover, Immutable Audit Logging, and RBAC enforcement with drop-in TypeScript & React code templates.
---

# CONTROL PLANE — APPLICATION IDENTITY, CLUSTERING & GOVERNANCE

The Control Plane is the application-owned, globally scoped governance system. It strictly manages *who* uses the application, *what* they are permitted to do (RBAC), *which* backend connections their workspaces attach to, and *how* high-availability database redundancy clusters fail over.

---

## 1. Core Responsibilities & Boundary Invariant

$$\text{Control Plane} \cap \text{Workspace Data Plane} = \emptyset$$

```
CONTROL PLANE (Application-Owned)
│
├── User Accounts & Universal Identities (`app_profiles` JSONB)
├── Authentication & Session Crypto (`sess::<userId>::<timestamp>::<random>`)
├── RFC 5322 Regex Email Format Validation
├── Multi-Backend Redundancy Clusters (Primary + Redundant Clones + Read Replicas)
│     ├── Neon Serverless Postgres (Direct connectionless HTTP via @neondatabase/serverless)
│     ├── Supabase BaaS (REST /rest/v1 with merge-duplicates)
│     ├── Firebase Cloud Firestore (REST API v1)
│     └── PostgreSQL Standard (SQL)
├── Dynamic Vercel `.env` Blueprint Drawer (1-Click Copy Value / Copy All)
├── Visual Status Badges: 🟢 .ENV PERSISTENT vs ⚡ RUNTIME (GET .ENV)
├── Real-Time Connection Latency Testing & Live Credential Probing
├── Dynamic Primary Promotion & Automatic Failover
├── In-Memory & Edge Rate Limiting (25 login attempts / 15m / IP)
└── Immutable Audit Logging (AuditLogger trails with JSON/CSV export)
```

> [!IMPORTANT]
> **Cardinal Invariants**:
> 1. **Data Isolation**: The Control Plane **never** contains project documents, database records of a workspace, or user media files ($\text{Control Plane} \cap \text{Data Plane} = \emptyset$).
> 2. **Zero-Divergence Environment Parity & Zero Redundant Local Storing**:
>    - Environment variables (`.env.local` in local development, or Vercel Environment Variables in cloud) are the **sole authoritative source of truth** for system backend database credentials (`NEON_DATABASE_URL`, `SUPABASE_URL`, `POSTGRES_DATABASE_URL`).
>    - **NO local-only SQLite (`accounts.sqlite`) or ephemeral `/tmp` file fallbacks for user accounts**. Never branch on `if (isVercel)` to create a local SQLite database that fakes working state locally while failing in cloud serverless environments.
>    - If no database is configured in `.env`, both local dev and production report the exact same standby state: `System Backend Database (Awaiting .env)` with instructions to provide `.env.local` or hosting variables.
>    - Registration and authentication strictly require and verify against the configured database, eliminating phantom local accounts and guaranteeing 100% parity across local and hosted environments.
> 3. **Admin UI Isolation & Back-Navigation Guard**:
>    - The Admin Control Plane (`/admin`) is an isolated governance portal.
>    - **NEVER** place a "Return to Workspace" back button (`<Link href="/" />`) with a back arrow (`<ArrowLeft />`) in the Admin UI header. Clicking back from the Admin UI must return to the **Admin Login Portal** (`/admin/login`) or trigger a session sign-out, NEVER plunge the administrator into a workspace window (`/`).
>    - **Route Protection on Root (`/`)**: If an authenticated administrator (`role === 'admin'`) arrives at `/` (e.g. via browser history or back button), the system must immediately redirect them to `/admin` to keep them inside the Admin Control Plane rather than dumping them into an unconfigured or empty workspace window.
> 4. **Strict Zero-Demo Accounts Mandate**:
>    - **ZERO hardcoded demo accounts** (`demo@...`, `admin@docustack.vault`, `alex@...`, `sam@...`, etc.) in production code, default seed arrays, or UI auto-fill buttons.
>    - **NO "QUICK ACCESS PRESETS" or "AUTO-FILL ADMIN / DEMO" buttons** in login interfaces.
> 5. **Strict Zero-Fallback Admin Credentials Mandate (Environment-Only Admin Auth)**:
>    - **ZERO hardcoded fallback credentials or default admin accounts** (`todadjp@gmail.com`, `password123`, `admin123`, `admin@...`, etc.) in production code, backend libraries, authentication fallbacks, seeds, or stores.
>    - Admin accounts and authentication are **strictly derived from environment variables** (`ADMIN_EMAIL` and `ADMIN_PASSWORD`) provided via Vercel, Cloud Run, `.env.local`, or the active hosting provider.
>    - If `ADMIN_EMAIL` or `ADMIN_PASSWORD` are not defined in the environment, admin login MUST be rejected; the system MUST NEVER create or fall back to an arbitrary default credential or backdoor owner account.
>    - All other non-admin users must be authentic accounts registered directly against the persistent database.
> 6. **Canonical Workspace Folder Naming Law & UI Display Rules**:
>    - **Deterministic Naming Formula**: For all applications across the Ultrst ecosystem, workspace storage folder paths MUST be derived automatically using the standard formula:
>      `ultrst_{app_name}_{user_name}_{workspace_name}`
>      (e.g., `ultrst_docustack_admin_research_vault`, `ultrst_skipo_alex_project_alpha`).
>    - **Prohibition of Manual Folder Path Input**:
>      Workspace creation dialogs, settings modals, and admin panels MUST NEVER expose an editable "Vault Folder Path" input field. The folder name and path are strictly auto-derived from the application name, user account identifier, and workspace title.
>    - **Primary UI Title with Copyable Raw Folder Subtitle**:
>      Wherever a workspace is displayed in the user interface (header bar, workspace tiles menu, storage cards, settings profile, admin table):
>      1. The **Workspace Name** is the primary display element.
>      2. Directly beneath it, the **raw folder name** (`ultrst_{app}_{user}_{workspace}`) is rendered as small, monospace copyable text with 1-click clipboard copy functionality and visual feedback ("COPIED!").
>    - **Natural Mixed-Case in Description Inputs**:
>      Input fields and textareas for workspace descriptions, notes, and metadata MUST NOT have CSS `uppercase` or force uppercase text. They must allow users to type and display both upper and lower case letters naturally.
>    - **User-Owned Cloud Storage Integration (Backblaze B2, Cloudflare R2, AWS S3, Supabase)**:
>      When a user selects a cloud storage provider for a workspace, the system MUST NOT silently fall back to a dummy local path. It MUST provide a clean credential interface with live connectivity testing and create the canonical folder in the cloud provider upon connection.
> 7. **User-Scoped Cloud Storage Credentials & Browser Local Filesystem Law**:
>    - **Strict Separation of Infrastructure Credentials vs. User Workspace Credentials**:
>      - Server environment variables (`.env.local`, Vercel Env Vars, Cloud Run Secrets) are strictly reserved for **system database infrastructure**: `NEON_DATABASE_URL`, `SUPABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET`, etc.
>      - **User workspace storage credentials** (Backblaze B2, Cloudflare R2, AWS S3, Supabase Storage) belong to **individual users** and MUST be stored inside the user's profile record in the system database under `appProfiles.{appName}.storage_connections`.
>    - **Browser Local Folder Storage (File System Access API + IndexedDB)**:
>      - For offline/local storage when loaded from the web (e.g. deployed on Vercel), the app MUST support `window.showDirectoryPicker()` to open a native OS folder selector.
>      - The returned `FileSystemDirectoryHandle` is stored inside the browser's **IndexedDB** (`DocuStack_LocalFS_Vault`), while the reference key (`localFolderKey`) and folder name (`localFolderName`) are recorded on the workspace record in the system database.
>      - On subsequent sessions, the app re-retrieves the handle from IndexedDB and prompts for permission verification seamlessly.
>    - **Direct Credential Input & Live Connectivity Probing for Cloud Storage**:
>      - Supported storage engines (Backblaze B2, Cloudflare R2, AWS S3, Supabase Storage) are connected by having the user enter simple credential fields (Key ID, Application Key, Bucket Name) directly in the UI.
>      - The UI MUST provide a **"TEST CONNECTIVITY"** button calling `POST /api/auth/storage/test` to probe read/list access and measure round-trip latency (in milliseconds) before saving.
>      - Saved connections persist to `user.appProfiles.{appName}.storage_connections` and can be selected immediately for any workspace without re-entering credentials.
>    - **Implementation Pattern** (TypeScript):
>      ```typescript
>      // ✅ CORRECT: Storage credentials stored on user profile in system database
>      const connections = user.appProfiles?.docustack?.storage_connections || [];
>      const activeConn = connections.find(c => c.id === workspace.storageConnectionId);
>
>      // ❌ WRONG: Never read user workspace credentials from server env vars
>      // const key = process.env.BACKBLAZE_KEY_ID;
>      ```


---

## 2. Multi-Backend Database Clusters & High-Availability Redundancy

To guarantee zero data loss and fault-tolerant operation, the Control Plane supports **Multi-Backend Database Clustering**:

```
                              DATABASE CLUSTER VAULT
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
        [PRIMARY DATABASE]     [REDUNDANT CLONE 1]    [READ REPLICA 1]
         (Neon Serverless /     (Supabase BaaS /       (Firebase /
          PostgreSQL)            Cloud Standby)         SQLite)
                 │                      ▲
                 │ (Atomic Upsert Sync) │ (Real-Time Replication)
                 └──────────────────────┘
```

### Supported Engines & Mechanics:
1. **Neon Serverless Postgres** (`@neondatabase/serverless`):
   - Stateless SQL over HTTP pipeline.
   - Non-blocking table provisioning (`autoProvisionNeonTable`) with automatic column migrations for `app_profiles JSONB`, `avatar_glyph TEXT`, `last_login_at TIMESTAMPTZ`.
   - Explicit parameter type casting: `$8::jsonb`, `$9::timestamptz`, `$10::timestamptz`, `$11::timestamptz`.
2. **Supabase BaaS**:
   - REST-based upsert using `Prefer: resolution=merge-duplicates` header and Service Role Key.
3. **Firebase Cloud Firestore**:
   - Structured document patch via REST API v1.
4. **PostgreSQL Standard**:
   - Standard SQL connection string support.

---

## 3. Explicit Environment Variable Standards & Vercel Generator

To prevent ambiguity when multiple databases exist, standard explicit provider prefixes are used:

| Engine | Primary Variable Key | Table Name Key | Clone Variable Key |
|---|---|---|---|
| **Neon** | `NEON_DATABASE_URL` (or `DATABASE_URL`) | `NEON_TABLE_NAME` | `CLONE_NEON_DATABASE_URL` |
| **Supabase** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_TABLE_NAME` | `CLONE_SUPABASE_URL` |
| **Firebase** | `FIREBASE_PROJECT_ID` + `FIREBASE_API_KEY` | `FIREBASE_COLLECTION_NAME` | `CLONE_FIREBASE_PROJECT_ID` |
| **PostgreSQL**| `POSTGRES_DATABASE_URL` | N/A | `CLONE_POSTGRES_DATABASE_URL` |

### Visual Badges in Admin UI:
- `🟢 .ENV PERSISTENT`: Automatically detected from deployed environment variables.
- `⚡ RUNTIME (GET .ENV)`: Added dynamically in Admin UI. Opens the **1-Click Vercel `.env` Drawer** to copy the generated blueprint snippet into Vercel Project Settings.

---

## 4. Drop-in Code Library Reference (In `./code/`)

Any AI agent can copy these files directly into a new TypeScript/React application to implement the full Control Plane:

### Core Library & Storage (`./code/lib/`):
- [`code/lib/control-plane-types.ts`](./code/lib/control-plane-types.ts) — Cluster configurations, telemetry, latency results, and RBAC types.
- [`code/lib/control-plane.ts`](./code/lib/control-plane.ts) — Cluster management, Neon/Supabase/Firebase persistence, latency probes, and admin guards.
- [`code/lib/auth-storage.ts`](./code/lib/auth-storage.ts) — User registration with RFC 5322 regex validation, password hashing, session tokens, and workspace helpers.
- [`code/lib/audit-logger.ts`](./code/lib/audit-logger.ts) — Immutable admin security audit logs with JSON/CSV export.
- [`code/lib/rate-limiter.ts`](./code/lib/rate-limiter.ts) — In-memory & serverless rate limiter.

### Next.js API Routes (`./code/api/`):
- [`code/api/auth/register/route.ts`](./code/api/auth/register/route.ts) — User registration endpoint.
- [`code/api/auth/login/route.ts`](./code/api/auth/login/route.ts) — Rate-limited login with dynamic cluster lookup.
- [`code/api/auth/me/route.ts`](./code/api/auth/me/route.ts) — Active session & profile endpoint.
- [`code/api/auth/workspaces/route.ts`](./code/api/auth/workspaces/route.ts) — Workspace CRUD & switching.
- [`code/api/auth/app-profile/route.ts`](./code/api/auth/app-profile/route.ts) — Universal multi-app profile endpoint.
- [`code/api/auth/users/route.ts`](./code/api/auth/users/route.ts) — User listing & updates.
- [`code/api/admin/backend/route.ts`](./code/api/admin/backend/route.ts) — Admin cluster probe tests, auto-provisioning, and CRUD.
- [`code/api/admin/users/route.ts`](./code/api/admin/users/route.ts) — Admin user management.
- [`code/api/admin/audit/route.ts`](./code/api/admin/audit/route.ts) — Audit log query & export endpoint.
- [`code/api/admin/tables/route.ts`](./code/api/admin/tables/route.ts) — Live database table inspector.

### React UI Components (`./code/components/`):
- [`code/components/admin/AdminPanelModal.tsx`](./code/components/admin/AdminPanelModal.tsx) — Main Admin Control Plane Modal container.
- [`code/components/admin/AdminDatabaseClusterTab.tsx`](./code/components/admin/AdminDatabaseClusterTab.tsx) — Cluster management tab with latency pings, .env badges & Vercel Drawer.
- [`code/components/admin/AdminUsersTab.tsx`](./code/components/admin/AdminUsersTab.tsx) — Users & Roles management tab.
- [`code/components/admin/AdminAuditTab.tsx`](./code/components/admin/AdminAuditTab.tsx) — Audit Log Viewer with 1-click Copy & CSV/JSON export.
- [`code/components/admin/AdminTablesTab.tsx`](./code/components/admin/AdminTablesTab.tsx) — Live raw database table record viewer.
- [`code/components/admin/AdminBackendTab.tsx`](./code/components/admin/AdminBackendTab.tsx) — Legacy single-engine and storage engine testing tab.
- [`code/components/admin/AdminWorkspacesTab.tsx`](./code/components/admin/AdminWorkspacesTab.tsx) — Multi-tenant workspace overview tab.
- [`code/components/auth/LoginModal.tsx`](./code/components/auth/LoginModal.tsx) — User authentication modal.
- [`code/components/BrutalistUi.tsx`](./code/components/BrutalistUi.tsx) — Neo-Brutalist UI primitives (Card, Button, Badge, Modal, Input).

---

## 5. Strict Admin UI Panel Isolation & Back-Navigation Boundary Architecture

$$\text{Admin UI Panel (System Infrastructure)} \cap \text{Standard App & Workspace Plane} = \emptyset$$

### A. Architectural Isolation Rationale
The Admin Control Plane (`/admin`) is a dedicated system-level administrative console meant exclusively for platform administrators and infrastructure operations. It has zero overlap with user workspace files, documents, canvases, or personal settings.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ADMIN CONTROL PLANE SYSTEM (/admin)                  │
│  - Dedicated governance console entered strictly via /admin/login      │
│  - Governs database clusters, redundancy clones, failovers, and logs   │
│  - BACK-BUTTON INVARIANT: Clicking back routes strictly to /admin/login │
│  - NEVER navigates to any workspace window, canvas, or user view       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                         STRICT AIR-GAP ISOLATION
                                    │
┌────────────────────────────────────────────────────────────────────────┐
│               STANDARD USER WORKSPACE INTERFACE (/)                    │
│  - Workspace documents, canvas, media, tags, biomes, and themes       │
│  - Standard user login portal (/login)                                 │
│  - Workspace Settings: User preferences only (themes, folders, biomes) │
│  - NEVER contains system database cluster controls or master RBAC      │
└────────────────────────────────────────────────────────────────────────┘
```

### B. Inviolable Navigation & Back-Button Laws:
1. **Zero Workspace Escape**:
   - The Back button or exit button in the Admin UI header (`/admin`) **MUST NEVER** navigate to `/`, `/workspace`, or any user view.
   - Prohibit `<Link href="/" title="Return to Workspace">` with `<ArrowLeft />` inside `/admin`.
   - The Back button must route strictly to `/admin/login` (Admin Login Portal) or perform a session sign-out (`handleLogout()`):
     ```tsx
     <button
       type="button"
       onClick={() => {
         localStorage.removeItem('docustackAuthToken');
         router.push('/admin/login');
       }}
       className="p-2 border-2 border-[#D4AF37] bg-[#1A1813] hover:bg-[#D4AF37] hover:text-black cursor-pointer"
       title="Return to Admin Login"
     >
       <ArrowLeft size={16} />
     </button>
     ```
2. **Route Trapping on Root (`/`)**:
   - In the root application view (`app/page.tsx`), session initialization MUST inspect `user.role`.
   - If an authenticated administrator (`user.role === 'admin'`) arrives at `/` (via browser back button, forward button, or typed URL), client runtime must redirect them immediately to `/admin`.
   - Administrators must never be stranded or dumped into an unconfigured, empty, or misleading workspace window.
3. **Strict Separation from User Settings**:
   - Admin UI settings manage: Database Clusters, Redundant Clones, Vercel `.env` Blueprints, Raw SQL Tables, User Role Permissions, and Immutable Audit Trails.
   - User Settings (`SettingsModal.tsx`) manage: Visual Biomes, Themes, Wallpapers, Local Folder Selection, and Document View Modes.
   - User settings components MUST NEVER import, expose, or leak Admin Control Plane cluster operations.

---

## 6. Integration Protocol for Future AI Agents

1. **Install Dependencies**:
   ```bash
   npm install @neondatabase/serverless @supabase/supabase-js lucide-react clsx tailwind-merge
   ```
2. **Copy Code**:
   - Copy `code/lib/*` ➔ `lib/`
   - Copy `code/api/*` ➔ `app/api/`
   - Copy `code/components/*` ➔ `components/`
3. **Configure Environment Variables**:
   ```env
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=your_secure_password_123
   AUTH_SECRET=your_32_character_random_secret
   NEON_DATABASE_URL=postgresql://user:pass@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
   ```
4. **Trigger Auto-Provision**:
   - Navigate to `/admin/login`, open the Cluster tab, and click **⚡ Auto-Provision Table in Neon**.
