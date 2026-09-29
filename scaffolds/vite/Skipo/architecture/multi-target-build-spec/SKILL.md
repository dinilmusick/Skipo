---
name: multi-target-build-spec
description: Formal specification for Multi-Target Builds (Vercel Fullstack & Cloudflare Workers API) with Protocol Adapters.
---

# MULTI_TARGET_BUILD_SPEC: PROTOCOL ADAPTERS & BUILD TARGETS

$$\text{ValidTarget}(\mathcal{A}, \tau) \iff (\tau \in \{\text{fullstack}, \text{api}\}) \wedge \text{SingleSource}(\mathcal{A}) \wedge \text{Adapters}(\mathcal{A})$$

## 0. ARCHITECTURAL PRINCIPLE

One source tree. One universal backend facade (`<AppName>Backend.ts`). Protocol adapters for runtime execution environments.

```
src/
├── frontend/                     # Pure UI components, views, hooks (FULLSTACK only)
├── frontend-state/               # Client UI stores & events (FULLSTACK only)
├── backend/                      # Universal backend plane (BOTH targets)
│   ├── <AppName>Backend.ts       # UNIVERSAL BACKEND FACADE (Business logic, orchestrations, services)
│   │                               - Consumed directly by Frontend in-process
│   │                               - Consumed internally by Protocol Adapters
│   ├── server/                   # Server runtime factories & handlers
│   │   ├── appFactory.ts         # Pure Express app factory (routers, CORS, table bootstrap)
│   │   └── serverless.ts         # Vercel Serverless Function entry point
│   ├── adapters/                 # PROTOCOL ADAPTERS
│   │   └── httpsAdapter.ts       # Standalone HTTPS / Cloudflare Worker Fetch handler (API_TARGET)
│   ├── orchestrations/           # Context-neutral composition graphs (FLAT)
│   ├── services/                 # Encapsulated modular services
│   │   └── <service>/
│   │       ├── <service>.ts      # Service facade
│   │       ├── client/           # Browser implementation (localStorage, DOM)
│   │       ├── server/           # Worker / Server implementation (Web Crypto, Neon, Fetch)
│   │       ├── remote/           # Remote gateway client
│   │       └── repositories/     # Data persistence boundary
│   └── gateway/                  # Gateway transport & registry
└── libraries/                    # Environment-neutral pure shared code
```

## 1. DUAL TARGET TAXONOMY

| Dimension | FULLSTACK_TARGET (`build:fullstack`) | API_TARGET (`build:api`) |
| :--- | :--- | :--- |
| **Primary Platform** | Vercel (Vite SPA + Serverless API / Node) | Cloudflare Workers / Edge Runtime |
| **Primary Purpose** | Fullstack User Experience | Headless Programmatic API Access |
| **Frontend Assets** | Included (`dist/` static files, index.html) | Excluded (zero UI code) |
| **Client Services** | Included (`src/backend/services/*/client/`) | Excluded (tree-shaken out) |
| **Server Services** | Included (`src/backend/services/*/server/`) | Included |
| **Orchestrations** | Included (flat context-neutral) | Included (flat context-neutral) |
| **Entrypoint** | Frontend: `src/main.tsx` / API: `serverless.ts` | `src/backend/adapters/httpsAdapter.ts` |
| **Output Path** | `dist/` (SPA) + `api/index.js` (Serverless Function) | `dist/api/worker/index.js` |
| **Deploy Config** | `vercel.json` | `wrangler.toml` |

## 2. PROTOCOL ADAPTER INVARIANT (CLOUDFLARE WORKERS API)

