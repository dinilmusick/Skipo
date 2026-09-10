---
name: universal-backend-router
description: Universal Backend Architecture master router for multi-environment hosting (Local Desktop, LAN/Docker, Remote/Vercel Serverless) with decoupled Control Plane vs Workspace Data Plane, independent Data/Storage providers, and strict Admin authorization.
---

# UNIVERSAL BACKEND ARCHITECTURE SUB-ROUTER

## 0. INVIOLABLE BACKEND STRUCTURAL LAWS (ENFORCE BEFORE EVERY FILE WRITE)

### LAW A: Top-Level Entry File Purity
```
BACKEND TOP-LEVEL FILES = { server.ts, index.ts, app.ts, main.ts, entry.ts }

THESE FILES MUST CONTAIN ONLY:
  ✓ Import statements (factories, providers, configuration loaders)
  ✓ A single startup/bootstrap call (e.g., createApp().listen(PORT))
  ✓ Optionally: environment variable reads for port/host

ABSOLUTELY FORBIDDEN:
  ✗ Route handler definitions (app.get(), router.post(), etc.)
  ✗ Middleware registration (app.use(...))
  ✗ Business logic, database queries, or service instantiation inline
  ✗ More than ~10 lines of non-import, non-bootstrap code

CANONICAL VALID server.ts:
  import { createApp } from "./app/AppFactory";
  const app = createApp();
  app.listen(process.env.PORT ?? 3000);

CANONICAL VALID AppFactory.ts:
  import express from "express";
  import { applyMiddleware } from "./middleware/applyMiddleware";
  import { mountRoutes } from "./routes/mountRoutes";
  export function createApp() {
    const app = express();
    applyMiddleware(app);
    mountRoutes(app);
    return app;
  }
```

### LAW B: One Module Per File
```
Every .ts backend file exports exactly ONE primary entity:
  ONE service class  |  ONE controller  |  ONE router factory  |  ONE utility

FORBIDDEN:
  ✗ Multiple service classes in one file
  ✗ Multiple express Router definitions in one file
  ✗ Mixed service + controller logic in one file

DECOMPOSITION PATTERN (when a controller/service grows):
  users/
    UsersController.ts       ← route handlers only, delegates to service
    UsersService.ts          ← business logic, calls repository
    UsersRepository.ts       ← database queries only
    users.routes.ts          ← router factory, mounts controller methods
    users.types.ts           ← shared interfaces/types
    users.validators.ts      ← zod/joi schemas for request validation
```

### LAW C: 200-Line Maximum (Backend = Same as Frontend)
```
HARD LIMIT: 200 lines per .ts file — no exceptions.
At 180 lines → split into sub-modules.
Applies to: controllers, services, repositories, route files, middleware, utilities.
```

### LAW D: Serverless Portability & Zero Static Dev Tooling in Server Factories
```
1. ZERO STATIC DEV TOOLING IN RUNTIME SERVERS:
   Never write static imports for vite, esbuild, or dev watchers in AppFactory.ts or server.ts:
   ✗ import { createServer } from 'vite';
   ✓ if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
       const { createServer } = await import('vite');
     }
2. PRE-BUNDLED SERVERLESS OUTPUT:
   For Vercel/serverless targets, pre-bundle the server entry into a single standalone ESM bundle:
   `esbuild api/index.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js`
3. PLACEHOLDER DB SANITIZATION:
   Never boot connection pools against template URIs ('ep-sample', 'example.com', 'user:password@').
   Use sanitizeDatabaseUrl() from @skipo/core to safely verify database readiness.
```

