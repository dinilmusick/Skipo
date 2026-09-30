#!/usr/bin/env python3
"""
Aspect 12: Multi-Target Build & Protocol Adapters Generator
Generates:
- Single Universal Polyglot Entrypoint (src/backend/adapters/universalEntry.ts)
- Universal Fetch Protocol Adapter (src/backend/adapters/httpsAdapter.ts)
- Node HTTP to Web Standard Bridge (src/backend/adapters/nodeBridge.ts)
- Cloudflare Worker configuration (wrangler.toml) with run_worker_first = true
- Single Universal Build Pipeline (scripts/skipo-build.cjs)
- API target TypeScript configuration (tsconfig.api.json)
"""

from pathlib import Path
from typing import List, Dict, Any
import json
import sys
import time

try:
    from .common import (
        GeneratedFile, GeneratorResult, emit_directory,
        print_generator_report, parse_generator_args
    )
except ImportError:
    from common import (
        GeneratedFile, GeneratorResult, emit_directory,
        print_generator_report, parse_generator_args
    )

GENERATOR_ID = "12_multi_target_build_generator"
GENERATOR_TITLE = "MULTI_TARGET_BUILD_SPEC Canonical Generator"

def generate_multi_target_suite(target_dir: Path, params: Dict[str, Any]) -> GeneratorResult:
    start_time = time.time()
    files: List[GeneratedFile] = []
    
    app_name = params.get("name") or "SkipoApp"
    backend_import = params.get("backend_facade") or f"{app_name}Backend"
    
    # 1. nodeBridge.ts (Node.js HTTP to Web Standard fetch bridge)
    node_bridge_code = """/**
 * @file nodeBridge.ts
 * @description Bridges Node.js IncomingMessage / ServerResponse to Web Standard fetch.
 * Enables identical execution in Node.js (Vercel Serverless / local dev) and Cloudflare Workers.
 * Conforms to Skipo Governance (< 100 lines). Zero Express dependency.
 */

export async function adaptNodeRequest(
  req: any,
  res: any,
  fetchHandler: (req: Request, env?: any) => Promise<Response>,
  env?: any
) {
  if (req instanceof Request) {
    return fetchHandler(req, env);
  }

  const protocol = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers.host || 'localhost:3000';
  const url = new URL(req.url || '/', `${protocol}://${host}`);

  let body: any = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body && typeof req.body === 'object') {
      body = JSON.stringify(req.body);
    } else if (typeof req.body === 'string') {
      body = req.body;
    } else {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks).toString();
    }
  }

  const webReq = new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
    body: body && body.length > 0 ? body : undefined,
  });

  const webRes = await fetchHandler(webReq, env || process.env);

  res.statusCode = webRes.status;
  webRes.headers.forEach((val: string, key: string) => {
    res.setHeader(key, val);
  });
  const text = await webRes.text();
  res.end(text);
}
"""
    files.append(GeneratedFile(
        relative_path="src/backend/adapters/nodeBridge.ts",
        content=node_bridge_code,
        description="Node HTTP to Web Standard fetch bridge for Vercel Serverless and Node server."
    ))

    # 1.1 httpsAdapter.ts (Universal Fetch API / Routing / Asset Fallback)
    adapter_code = f"""/**
 * @file httpsAdapter.ts
 * @description Universal Protocol Adapter converting {backend_import} into a Web Standard Fetch HTTP Server.
 * Conforms to MULTI_TARGET_BUILD_SPEC & Inviolable Laws L8, L24 (< 200 lines).
 */

import {{ {backend_import} }} from '../{backend_import}';
import {{ adaptNodeRequest }} from './nodeBridge';

export interface Env {{
  ENVIRONMENT?: string;
  APP_NAME?: string;
  SYSTEM_DATABASE_URL_1?: string;
  DATABASE_URL?: string;
  ASSETS?: {{ fetch: (request: Request) => Promise<Response> }};
  [key: string]: unknown;
}}

const CORS_HEADERS = {{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Workspace-Id, X-Vault-Key',
}};

function jsonRes(data: unknown, status = 200): Response {{
  return new Response(JSON.stringify(data), {{ status, headers: {{ 'Content-Type': 'application/json', ...CORS_HEADERS }} }});
}}

export async function fetchHandler(request: Request, env: Env = {{}}): Promise<Response> {{
  const url = new URL(request.url);
  const {{ pathname, method }} = url;

  // CORS Preflight
  if (method === 'OPTIONS') {{
    return new Response(null, {{ status: 204, headers: CORS_HEADERS }});
  }}

  // Standard Health Probe Gate
  if (pathname === '/api/health' || pathname === '/health') {{
    return jsonRes({{
      status: 'ok',
      service: '{app_name.lower()}-engine',
      timestamp: new Date().toISOString(),
    }});
  }}

  // Non-API UI Asset Fallback (Cloudflare Workers with Assets)
  // Law L24: Pass request as-is. not_found_handling='single-page-application' serves index.html natively.
  // Manual /index.html rewrites are banned to prevent infinite redirect loops.
  if (env.ASSETS && typeof env.ASSETS.fetch === 'function' && !pathname.startsWith('/api/')) {{
    return await env.ASSETS.fetch(request);
  }}

  try {{
    return jsonRes({{
      success: true,
      message: `${backend_import} ready for protocol execution`,
      path: pathname,
    }});
  }} catch (err: unknown) {{
    const message = err instanceof Error ? err.message : String(err);
    return jsonRes({{ success: false, error: message }}, 500);
  }}
}}

export default {{
  async fetch(request: Request, env: Env = {{}}, ctx?: any): Promise<Response> {{
    return fetchHandler(request, env);
  }},
}};

export {{ adaptNodeRequest }};
"""
    files.append(GeneratedFile(
        relative_path="src/backend/adapters/httpsAdapter.ts",
        content=adapter_code,
        description="Universal Protocol Adapter exposing Backend Facade via Web Standard Fetch API."
    ))

    # 1.2 universalEntry.ts (Single Universal Polyglot Entrypoint: CF Workers, Vercel, Node)
    universal_entry_code = f"""/**
 * @file universalEntry.ts
 * @description Single Universal Polyglot Backend Entrypoint for {app_name}.
 * Runs identically on Cloudflare Workers, Vercel Serverless, and Local Node.js (Law L8, L22, L24).
 */

import {{ fetchHandler, Env }} from './httpsAdapter';
import {{ adaptNodeRequest }} from './nodeBridge';

// Polyglot Universal Handler (Node / Vercel Serverless)
const universalHandler = async function (req: any, res?: any, env?: any): Promise<any> {{
  if (req && res && typeof res.writeHead === 'function') {{
    return adaptNodeRequest(req, res, (webReq) => fetchHandler(webReq, (process.env as unknown as Env) || {{}}));
  }}
  return fetchHandler(req, env || res);
}};

// Standalone Node.js server launcher (for `node api/index.js` / Docker)
if (
  typeof process !== 'undefined' &&
  process.argv &&
  (process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('server.js'))
) {{
  (async () => {{
    try {{
      const http = await import('node:http');
      const fs = await import('node:fs');
      const path = await import('node:path');

      const port = Number(process.env.PORT) || 3000;
      const distPath = path.resolve(process.cwd(), 'dist');

      const server = http.createServer(async (req, res) => {{
        const url = req.url || '/';
        if (url.startsWith('/api/') || url === '/api' || url.startsWith('/health')) {{
          return adaptNodeRequest(req, res, (webReq) => fetchHandler(webReq, (process.env as unknown as Env) || {{}}));
        }}

        const filePath = path.join(distPath, url.split('?')[0]);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {{
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {{
            '.html': 'text/html', '.js': 'application/javascript',
            '.css': 'text/css', '.json': 'application/json',
            '.png': 'image/png', '.svg': 'image/svg+xml',
          }};
          res.writeHead(200, {{ 'Content-Type': mimeTypes[ext] || 'application/octet-stream' }});
          return fs.createReadStream(filePath).pipe(res);
        }}

        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {{
          res.writeHead(200, {{ 'Content-Type': 'text/html' }});
          return fs.createReadStream(indexPath).pipe(res);
        }}

        res.writeHead(404, {{ 'Content-Type': 'text/plain' }});
        res.end('Not Found');
      }});

      server.listen(port, () => {{
        console.log(`[{app_name} Universal Server] Listening on http://localhost:${{port}}`);
      }});
    }} catch (e) {{
      // In non-node environments, ignore
    }}
  }})();
}}

// Cloudflare Workers ExportedHandler — Law L24: MUST be plain object literal {{ fetch }}
export default {{
  async fetch(request: Request, env: Env = {{}}, ctx?: any): Promise<Response> {{
    return fetchHandler(request, env);
  }},
}};

export {{ fetchHandler, adaptNodeRequest, universalHandler }};
"""
    files.append(GeneratedFile(
        relative_path="src/backend/adapters/universalEntry.ts",
        content=universal_entry_code,
        description="Single Universal Polyglot Entrypoint for Node, Vercel, and Cloudflare Workers."
    ))

    # 2. Build manifests
    fullstack_manifest = {
        "target": "fullstack",
        "include": ["frontend", "backend", "libraries", "frontend-state"],
        "exclude": []
    }
    api_manifest = {
        "target": "api",
        "entry": "src/backend/adapters/universalEntry.ts",
        "include": [
            "backend/adapters",
            "backend/services/core",
            "backend/orchestrations",
            "backend/gateway",
            "libraries"
        ],
        "exclude": ["frontend", "frontend-state", "**/client/**"]
    }
    files.append(GeneratedFile(
        relative_path="config/build/manifests/fullstack.json",
        content=json.dumps(fullstack_manifest, indent=2) + "\n",
        description="Build manifest defining includes/excludes for FULLSTACK target."
    ))
    files.append(GeneratedFile(
        relative_path="config/build/manifests/api.json",
        content=json.dumps(api_manifest, indent=2) + "\n",
        description="Build manifest defining includes/excludes for API target."
    ))

    # 3. wrangler.toml (Law L22, L24: main = api/index.js, run_worker_first = true)
    wrangler_content = f"""name = "{app_name.lower()}-engine"
main = "api/index.js"
compatibility_date = "2024-10-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist"
binding = "ASSETS"
run_worker_first = true
not_found_handling = "single-page-application"

[build]
command = "npm run build"

[vars]
API_ENV = "cloudflare"
BUILD_TARGET = "api"
SYSTEM_DATABASE_URL_1 = ""
"""
    files.append(GeneratedFile(
        relative_path="wrangler.toml",
        content=wrangler_content,
        description="Cloudflare Worker deployment manifest configured for universal single artifact."
    ))

    # 3.1. Zero-Drift Universal Database Client (Law L23)
    unified_db_code = f"""/**
 * @file unifiedDb.ts
 * @description Isomorphic Database Client using Neon Serverless HTTP driver.
 * Operates identically across Node.js, Vercel Serverless, and Cloudflare Workers (Law L23).
 * Conforms to Skipo Governance (< 200 lines).
 */

import {{ neon }} from '@neondatabase/serverless';

declare const process: any;

export interface UnifiedQueryResult<T = any> {{
  rows: T[];
  rowCount: number;
}}

export function cleanDbUrl(url?: unknown): string {{
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/^["']|["']$/g, '');
}}

export function getUnifiedDbUrl(env?: Record<string, unknown>): string {{
  const fromEnv =
    cleanDbUrl(env?.SYSTEM_DATABASE_URL_1) ||
    cleanDbUrl(env?.DATABASE_URL) ||
    cleanDbUrl(env?.SYSTEM_DATABASE_URL_2);

  if (fromEnv) return fromEnv;

  if (typeof process !== 'undefined' && process.env) {{
    return (
      cleanDbUrl(process.env.SYSTEM_DATABASE_URL_1) ||
      cleanDbUrl(process.env.DATABASE_URL) ||
      cleanDbUrl(process.env.SYSTEM_DATABASE_URL_2) ||
      cleanDbUrl(process.env.SYSTEM_DATABASE_URL_3) ||
      ''
    );
  }}

  return '';
}}

export async function queryUnifiedDb<T = any>(
  sqlText: string,
  params: any[] = [],
  env?: Record<string, unknown>
): Promise<UnifiedQueryResult<T>> {{
  const dbUrl = getUnifiedDbUrl(env);
  if (!dbUrl) {{
    throw new Error('[UnifiedDB] No database URL configured in environment.');
  }}

  const sql = neon(dbUrl);
  try {{
    const rows = (await sql.query(sqlText, params)) as T[];
    return {{
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
    }};
  }} catch (err: any) {{
    console.error('[UnifiedDB] Query execution error:', err.message);
    throw err;
  }}
}}
"""
    files.append(GeneratedFile(
        relative_path="src/backend/services/core/unifiedDb.ts",
        content=unified_db_code,
        description="Zero-Drift universal Neon database client for Vercel and Cloudflare (Law L23)."
    ))

    project_manifest = {
        "kind": "skipo-application",
        "schemaVersion": 1,
        "deploymentTargets": {
            "fullstack": {"platform": "vercel", "command": "npm run build"},
            "api": {"platform": "cloudflare-workers", "command": "npm run build"}
        },
        "requiredEnvironment": {
            "serverOnly": ["SYSTEM_DATABASE_URL_1"],
            "workerBindings": ["API_ENV", "BUILD_TARGET"]
        }
    }
    files.append(GeneratedFile(
        relative_path=".skipo/project.json",
        content=json.dumps(project_manifest, indent=2) + "\n",
        description="Mandatory Vercel full-stack and Cloudflare Workers API deployment contract."
    ))

    tsconfig_api = {
        "extends": "./tsconfig.json",
        "compilerOptions": {"noEmit": False, "outDir": "./dist/api"},
        "include": ["src/backend/**/*.ts", "src/libraries/**/*.ts"],
        "exclude": ["src/frontend", "src/frontend-state", "**/client/**", "**/*.test.ts"]
    }
    files.append(GeneratedFile(
        relative_path="tsconfig.api.json",
        content=json.dumps(tsconfig_api, indent=2) + "\n",
        description="Cloudflare API TypeScript target excluding browser-only code."
    ))

    # 4. vercel.json Contract
    vercel_config = {
        "$schema": "https://openapi.vercel.sh/vercel.json",
        "framework": "vite",
        "buildCommand": "npm run build",
        "outputDirectory": "dist",
        "rewrites": [
            {"source": "/api/(.*)", "destination": "/api"},
            {"source": "/(.*)", "destination": "/index.html"}
        ]
    }
    files.append(GeneratedFile(
        relative_path="vercel.json",
        content=json.dumps(vercel_config, indent=2) + "\n",
        description="Vercel full-stack deployment contract supporting SPA rewrites and Serverless Function."
    ))

    # 5. scripts/skipo-build.cjs (Single Universal Artifact Pipeline: Law L22)
    skipo_build_script = """#!/usr/bin/env node

/**
 * @file skipo-build.cjs
 * @description Single Universal Build Pipeline for Skipo framework applications.
 * Conforms to Law L22 (Single Build Pipeline).
 *
 * Compiles all targets into ONE universal artifact set:
 * 1. Frontend SPA (Vite) -> dist/
 * 2. Universal Polyglot Backend (esbuild) -> api/index.js
 *    (Serves Local Node, Vercel Serverless, and Cloudflare Workers identically)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

console.log('[skipo-build] Starting Universal Single-Pass Build...');
const startTime = Date.now();

// Ensure output directories exist
fs.mkdirSync(path.join(rootDir, 'api'), { recursive: true });

function run(cmd, desc) {
  console.log(`[skipo-build] ${desc}...`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

try {
  // 1. Frontend SPA build
  run('npx vite build', 'Building Vite frontend assets');

  // 2. Single Universal Polyglot Backend bundle
  run(
    "npx esbuild src/backend/adapters/universalEntry.ts --bundle --platform=neutral --format=esm --alias:crypto=node:crypto '--external:node:*' --outfile=api/index.js",
    'Bundling Single Universal Polyglot Backend (api/index.js)'
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\\n✨ [skipo-build] Universal single-artifact build completed in ${duration}s.`);
} catch (error) {
  console.error('\\n❌ [skipo-build] Build failed:', error.message);
  process.exit(error.status || 1);
}
"""
    files.append(GeneratedFile(
        relative_path="scripts/skipo-build.cjs",
        content=skipo_build_script,
        description="Single Universal Build Pipeline script compiling frontend and universal polyglot backend."
    ))

    required_scripts = {
        "build": "node scripts/skipo-build.cjs",
        "dev": "tsx server.ts",
        "start": "node api/index.js"
    }
    package_path = target_dir / "package.json"
    existing_package: Dict[str, Any] = {}
    if package_path.exists():
        try:
            existing_package = json.loads(package_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError(f"Cannot merge build scripts into invalid package.json: {error}") from error
    package_content = existing_package or {"name": app_name.lower(), "private": True}
    package_content["scripts"] = {**package_content.get("scripts", {}), **required_scripts}
    files.append(GeneratedFile(
        relative_path="package.json",
        content=json.dumps(package_content, indent=2) + "\n",
        description="Unified build commands for Vercel, Cloudflare, and Node."
    ))

    result = emit_directory(
        target_dir=target_dir,
        files=files,
        dry_run=params.get("dry_run", False),
        force=params.get("force", False)
    )
    result.generator_id = GENERATOR_ID
    result.generator_title = GENERATOR_TITLE
    result.duration_ms = (time.time() - start_time) * 1000
    if existing_package and not params.get("dry_run", False):
        package_path.write_text(json.dumps(package_content, indent=2) + "\n", encoding="utf-8")
        result.messages.append("Merged required universal build scripts into package.json")
    return result

def main():
    args = parse_generator_args("MULTI_TARGET_BUILD_SPEC Canonical Generator")
    target_path = Path(args.get("target_path") or ".").resolve()
    res = generate_multi_target_suite(target_path, args)
    if args.get("json"):
        print(json.dumps(res.to_dict(), indent=2))
    else:
        print_generator_report(res)
    sys.exit(0 if res.success else 1)

if __name__ == "__main__":
    main()
