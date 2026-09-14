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
| **Primary Platform** | Vercel (Next.js / Node / Vite) | Cloudflare Workers / Edge Runtime |
| **Frontend Assets** | Included (`src/frontend/`, `src/frontend-state/`) | Excluded (zero UI code) |
| **Client Services** | Included (`src/backend/services/*/client/`) | Excluded (tree-shaken out) |
| **Server Services** | Included (`src/backend/services/*/server/`) | Included |
| **Orchestrations** | Included (flat context-neutral) | Included (flat context-neutral) |
| **Entrypoint** | `src/frontend/app.tsx` or `app/` | `src/backend/adapters/httpsAdapter.ts` |
| **Output Path** | `dist/` or `.next/` | `dist/api/worker/index.js` |

## 2. PROTOCOL ADAPTER INVARIANT

Every API build target entry MUST reside under `src/backend/adapters/httpsAdapter.ts`.
It must export a standard Fetch API handler:
```typescript
export default {
  async fetch(request: Request, env?: Record<string, unknown>): Promise<Response> {
    // Routes HTTP wire requests to <AppName>Backend orchestrations and services
  }
};
```