Every API build target entry MUST reside under `src/backend/adapters/httpsAdapter.ts`.
It must export a standard Fetch API handler:
```typescript
export default {
  async fetch(request: Request, env?: Record<string, unknown>): Promise<Response> {
    // Routes HTTP wire requests to <AppName>Backend orchestrations and services
  }
};
```
- Bundled via: `scripts/skipo-build.cjs api` -> generates `dist/api/worker/index.js`
- Deployed via `wrangler.toml` pointing `main = "dist/api/worker/index.js"`.
- **Wrangler Build Directive Invariant**: `wrangler.toml` MUST declare `[build] command = "npm run build:api"`. This ensures that any direct `wrangler deploy` invocation triggers compilation of `dist/api/worker/index.js` automatically.
- **Workers with Static Assets Invariant (`[assets]`)**: `wrangler.toml` MUST configure `[assets]` with `binding = "ASSETS"` and `not_found_handling = "single-page-application"`. For Next.js applications, assets are harvested from `.next` into `dist/client/`. For Vite applications, assets are served directly from `dist/`.
- **Non-API UI Delegation**: `httpsAdapter.ts` must delegate any non-`/api/*` request to `env.ASSETS.fetch(request)` so that navigating to `/` or client-side routes renders the complete application UI on the `.workers.dev` domain.
- **Universal Build Alias Contract**: `package.json`'s `"build"` script MUST point to `"npm run build:all"`. Both Vercel and Cloudflare CI execute `npm run build` upon GitHub push; running `build:all` builds both the fullstack UI assets and the Cloudflare worker bundle with zero manual configuration.

## 3. ZERO-TOUCH GITHUB CI/CD UNIFICATION

Connecting a Skipo repository to GitHub provides simultaneous, zero-configuration deployments to both platforms:
1. **Push to `main`**: Triggers webhook builds on both Vercel and Cloudflare automatically.
2. **On Vercel**:
   - Executes `npm run build` (`build:all`).
   - Picks up `.next` (Next.js) or `dist/` + `api/index.js` (Vite) and deploys the fullstack app.
3. **On Cloudflare Workers**:
   - Executes `npm run build` (`build:all`), generating static UI assets and the Worker bundle.
   - Executes `npx wrangler deploy`, which reads `wrangler.toml`, uploads the `[assets]` directory, and binds the Worker script.
   - Serves the frontend UI at `https://<app>.workers.dev/` and executes APIs at `https://<app>.workers.dev/api/*`.


## 4. VERCEL FULLSTACK ARCHITECTURE CONTRACT

Fullstack deployments on Vercel combine the client-side SPA with a serverless Node function:
1. **App Factory Isolation**: `src/backend/server/appFactory.ts` exports `createApp()` mounting all Express routes, CORS headers, and system DB bootstrap routines.
2. **Serverless Handler**: `src/backend/server/serverless.ts` wraps the factory for Vercel's execution lifecycle.
3. **Bundled Serverless Output**: `npm run build:fullstack` bundles `serverless.ts` to `api/index.js` via esbuild:
   ```bash
   vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs && esbuild src/backend/server/serverless.ts --bundle --platform=node --format=esm --packages=external --minify --banner:js="// @generated" --outfile=api/index.js
   ```
