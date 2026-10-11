---
name: multi-target-build-spec
description: Formal specification for Multi-Target Builds (Vercel Serverless & Cloudflare Workers API) with Universal Protocol Adapters and Single Universal Bundles.
---

# MULTI_TARGET_BUILD_SPEC: PROTOCOL ADAPTERS & BUILD TARGETS

$$\text{ValidTarget}(\mathcal{A}, \tau) \iff (\tau \in \{\text{universal-single-bundle}\}) \wedge \text{SingleSource}(\mathcal{A}) \wedge \text{Adapters}(\mathcal{A})$$

## 0. ARCHITECTURAL PRINCIPLE

One source tree. One universal backend facade (`<AppName>Backend.ts`). One single universal polyglot backend artifact (`api/index.js`) and one static frontend distribution (`dist/`). Protocol adapters for runtime execution environments.

```
src/
├── frontend/                     # Pure UI components, views, hooks (SPA)
├── frontend-state/               # Client UI stores & events (SPA)
├── backend/                      # Universal backend plane (ALL runtimes)
│   ├── <AppName>Backend.ts       # UNIVERSAL BACKEND FACADE (Business logic, orchestrations, services)
│   │                               - Consumed directly by Frontend in-process
│   │                               - Consumed internally by Protocol Adapters
│   ├── adapters/                 # PROTOCOL ADAPTERS
│   │   ├── universalEntry.ts     # POLYGLOT ROOT: Cloudflare ExportedHandler { fetch }, Node Server, Vercel
│   │   ├── httpsAdapter.ts       # Web Standard Fetch routing & asset fallback
│   │   ├── nodeBridge.ts         # Node HTTP IncomingMessage/ServerResponse to Request/Response bridge
│   │   └── vaultRoutes.ts        # Scoped credential vault HTTP endpoints
│   ├── orchestrations/           # Context-neutral composition graphs (FLAT)
│   ├── services/                 # Encapsulated modular services
│   │   └── core/                 # Isomorphic core engines (unifiedDb, authCore, b2DirectCore, etc.)
│   └── gateway/                  # Gateway transport & registry
└── libraries/                    # Environment-neutral pure shared code
```

## 1. UNIVERSAL BUILD TAXONOMY

| Dimension | Universal SPA (`dist/`) | Universal Polyglot Backend (`api/index.js`) |
| :--- | :--- | :--- |
| **Target Runtime** | Browser CDN / Cloudflare Assets / Vercel Static | Cloudflare Workers / Vercel Serverless / Node HTTP |
| **Primary Purpose** | Fullstack User Experience & Client SPA | Headless & Fullstack Unified API Control Plane |
| **Entrypoint** | `src/main.tsx` via `vite.config.ts` | `src/backend/adapters/universalEntry.ts` via esbuild |
| **Output Path** | `dist/` | `api/index.js` |
| **Deploy Config** | `vercel.json` (`outputDirectory: "dist"`) | `wrangler.toml` (`main = "api/index.js"`) |
| **Compiler** | `vite build` | `esbuild` (`--platform=neutral --format=esm '--external:node:*'`) |

## 2. PROTOCOL ADAPTER & CLOUDFLARE WORKERS INVARIANTS

### 2.1 The ExportedHandler Object Invariant (Blocking)
Cloudflare Workers V8 isolate startup strictly validates the default export shape. The default export MUST be an object literal containing a `fetch` method:
```typescript
// ✅ REQUIRED by Cloudflare Workers runtime
export default {
  async fetch(request: Request, env: Env = {}, ctx?: any): Promise<Response> {
    return fetchHandler(request, env);
  },
};
```
> [!CAUTION]
> **Forbidden Function Export**: Exporting a function with an attached `.fetch` property (e.g. `universalHandler.fetch = fetchHandler; export default universalHandler;`) is **strictly invalid**. The Cloudflare isolate will reject initialization, causing the Worker to become unresponsive and Cloudflare to return its default HTML 404 page ("There is nothing here yet") for all routes.

### 2.2 Cloudflare Assets Routing Invariant (`run_worker_first = true`)
In `wrangler.toml`, `[assets]` MUST configure `run_worker_first = true`:
```toml
[assets]
directory = "./dist"
binding = "ASSETS"
run_worker_first = true
not_found_handling = "single-page-application"
```
> [!WARNING]
> Never set `run_worker_first` to an array of globs (e.g. `["/api/*"]`). Array glob routing fails on certain Cloudflare edge nodes, dropping API requests to static storage and returning 404. Setting `run_worker_first = true` ensures the Worker handles all ingress routing.

