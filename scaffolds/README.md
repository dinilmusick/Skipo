# Skipo App Scaffolds for Google AI Studio

Production-ready, zero-boilerplate starter templates designed for instant copy-pasting into Google AI Studio, Project IDX, or fresh repositories.

## Available Templates

| Directory | Framework | Description | Target Clouds |
|---|---|---|---|
| [`vite/`](./vite) | **Vite + React 19 + Express** | Fast, lightweight SPA with bundled Express server and Cloudflare Workers API adapter. | Vercel, Cloudflare Workers |
| [`nextjs/`](./nextjs) | **Next.js 15/16 App Router** | Fullstack Next.js with unified build script and Cloudflare Workers API adapter. | Vercel, Cloudflare Workers |

---

## What Comes Pre-Wired in Every Scaffold

Both scaffolds share the **Zero-Drift Unified Core Architecture** (Skipo Law L23):
1. **Unified Database (`src/backend/services/core/unifiedDb.ts`)**:
   - Isomorphic Neon HTTP driver.
   - Runs identically in Node.js, Vercel Serverless, and Cloudflare Workers with zero native binary crashes.
2. **Universal Authentication (`src/backend/services/core/authCore.ts`)**:
   - User login and registration using the shared `"ultrst-users"` table.
   - System administrator credentials verification.
3. **Workspace Management (`src/backend/services/core/workspaceCore.ts`)**:
   - Multi-tenant workspace CRUD stored in user profiles.
4. **Cloud Storage Engine (`src/backend/services/core/storageCore.ts`)**:
   - Pre-wired connections for Backblaze B2, Supabase Storage, and AWS S3.
5. **Universal Protocol Adapter (`src/backend/adapters/httpsAdapter.ts`)**:
   - Exposes all core routes and delegates non-API requests to static asset delivery (`env.ASSETS.fetch(request)`).
6. **Unified UI & Theming (`src/libraries/skipo/ui/`)**:
   - Full Skipo design token system (`--skipo-*`), `SkipoThemeProvider`, and Neo-Brutalist base components.
7. **Frontend Auth Portal (`src/frontend/components/auth/UserAuthPage/`)**:
   - Production-ready Sign In / Register UI with client-side state management (`appStore.ts`).
8. **Automated Renaming (`Skipo/scripts/rename_app.py`)**:
   - Single command to rename all template tokens across the codebase.
9. **Full Governance Kernel (`Skipo/`)**:
   - Embedded `AGENTS.md`, validators (`checklists/`), generators (`generators/`), and architecture skills (`architecture/`).
   - Cleaned of any heavy folders (`node_modules/`, `packages/`, `dist/`).

---

## Quickstart

### 1. Copy the Chosen Template
Copy either `scaffolds/vite/` or `scaffolds/nextjs/` into your destination directory or Google AI Studio project root.

### 2. Rename the Application
Run the automated rename script:
```bash
python3 Skipo/scripts/rename_app.py "YourAppName"
```
This updates:
- Facade file: `src/backend/AppBackend.ts` → `src/backend/YourAppNameBackend.ts`
- Imports, config files, `wrangler.toml`, `package.json`, `index.html`, and `metadata.json`.

### 3. Install & Run
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build both fullstack and worker targets
npm run build:all
```