### LAW E: Mandatory API Security & Resource Governance Pipeline (8-Gate Pipeline)
```
INVARIANT: UI_CAPABILITY_SET == API_CAPABILITY_SET
All API endpoints across the backend MUST be wrapped with createSecureRoute() adhering to the 8-Gate Pipeline:

[0. IP Blocklist] -> [1. Request Validation] -> [2. Auth] -> [3. Authorization] -> [4. Rate Limit] -> [5. Resource Limits] -> [6. Application Logic] -> [7. Security Headers & Observability]

1. ZERO RAW UNGUARDED ROUTE HANDLERS:
   Raw Next.js App Router exports or Express handlers are strictly forbidden. All handlers must use:
   export const GET = createSecureRoute({ ... });
2. EARLY REJECTION SHORT-CIRCUITS:
   Failure at any gate immediately halts downstream execution (STOP -> NO_DOWNSTREAM_EXECUTION).
   No DB connections, heavy business logic, or file I/O run for unauthorized/invalid/rate-limited requests.
3. RESOURCE BUDGETS & CONCURRENCY:
   - Max payload size enforced pre-flight (content-length header) before reading body into memory.
   - Runaway requests aborted via executionTimeoutMs (default 8s, expensive 30s).
   - In-flight concurrency slots protect the event loop.
4. AUTO-BLOCKING ABUSE DETECTION:
   Spike anomalies (401, 403, 429, 5xx, or request surges) automatically ban malicious IPs for 15 minutes.
```

### LAW F: Multi-Session Storage, Refresh Token Rotation & Progressive Trust Law
```
1. ZERO CREDENTIALS ON USER ROOT:
   - User entity remains account-level (id, email, trustLevel, emailVerified, status, sessions: Session[]).
   - Monolithic credential storage directly on User is strictly forbidden.
2. MULTI-SESSION ISOLATION:
   - Every login generates an independent Session record.
   - Revoking Session A (e.g. laptop logout) does NOT invalidate Session B (phone) or Session C.
   - Password reset or explicit "Logout All Devices" revokes all active sessions.
3. ROTATION & THEFT DETECTION:
   - Raw refresh tokens are 48-byte cryptographically random, never stored raw in DB (stored as SHA-256(token)).
   - Stored in HttpOnly + Secure + SameSite=lax cookies (30d TTL). Short-lived Access Tokens (15m TTL).
   - Reusing an already-invalidated refresh token is detected as token theft -> immediately revokes the Session and rejects with 401.
4. SERVER-SIDE PROGRESSIVE TRUST (T0 - T4):
   - T0 (0.25x), T1 (1.0x), T2 (2.0x), T3 (5.0x), T4 (10.0x).
   - Enforce minimumTrustLevel and emailVerificationRequired in createSecureRoute.
5. MULTI-SIGNAL ABUSE PENALTIES:
   - Abuse scores: >= 15 halves rate limits, >= 30 revokes active sessions, >= 50 auto-suspends account.
```


---

Architectural standard for constructing portable, scalable, environment-agnostic backends capable of running seamlessly on local runtimes (Node.js, Electron, Tauri), local-network services (Docker, LAN, self-hosted BaaS), or cloud serverless environments (Vercel, Supabase, AWS, Cloudflare).

---

## 1. Core Principle & Cardinal Rule

$$\text{Backend} = \text{Control Plane} \oplus \text{Workspace Data Plane} \oplus \text{Application Logic}$$

$$\text{Control Plane (User Accounts/Auth/Config)} \cap \text{Data Plane (Workspace Data/Media)} = \emptyset$$

```
APPLICATION
│
├── 1. CONTROL PLANE
│      ├── User Accounts
│      ├── Authentication
│      ├── Admin Configuration
│      └── Backend Connections
│
├── 2. WORKSPACE DATA PLANE
│      ├── Project Data
│      ├── Metadata
│      └── Media / Large Files
│
└── 3. APPLICATION LOGIC
       └── Uses the above through provider interfaces
```

> [!IMPORTANT]
> **The Cardinal Rule**: User-account storage and workspace/project storage are distinct, decoupled systems. The application must **never** assume that the database used for user accounts is also the database used for a user’s workspace.

---

## 2. Backend Sub-Skill Routing Table

