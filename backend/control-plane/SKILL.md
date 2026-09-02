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
>    - Authentication bootstrap accounts are strictly derived from environment variables (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and project owner configuration. All other users must be authentic accounts registered directly against the persistent database.

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

## 5. Integration Protocol for Future AI Agents

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