4. **`vercel.json` Routing Contract**:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "framework": "vite",
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "functions": {
       "api/index.js": { "includeFiles": "{node_modules/sql.js/dist/sql-wasm.wasm,data/**}" }
     },
     "rewrites": [
       { "source": "/api/(.*)", "destination": "/api" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
5. **Dashboard Override Prevention**: In the Vercel Project Settings (under **General > Build & Development Settings**), Framework Preset must be set to **Vite** (or **Other**), with **Build Command** set to `npm run build` and **Output Directory** set to `dist`. When pre-set to "Next.js", Vercel halts before building if `next` is missing from `package.json`.
6. **Serverless Read-Only Filesystem & `/tmp` Fallback**: Vercel functions execute in `/var/task` which is read-only. Backend modules must NEVER execute unconditional `fs.mkdirSync` or `fs.writeFileSync` at top-level module load. Writable runtime storage must route to `/tmp`, falling back to `path.join(process.cwd(), 'data')` only for reading bundled seed assets.
7. **Defensive Router Mounting**: In `appFactory.ts` and sub-routers, all middleware and child routers mounted via `app.use(router)` MUST be guarded with `typeof router === 'function'` to prevent unhandled `app.use() requires a middleware function` crashes caused by failed or circular module initialization.


## 5. LOCKFILE PURITY & PACKAGE MANAGER EXCLUSIVITY

$$\text{LockfileCount}(repo) \equiv 1 \wedge (\text{UsesNpm} \implies \text{NoBunLock}(repo))$$

1. **Cloudflare Frozen Lockfile Conflict Hazard**: Cloudflare Pages/Workers detects `bun.lock` in the repository root and forces `bun install --frozen-lockfile`. When Cloudflare's installed Bun version (`v1.2.15`) encounters a lockfile with `"lockfileVersion": 2`, it fails with `UnknownLockfileVersion: failed to parse lockfile: 'bun.lock'`.
2. **Mandatory Single Lockfile Rule**:
   - If a project uses `npm`, only `package-lock.json` may be committed.
   - `bun.lock`, `bun.lockb`, and `pnpm-lock.yaml` are STRICTLY FORBIDDEN.
   - Zero-byte placeholder lockfiles are prohibited.

## 6. FRAMEWORK DETECTION & ANTI-HALLUCINATION INVARIANT

$$\text{ViteApp}(repo) \implies \text{package.json}.\text{devDependencies} \cap \{\text{'next'}\} = \emptyset$$

1. **Vercel Framework Misdetection Hazard**: Vercel scans `package.json` for framework names. If `"next"` is present in dependencies or devDependencies of a Vite SPA, Vercel falsely identifies the framework as `Next.js` and crashes when the Next.js output directory `.next` is not found.
2. **Clean Dependency Separation**: In Vite-based applications, Next.js dependencies must never be declared in `package.json`. Vercel automatically selects Vite and deploys `dist/` and `api/index.js`.

## 7. ZERO-DRIFT UNIFIED CORE SERVICES ARCHITECTURE (`src/backend/services/core/`)

$$\text{ZeroDrift}(\mathcal{A}) \iff \forall r \in \text{Routes}: \text{Exec}(r, \text{Vercel}) \equiv \text{Exec}(r, \text{Cloudflare}) \wedge \neg\text{SplitWorkerAdapters}(\mathcal{A})$$

1. **The Codebase Splitting Hazard**:
   Creating parallel or divergent backend implementations (such as `src/backend/adapters/worker/` or inline mock route arrays in `httpsAdapter.ts`) causes feature and bug drift between deployment environments. Workspaces, storage connections, and database queries work on Vercel Node runtimes but break on Cloudflare Workers edge runtimes.
2. **Unified Core Services Layer (`src/backend/services/core/`)**:
   All database access, authentication logic, storage connection management, and ecosystem queries MUST be centralized into isomorphic, runtime-agnostic modules under `src/backend/services/core/`:
   - `unifiedDb.ts`: Universal `@neondatabase/serverless` query client with automatic environment detection (`SYSTEM_DATABASE_URL_1`, `DATABASE_URL`, `SYSTEM_DATABASE_URL_2`). Operates identically in Node.js and Cloudflare Workers edge environments without TCP connection pool limits.
   - `authCore.ts`: Universal authentication, system administrator credentials resolution, user directory lookup, and session creation.
   - `storageCore.ts` (or `backblazeCore.ts`): Multi-cloud storage connections CRUD (Backblaze B2, S3, Cloudflare R2) and credential testing via `@aws-sdk/client-s3`.
   - `workspaceCore.ts`: Workspaces CRUD, canonical folder naming (`ultrst_<app>_<user>_<name>`), and active workspace state.
3. **Single Facade Master Registration (Law L7)**:
   The master backend facade `src/backend/<AppName>Backend.ts` MUST expose these core services under `<AppName>Backend.services.*`.
4. **Dual-Ingress Delegation Invariant**:
   Both platform ingress handlers:
   - Platform Ingress 1: Vercel Express AppFactory / Next.js API route handlers
   - Platform Ingress 2: Cloudflare Workers `httpsAdapter.ts` fetch handler
   MUST delegate directly to the same core services via the facade. Neither ingress may maintain its own independent database pool or mock state.
5. **Static UI Asset Bundling Invariant**:
   `scripts/skipo-build.cjs` MUST ensure frontend UI assets (`dist/` or `dist/client/`) are built before or during the `api` target so that Cloudflare Workers with Assets (`[assets]`) always serves the complete application UI at `https://<app>.workers.dev/`.