| Sub-Domain | Target Sub-Skill | Scope & Key Directives Covered | Trigger Keywords |
| :--- | :--- | :--- | :--- |
| **Control Plane & Auth** | [`control-plane/SKILL.md`](./control-plane/SKILL.md) | User accounts (Local SQLite vs Hosted BaaS), Auth/Tokens, Workspace registry, User $\to$ Workspace resolution, Admin authorization boundaries | `control_plane`, `user_accounts`, `auth_provider`, `admin_security`, `workspace_registry`, `user_resolution` |
| **Workspace Storage & Sync** | [`workspace-storage/SKILL.md`](./workspace-storage/SKILL.md) | Pure Virtual Filesystem (NO user databases), Decoupled WorkspaceStorageAdapters (Local FS, Backblaze B2, Cloudflare R2, Supabase, AWS S3), WorkspaceFS, SyncEngine | `workspace_storage_spec`, `workspace_fs`, `sync_engine`, `primary_storage`, `backup_storage`, `multi_cloud_sync`, `storage_adapters` |
| **Workspace Data Plane** | [`data-plane/SKILL.md`](./data-plane/SKILL.md) | 3 Workspace storage modes (Mode 1: Local FS, Mode 2: Local-Hosted LAN/Docker, Mode 3: Remote Cloud BaaS), Multi-tenancy strategies | `data_plane`, `workspace_storage`, `mode_1_local`, `mode_2_local_hosted`, `mode_3_remote`, `sqlite_fs`, `storage_modes` |
| **Decoupled Providers** | [`providers/SKILL.md`](./providers/SKILL.md) | Independent `IDataProvider` vs `IStorageProvider`, `IWorkspaceBackend`, normalized `BackendConnectionConfig`, Factory resolution | `backend_providers`, `data_provider`, `storage_provider`, `backend_connection_config`, `provider_interfaces` |
| **Environment Hosting** | [`environments/SKILL.md`](./environments/SKILL.md) | Vercel Serverless / Edge hosting, Connection pooling, SSL, Local Desktop (Tauri/Electron), Docker / LAN ingress & CORS | `vercel_backend`, `serverless_hosting`, `desktop_runtime`, `docker_lan`, `connection_pooling`, `ssl_enforce` |

---

## 3. The 3 Fundamental Workspace Storage Modes

```
       Mode 1: Local FS                 Mode 2: Local-Hosted                Mode 3: Remote-Hosted
   ┌──────────────────────┐           ┌──────────────────────┐            ┌──────────────────────┐
   │      Workspace       │           │      Workspace       │            │      Workspace       │
   │  ┌────────────────┐ │           │  ┌────────────────┐ │            │  ┌────────────────┐ │
   │  │ database.sqlite│ │           │  │ http://local.. │ │            │  │ https://cloud..│ │
   │  ├────────────────┤ │           │  ├────────────────┤ │            │  ├────────────────┤ │
   │  │ /storage/media │ │           │  │ Local Supabase │ │            │  │ Remote Supabase│ │
   │  └────────────────┘ │           │  └────────────────┘ │            │  └────────────────┘ │
   └──────────────────────┘           └──────────────────────┘            └──────────────────────┘
```

1. **Mode 1 — Local Filesystem**: Local-first, `database.sqlite` + `./storage/`. Zero cloud, zero external servers.
2. **Mode 2 — Local-Hosted Backend**: Connected to local network/Docker backend (`http://localhost:XXXX` or LAN IP).
3. **Mode 3 — Remote-Hosted Backend**: Cloud backend (`https://backend.example.com`). Identical provider interface as Mode 2.

---

## 4. Complete Backend Architecture Matrix