### 2.3 Asset Pass-Through Invariant & Zero Redirect Loop (`ERR_TOO_MANY_REDIRECTS`)
In `httpsAdapter.ts`, non-API requests must be delegated directly to `env.ASSETS.fetch(request)` without any path rewrites:
```typescript
// 7. Assets fallback for Frontend SPA
if (env.ASSETS && typeof env.ASSETS.fetch === 'function' && !pathname.startsWith('/api/')) {
  return await env.ASSETS.fetch(request);
}
```
> [!CAUTION]
> **Zero Manual `/index.html` Rewrites**: Never rewrite `request.url` or `pathname` to `/index.html` before calling `env.ASSETS.fetch()`. Cloudflare Assets automatically canonicalizes and issues a `301 Moved Permanently` redirect from `/index.html` to `/`. Rewriting the path inside the Worker creates an infinite redirect loop (`ERR_TOO_MANY_REDIRECTS`). `not_found_handling = "single-page-application"` already handles SPA fallback natively.

### 2.4 Cloudflare V8 Isolate Code Generation Ban (`EvalError 10021`)
Cloudflare Workers enforces strict V8 isolate security policies prohibiting runtime string-to-code evaluation.
- `new Function(...)` and `eval(...)` are **strictly forbidden** in all production dependencies and adapters.
- Node.js native modules (`node:fs`, `node:path`, `node:http`) must be dynamically imported via native `await import('node:*')` inside runtime-guarded blocks (e.g. `typeof process !== 'undefined' && process.argv`), and marked external during esbuild via `'--external:node:*'`.

## 3. ZERO-TOUCH GITHUB CI/CD UNIFICATION

A single push to `main` deploys to both platforms simultaneously:
1. **Push to `main`**: Triggers webhook builds on both Vercel and Cloudflare.
2. **On Vercel**:
   - Executes `npm run build` (`scripts/skipo-build.cjs`).
   - Packages `dist/` as static assets and `api/index.js` as the serverless function.
3. **On Cloudflare Workers**:
   - Executes `npm run build` via `[build] command = "npm run build"` in `wrangler.toml`.
   - Deploys `api/index.js` as the Worker bundle.
   - Uploads `./dist` to Cloudflare Assets CDN.
   - Serves frontend SPA at `https://<app>.workers.dev/` and API at `https://<app>.workers.dev/api/*`.

## 4. SINGLE UNIVERSAL BUILD PIPELINE (`scripts/skipo-build.cjs`)

```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(rootDir, 'api'), { recursive: true });

function run(cmd, desc) {
  console.log(`[skipo-build] ${desc}...`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

// 1. Frontend SPA build
run('npx vite build', 'Building Vite frontend assets');

// 2. Single Universal Polyglot Backend bundle
run(
  "npx esbuild src/backend/adapters/universalEntry.ts --bundle --platform=neutral --format=esm --alias:crypto=node:crypto '--external:node:*' --outfile=api/index.js",
  'Bundling Single Universal Polyglot Backend (api/index.js)'
);
```

## 5. LOCKFILE PURITY & PACKAGE MANAGER EXCLUSIVITY

$$\text{LockfileCount}(repo) \equiv 1 \wedge (\text{UsesNpm} \implies \text{NoBunLock}(repo))$$

1. Cloudflare CI detects `bun.lock` or conflicting lockfiles and halts on frozen lockfile version mismatches.
2. Only `package-lock.json` may be committed for npm projects.

## 6. ZERO-DRIFT ISOMORPHIC CORE SERVICES (`src/backend/services/core/`)

All database, storage, auth, and credential operations reside in runtime-agnostic core modules:
- `unifiedDb.ts`: Neon Serverless HTTP driver for database queries.
- `b2DirectCore.ts`: Native `fetch`-based Backblaze B2 REST client (zero dependencies).
- `credentialVaultCore.ts`: AES-256-GCM + PBKDF2 workspace-scoped secret encryption.
- `workspaceFileCore.ts`: Runtime-agnostic workspace I/O using dynamic Node imports or B2 direct storage.
