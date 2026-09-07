---
name: backend-environment-hosting
description: Deployment and hosting directives for running backends across Vercel Serverless / Edge, Local Desktop (Node, Tauri, Electron), and self-hosted LAN / Docker.
---

# MULTI-ENVIRONMENT HOSTING DIRECTIVES

Guidelines for ensuring backend code is portable, stateless where necessary, and properly adapted to Vercel Serverless, Local Desktop, or LAN/Docker deployments.

---

## 1. Hosting Target Matrix

$$\begin{array}{|l|l|l|l|}
\hline
\textbf{Target Platform} & \textbf{Data Provider Strategy} & \textbf{Storage Strategy} & \textbf{Key Environment Nuances} \\
\hline
\textbf{Vercel Serverless} & \text{PostgreSQL / Supabase (SSL)} & \text{S3 / Supabase / R2} & \text{Stateless, Connection Pooling, Env Vars} \\
\textbf{Local Desktop (Node/Tauri)} & \text{SQLite (WAL mode)} & \text{Local Filesystem} & \text{Zero-network, relative paths, file locks} \\
\textbf{Docker / LAN Self-Hosted} & \text{PocketBase / Local Postgres} & \text{Local FS / MinIO} & \text{Port binding, CORS headers, LAN IP discovery} \\
\hline
\end{array}$$

---

## 2. Vercel Serverless & Cloud Hosting Invariants

When deploying backends to Vercel, Next.js API routes, or Cloudflare Workers:
1. **Stateless Functions**: Serverless functions can spin up and tear down at any time. Never rely on in-memory global state across requests.
2. **Database Connection Pooling**: Direct PostgreSQL connections can quickly exhaust database pool limits under traffic spikes. Always use a connection pooler (e.g. Supabase Transaction Pooler / PgBouncer / Prisma Accelerate / Neon Serverless Driver).
3. **SSL Enforcement**: Remote Postgres connections must enforce `ssl: { rejectUnauthorized: false }` or appropriate CA certificate validation.
4. **Environment Variables**:
   - `DATABASE_URL` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
   - `STORAGE_BUCKET_URL` / `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY`
5. **No Ephemeral Local Disk for Persistence**: `/tmp` is ephemeral and lost between cold starts. All persistent workspace files must be directed to cloud object storage.
6. **Pre-Bundled Serverless Output**:
   Never rely on Vercel's automatic TypeScript resolution when server routes reference files outside the `api/` directory (e.g. `src/server/AppFactory`). Always pre-bundle the server layer into a standalone ESM file:
   ```bash
   esbuild api/index.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js
   ```
   Deploy `api/index.js` as the direct serverless entrypoint for Vercel.
7. **Dynamic Dev Tooling Import Invariant**:
   Never statically import development-only tooling (`vite`, `@vitejs/plugin-react`, `esbuild`) in server factories (`AppFactory.ts`, `server.ts`). Inside Vercel/AWS Lambda microVMs, development dependencies do not exist and cause immediate `FUNCTION_INVOCATION_FAILED`. Always isolate via dynamic import:
   ```typescript
   if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
     const { createServer } = await import('vite');
     // configure dev middleware
   }
   ```
8. **Placeholder Database Connection Sanitization**:
   Never allow connection poolers (`pg.Pool`, `neon`) to attempt connecting to template strings (`ep-sample.neon.tech`, `example.com`, `user:password@`). Connection attempts to dummy hosts hang serverless bootstrap and cause 500 lambda crashes. Always sanitize via `sanitizeDatabaseUrl()` from `@skipo/core`.
9. **Safe JSON Response Parsing**:
   Client requests must always check `res.headers.get('content-type')?.includes('application/json')` before calling `res.json()`. If edge routers (Vercel, Cloudflare) return an HTML error page (404/500), raw `.json()` crashes with `Unexpected token 'T'`. Use `@skipo/core`'s `request<T>()` or inspect content-type defensively.
10. **One-Click Copyable Error Alerts**:
    All authentication, connection setup, and error notification views should incorporate `CopyableErrorAlert` from `@skipo/ui` to allow users and debugging agents to copy raw backend error payloads to clipboard.

---

## 3. Local Desktop (Electron / Tauri / Node) Invariants

When running backends locally on the user's workstation:
1. **Zero-Divergence Control Plane Parity**: The Control Plane resolves user accounts and authentication identically across local development and cloud hosting via environment variables (`.env.local`).
   - **STRICT PROHIBITION**: NEVER create local-only SQLite credential files (`accounts.sqlite`), ephemeral `/tmp` files, or redundant local files storing credentials.
   - If no database is configured, report `System Backend Database (Awaiting .env)` locally and remotely.
2. **Path Resolution**: Use normalized local paths (e.g., `path.resolve(appDataDir, "workspaces", workspaceId)`).
3. **SQLite WAL Mode**:
   ```typescript
   db.pragma("journal_mode = WAL");
   db.pragma("synchronous = NORMAL");
   db.pragma("foreign_keys = ON");
   ```
4. **Desktop Native APIs**: In Tauri or Electron, leverage local IPC or native FS bridges when serving media files to UI views without HTTP overhead.

---

## 4. Self-Hosted LAN & Docker Invariants

When deploying backends on local network hardware (NAS, Raspberry Pi, home server, Docker container):
1. **CORS & Ingress**: Configure allowed origins dynamically to allow UI clients connecting via `http://localhost:XXXX` or `http://192.168.x.x:XXXX`.
2. **Binding Address**: Ensure services bind to `0.0.0.0` instead of `127.0.0.1` when exposure across LAN is required.
3. **Service Discovery**: Support simple health checks at `/api/health` and latency testing via `/api/database/test`.