$$\begin{array}{|c|c|l|}
\hline
\textbf{Account Backend (Control Plane)} & \textbf{Workspace Backend (Data Plane)} & \textbf{Deployment / Target Use Case} \\
\hline
\text{Cluster (Neon/Postgres via .env)} & \text{Local FS (WorkspaceFS)} & \text{Standard Hybrid Desktop / Cloud Identity} \\
\text{Cluster (Neon/Postgres via .env)} & \text{Local-Hosted BaaS (LAN/Docker)} & \text{LAN / On-prem secure storage} \\
\text{Cluster (Neon/Postgres via .env)} & \text{Remote Cloud (S3 / Supabase)} & \text{Fully cloud-hosted / Vercel Serverless} \\
\hline
\end{array}$$

---

## 5. Canonical Mental Model

```
                         APPLICATION
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
          CONTROL PLANE                DATA PLANE
                │                           │
          "WHO?" / "HOW?"              "WHAT?"
                │                           │
        ┌───────┴────────┐          ┌───────┴────────┐
        │                │          │                │
     Accounts          Admin      Database         Storage
        │                │          │                │
    Cluster DB       Protected   Filesystem/       Files/S3/
    (via .env)        Control    Supabase/etc.     Supabase/etc.
```

---

## 6. Pre-Flight Project Classification Checklist

Before implementing backend logic for any application or sub-app, execute this classification:

1. **Classify Account System (Control Plane)**:
   - [ ] Environment-Driven Database Cluster (`NEON_DATABASE_URL` / `SUPABASE_URL` via `.env.local` / Vercel)
   - [ ] **NO local-only SQLite credential files (`accounts.sqlite`) or redundant local files**.
2. **Classify Workspace Data (Data Plane)**:
   - [ ] Local SQLite per workspace
   - [ ] Local-Hosted BaaS (LAN/Docker)
   - [ ] Remote Cloud BaaS (Supabase / Postgres)
3. **Classify File / Media Storage**:
   - [ ] Local Filesystem (`./storage`)
   - [ ] S3-Compatible Object Store (AWS / Cloudflare R2 / MinIO)
   - [ ] Supabase Storage
4. **Classify Hosting Environment**:
   - [ ] Local Desktop / Electron / Tauri
   - [ ] Node.js Dedicated Container
   - [ ] Vercel Serverless / Edge Function (Stateless DB connection pooling + SSL required)

---

## 7. Zero-Leak UI & Anti-Copy Invariants (Frontend Governance)

1. **Zero Leakage of Backend / System Jargon in UI**:
   $$\text{RenderedUI} \cap \{ \text{"Control Plane"}, \text{"Data Plane"}, \text{"RBAC"}, \text{"Storage Adapter"}, \text{"SyncEngine"}, \text{"WorkspaceFS"}, \text{"Cluster"}, \text{"Failover"}, \text{"Endpoint ID"} \} = \emptyset$$
   - Backend terms ("Control Plane", "Data Plane", "Storage Adapter", "SyncEngine", "WorkspaceFS", etc.) MUST NEVER be rendered as user-facing headers, labels, or UI views.
   - Use high-level, human-friendly terms ("Account", "Workspaces", "Storage", "Google Drive", "Local", "Replicas").
2. **Zero On-Screen Instructional / Promotional Text**:
   - FORBID direct text descriptions, tutorial paragraphs, marketing copy, or "how-to" guidance rendered into the UI viewport.
   - The UI must be quiet, minimal, and unobtrusive.
3. **Strict Icon-Only Buttons (Zero Text Labels on Buttons)**:
   - Buttons MUST NOT render text labels directly on their surface.
   - Buttons contain strictly monochromatic vector/SVG icons.
   - All button labels, action descriptions, and keyboard shortcuts appear **exclusively on hover tooltips**.

---

## 8. Real-Time Event Bus & State Mirroring Invariant

1. **Broadcast on Every Mutation**:
   All backend route handlers modifying system state (`POST`, `PUT`, `DELETE` on documents, categories, nodes, workspaces, biomes) MUST invoke `publishRealtimeEvent()` from `lib/realtime-events.ts` before returning.
