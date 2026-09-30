#!/usr/bin/env python3
"""
Aspect 12: Multi-Target Build & Protocol Adapters Generator
Generates:
- Protocol Adapters suite (src/backend/adapters/httpsAdapter.ts)
- Build manifests (config/build/manifests/fullstack.json, api.json)
- Cloudflare Worker configuration (wrangler.toml)
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
        print_generator_report
    )
except ImportError:
    from common import (
        GeneratedFile, GeneratorResult, emit_directory,
        print_generator_report
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

    # 1.1 httpsAdapter.ts (Universal Fetch API / Cloudflare Worker / Vercel Entry)
    adapter_code = f"""/**
 * @file httpsAdapter.ts
 * @description Universal Protocol Adapter converting {backend_import} into a Web Standard Fetch HTTP Server.
 * Deployed to Cloudflare Workers and Vercel Serverless via nodeBridge.
 * Conforms to MULTI_TARGET_BUILD_SPEC Section 2 & Inviolable Laws L8, L23.
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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Workspace-Id',
}};

function jsonRes(data: unknown, status = 200): Response {{
  return new Response(JSON.stringify(data), {{ status, headers: {{ 'Content-Type': 'application/json', ...CORS_HEADERS }} }});
}}

export async function fetchHandler(request: Request, env: Env = {{}}): Promise<Response> {{
  const url = new URL(request.url);
  const {{ pathname, method }} = url;

  // Standard Health Probe Gate
  if (pathname === '/api/health' || pathname === '/health') {{
    return jsonRes({{
      status: 'ok',
      service: '{app_name.lower()}-engine',
      timestamp: new Date().toISOString(),
    }});
  }}

  // CORS Preflight
  if (method === 'OPTIONS') {{
    return new Response(null, {{ status: 204, headers: CORS_HEADERS }});
  }}

  // Non-API UI Asset Fallback (Cloudflare Workers with Assets)
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

const universalHandler = (req: any, res: any) => adaptNodeRequest(req, res, fetchHandler);
universalHandler.fetch = fetchHandler;

export default universalHandler;
"""
    files.append(GeneratedFile(
        relative_path="src/backend/adapters/httpsAdapter.ts",
        content=adapter_code,
        description="Universal Protocol Adapter exposing Backend Facade via Web Standard Fetch API and nodeBridge."
    ))

    # 2. Build manifests
    fullstack_manifest = {
        "target": "fullstack",
        "include": ["frontend", "backend", "libraries", "frontend-state"],
        "exclude": []
    }
    api_manifest = {
        "target": "api",
        "entry": "src/backend/adapters/httpsAdapter.ts",
        "include": [
            "backend/adapters",
            "backend/services/core",
            "backend/services/*/server",
            "backend/services/*/remote",
            "backend/services/*/repositories",
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

    # 3. wrangler.toml
    wrangler_content = f"""name = "{app_name.lower()}"
main = "dist/api/worker/index.js"
compatibility_date = "2024-10-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "dist"
binding = "ASSETS"
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
        description="Cloudflare Worker deployment manifest."
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
            "fullstack": {"platform": "vercel", "command": "npm run build:fullstack"},
            "api": {"platform": "cloudflare-workers", "command": "npm run build:api"}
        },
        "requiredEnvironment": {
            "serverOnly": ["SKIPO_DATABASE_URL", "SKIPO_SESSION_SECRET"],
            "workerBindings": ["API_ENV", "BUILD_TARGET"]
        }
    }
    files.append(GeneratedFile(
        relative_path=".skipo/project.json",
        content=json.dumps(project_manifest, indent=2) + "\n",
        description="Mandatory Vercel full-stack and Cloudflare Workers API deployment contract."
    ))
    env_example = """# Server-only: configure in Vercel; never expose to client bundles.\nSKIPO_DATABASE_URL=\nSKIPO_SESSION_SECRET=\n# Worker bindings: configure with Wrangler secrets/vars, never commit production values.\nAPI_ENV=production\nBUILD_TARGET=api\n"""
    files.append(GeneratedFile(
        relative_path=".env.example",
        content=env_example,
        description="Portable secret and Worker-binding contract for cloud coding environments."
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
    # 4. vercel.json Contract (Zero functions includeFiles, pure Vite SPA + API rewrites)
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

    skipo_build_script = """#!/usr/bin/env node

/**
 * @file skipo-build.cjs
 * @description Universal build router for Skipo framework applications.
 * Dynamically executes either fullstack or api-only builds based on DEPLOY_TARGET
 * or package.json "skipo.deploy" configuration.
 *
 * OPTIMIZATION: build:api skips Vite frontend build if dist/index.html already exists.
 * This eliminates the redundant ~90s double-compile when running npm run build:all.
 * Pass --force-client or set FORCE_CLIENT_BUILD=true to override.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
    skipo_build_script = """#!/usr/bin/env node

/**
 * @file skipo-build.cjs
 * @description Single Universal Build Pipeline for Skipo framework applications.
 * Conforms to Law L22 (Single Build Pipeline).
 *
 * Compiles all targets in one unified pass:
 * 1. Frontend SPA (Vite) -> dist/
 * 2. Node/Docker Server -> dist/server.cjs
 * 3. Vercel Serverless Function -> api/index.js
 * 4. Cloudflare Worker -> dist/api/worker/index.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

console.log('[skipo-build] Starting Universal Single-Pass Build...');
const startTime = Date.now();

// Ensure output directories exist
fs.mkdirSync(path.join(rootDir, 'api'), { recursive: true });
fs.mkdirSync(path.join(rootDir, 'dist/api/worker'), { recursive: true });

function run(cmd, desc) {
  console.log(`[skipo-build] ${desc}...`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

try {
  // 1. Frontend SPA build
  run('npx vite build', 'Building Vite frontend assets');

  // 2. Local / Docker Node Server build
  run(
    'npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs',
    'Bundling local Node server (dist/server.cjs)'
  );

  // 3. Vercel Serverless Function entrypoint
  run(
    'npx esbuild src/backend/adapters/httpsAdapter.ts --bundle --platform=node --format=esm --packages=external --minify --banner:js="// @generated" --outfile=api/index.js',
    'Bundling Vercel Serverless entrypoint (api/index.js)'
  );

  // 4. Cloudflare Worker entrypoint
  run(
    'npx esbuild src/backend/adapters/httpsAdapter.ts --bundle --platform=neutral --alias:crypto=node:crypto --external:node:crypto --format=esm --outfile=dist/api/worker/index.js',
    'Bundling Cloudflare Worker entrypoint (dist/api/worker/index.js)'
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\\n✨ [skipo-build] Universal build completed successfully in ${duration}s.`);
} catch (error) {
  console.error('\\n❌ [skipo-build] Build failed:', error.message);
  process.exit(error.status || 1);
}
"""
    files.append(GeneratedFile(
        relative_path="scripts/skipo-build.cjs",
        content=skipo_build_script,
        description="Single Universal Build Pipeline script compiling frontend, server, and multi-cloud adapters."
    ))

    required_scripts = {
        "build": "node scripts/skipo-build.cjs",
        "dev": "tsx server.ts",
        "start": "node dist/server.cjs"
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
        result.messages.append("Merged required dual-target build scripts into package.json")
    return result

if __name__ == "__main__":
    from common import parse_generator_args
    args = parse_generator_args("Generate Multi-Target Build suite")
    res = generate_multi_target_suite(Path(args.target_dir), vars(args))
    print_generator_report(res)
