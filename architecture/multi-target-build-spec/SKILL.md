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
- Bundled via: `esbuild src/backend/adapters/httpsAdapter.ts --bundle --platform=neutral --format=esm --outfile=dist/api/worker/index.js`
- Deployed via `wrangler.toml` pointing `main = "dist/api/worker/index.js"`.
- **Wrangler Build Directive Invariant**: `wrangler.toml` MUST declare `[build] command = "npm run build:api"`. This ensures that any direct `wrangler deploy` invocation triggers compilation of `dist/api/worker/index.js` automatically.
- **Universal Build Alias Contract**: `package.json`'s `"build"` script MUST point to `"npm run build:all"`. Headless platforms (like Cloudflare Pages/Workers) run the project's `"build"` command before deploying; running `build:all` guarantees both the fullstack SPA and the Cloudflare worker bundle exist.

## 3. VERCEL FULLSTACK ARCHITECTURE CONTRACT

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
       "api/index.js": { "includeFiles": "node_modules/sql.js/dist/sql-wasm.wasm" }
     },
     "rewrites": [
       { "source": "/api/(.*)", "destination": "/api" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
5. **Dashboard Override Prevention**: In the Vercel Project Settings (under **General > Build & Development Settings**), Framework Preset must be set to **Vite** (or **Other**), with **Build Command** set to `npm run build` and **Output Directory** set to `dist`. When pre-set to "Next.js", Vercel halts before building if `next` is missing from `package.json`.


## 4. LOCKFILE PURITY & PACKAGE MANAGER EXCLUSIVITY

$$\text{LockfileCount}(repo) \equiv 1 \wedge (\text{UsesNpm} \implies \text{NoBunLock}(repo))$$

1. **Cloudflare Frozen Lockfile Conflict Hazard**: Cloudflare Pages/Workers detects `bun.lock` in the repository root and forces `bun install --frozen-lockfile`. When Cloudflare's installed Bun version (`v1.2.15`) encounters a lockfile with `"lockfileVersion": 2`, it fails with `UnknownLockfileVersion: failed to parse lockfile: 'bun.lock'`.
2. **Mandatory Single Lockfile Rule**:
   - If a project uses `npm`, only `package-lock.json` may be committed.
   - `bun.lock`, `bun.lockb`, and `pnpm-lock.yaml` are STRICTLY FORBIDDEN.
   - Zero-byte placeholder lockfiles are prohibited.

## 5. FRAMEWORK DETECTION & ANTI-HALLUCINATION INVARIANT

$$\text{ViteApp}(repo) \implies \text{package.json}.\text{devDependencies} \cap \{\text{'next'}\} = \emptyset$$

1. **Vercel Framework Misdetection Hazard**: Vercel scans `package.json` for framework names. If `"next"` is present in dependencies or devDependencies of a Vite SPA, Vercel falsely identifies the framework as `Next.js` and crashes when the Next.js output directory `.next` is not found.
2. **Clean Dependency Separation**: In Vite-based applications, Next.js dependencies must never be declared in `package.json`. Vercel automatically selects Vite and deploys `dist/` and `api/index.js`.