2. **Multi-Tenant Workspace Header**:
   Backend handlers must extract `x-workspace-id` and authenticate via `Authorization: Bearer <token>`, scoping all data operations to the specific workspace.
3. Zero-Crash Local Cluster Fallback:
   When external databases (`DATABASE_URL`, `SUPABASE_URL`) are omitted from `.env`, user persistence must gracefully persist to local storage (`{ success: true, targetsUpdated: ['local_storage'] }`) without throwing unhandled exceptions.

---

## 9. API Security & Resource Governance Architecture (The 8-Gate Pipeline)

### Request Lifecycle Pipeline
```
REQUEST
  │
  ▼
[GATE 0: IP Blocklist]            ──(banned IP)───────────► HTTP 403 (Zero CPU/DB cost)
  │
  ▼
[GATE 1: Request Validation]      ──(bad method/type/len)─► HTTP 400 / 405 / 413 / 415 / 422
  │
  ▼
[GATE 2: Authentication]          ──(missing/bad token)───► HTTP 401 Unauthorized
  │
  ▼
[GATE 3: Authorization]           ──(role mismatch)───────► HTTP 403 Forbidden
  │
  ▼
[GATE 4: Rate Limiting]           ──(rate exceeded)───────► HTTP 429 Too Many Requests
  │
  ▼
[GATE 5: Resource Budgeting]      ──(concurrency/timeout)─► HTTP 503 / 504 (Clamped limit)
  │
  ▼
[GATE 6: Application Logic]       ──(unhandled error)─────► HTTP 500 (Sanitized incident ID)
  │
  ▼
[GATE 7: Headers & Observability] ──(attach headers)──────► Final Secured Response
```

### Rate Limiting Tiers
| Tier | Capacity | Window | Typical Endpoints |
| :--- | :--- | :--- | :--- |
| `CHEAP_READ` | 120 requests | 1 minute | `/api/health`, `/api/categories`, `/api/wallpapers`, status queries |
| `NORMAL_MUTATION` | 60 requests | 1 minute | Document creation, category edits, workspace updates |
| `EXPENSIVE_OPERATION` | 20 requests | 1 minute | Bulk export/import, sync-clones, database test, AI doc analysis |
| `AUTHENTICATION` | 25 requests | 15 minutes | `/api/auth/login`, `/api/auth/register`, password updates |

### Abuse Anomaly Auto-Blocking
- **Monitored Anomalies**: 401 spikes, 403 spikes, 429 spikes, 5xx bursts, raw request floods.
- **Observability**: Metrics recorded in an in-memory ring buffer (500 entries) accessible via `/api/telemetry` for authenticated admins.

---

## 10. Multi-Session Storage & Progressive Trust Architecture

### Multi-Session Relationship
```
User (Account Entity)
 ├── Session A ──> Device A (Laptop) ──> Rotating Refresh Token A (SHA-256)
 ├── Session B ──> Device B (Phone)  ──> Rotating Refresh Token B (SHA-256)
 └── Session C ──> Device C (Tablet) ──> Rotating Refresh Token C (SHA-256)
```

### Progressive Trust Multipliers & Promotion Ladder
```
T0_UNVERIFIED (0.25x)
      │  (Email Challenge Verified)
      ▼
T1_EMAIL_VERIFIED (1.0x)
      │  (Account Age >= 7d + Low Abuse)
      ▼
T2_ESTABLISHED (2.0x)
      │  (Account Age >= 30d + 50 Activities + Very Low Abuse)
      ▼
T3_TRUSTED (5.0x)
      │  (Admin Grant / Privileged Role)
      ▼
T4_PRIVILEGED (10.0x)
```

### Token Lifecycle & Theft Detection Invariants
1. **Raw Token Ephemerality**: High-entropy raw refresh tokens (48 bytes) are NEVER stored in persistent storage or logged. Only `SHA-256(rawToken)` is stored in `Session.refreshTokenHash` and in the rotated token history.
2. **Atomic Rotation**: Every call to `/api/auth/refresh` invalidates the existing refresh token hash, stores the new hash, and issues a fresh short-lived access token (15m) and a fresh refresh token (30d HttpOnly cookie).
3. **Theft Detection & Session Revocation**: If an invalidated refresh token is ever submitted, it indicates that a stolen token is being replayed. The system immediately revokes the entire `Session`, writes a `REFRESH_TOKEN_REUSE` security event to the audit log, and rejects the request with HTTP 401.
4. **Session Isolation**: Logging out of Session A revokes only Session A. Sessions B and C remain active without interruption. "Logout All Devices" or password change triggers `revokeAllUserSessions()`.

---

## 11. Frontend ↔ Backend Connectivity Infrastructure

```text
                         FRONTEND
                            │
                            ▼
                      BackendClient
                            │
                            ▼
                   ┌──────────────────┐
                   │ Backend Contract │
                   └────────┬─────────┘
                            │
                            ▼
                     BackendResolver
                            │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
       [ LOCAL MODE ]                [ REMOTE MODE ]
              │                             │
              ▼                             ▼
      InProcessExecutor               RemoteExecutor
              │                             │
              │                             ▼
              │                         Transport
              │                      (HTTP / WS / RPC)
              │                             │
              │                             ▼
              │                       Load Balancer
              │                             │
              │                ┌────────────┼────────────┐
              │                ▼            ▼            ▼
              │               BE1          BE2          BEn
              └────────────────┬────────────┴────────────┘
                               │
                               ▼
                        Backend Runtime
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
       EventBus            JobScheduler        State Layer
     (No Polling)        (DAG Sequencing)    (Optimistic CAS)
          │                    │                    │
          ▼                    ▼                    ▼
   CallbackRegistry     SequenceTracker        LockManager
 (Session Delegation)   (Gap Detection)      (FIFO Mutex)
```

### 11.1 Non-Negotiable Connectivity Invariants
1. **Single Public Surface**: Frontend imports ONLY `BackendClient` / `BackendContract` from `@skipo/backend/client`. Frontend MUST NEVER import backend implementation files, internal controllers, or storage adapters directly.
2. **Identical API Across Topologies**:
   ```typescript
   // SAME code runs in Google AI Studio (In-Process) and Vercel (Remote):
   await backend.documents.create({ title: "Architecture.md" });
   backend.documents.on("created", (event) => updateState(event.payload));
   await backend.jobs.submit({ type: "export", payload: { format: "pdf" } });
   await backend.documents.delegate("process", payload, onProgressCallback);
   ```
3. **Dual Mode Execution & Google AI Studio / Vercel Readiness**:
   - **Google AI Studio / Browser Preview**: `BackendResolver` dynamically selects `ResolutionStrategy.LOCAL`, using `InProcessExecutor` executing against in-memory runtime with zero sockets and zero serialization.
   - **Vercel / Production**: `BackendResolver` selects `ResolutionStrategy.REMOTE`, using `RemoteExecutor` over `HTTPTransport` (connecting to `/api`) or `WebSocketTransport`.
4. **Root `index.html` Preservation**: All applications MUST maintain `index.html` at the project root so that Google AI Studio, static preview hosts, and Vercel serve the frontend without proxy rewriting issues.
5. **Anti-Polling EventBus**: Push events replace periodic polling. Sequence gaps are detected by `SequenceTracker` and trigger automatic authoritative resynchronization.
6. **Race Condition Prevention & Concurrency**:
   - Resource-scoped FIFO `LockManager` with bounded timeouts.
   - In-flight mutation deduplication via `IdempotencyManager`.
   - Optimistic concurrency control via `ResourceVersion` and `compareAndSwap`.
   - DAG-based `JobScheduler` ensuring dependent jobs execute strictly after prerequisites complete.
7. **Session-Scoped Delegation**: Remote functions are never serialized; callbacks are registered as opaque, session-scoped `CallbackHandle` tokens.
