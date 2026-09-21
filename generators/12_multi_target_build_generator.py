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
    
    # 1. httpsAdapter.ts (Fetch API / Cloudflare Worker Entry)
    adapter_code = f"""/**
 * @file httpsAdapter.ts
 * @description Protocol Adapter converting Universal {backend_import} into a Web Standard Fetch HTTP Server asset.
 * Deployed to Cloudflare Workers / Headless Serverless API targets.
 * Conforms to MULTI_TARGET_BUILD_SPEC Section 2 & Inviolable Law L8.
 */

import {{ {backend_import} }} from '../{backend_import}';

export interface Env {{
  [key: string]: unknown;
}}

export default {{
  async fetch(request: Request, env: Env = {{}}): Promise<Response> {{
    const url = new URL(request.url);
    const {{ pathname, method }} = url;

    // Standard Health Probe Gate
    if (pathname === '/api/health' || pathname === '/health') {{
      return Response.json({{
        status: 'ok',
        runtime: 'cloudflare-worker',
        timestamp: new Date().toISOString(),
      }});
    }}

    // CORS Preflight
    if (method === 'OPTIONS') {{
      return new Response(null, {{
        status: 204,
        headers: {{
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        }},
      }});
    }}

    // Dynamic Orchestration / Service Dispatch Example
    try {{
      // Service execution can be mapped to {backend_import}
      return Response.json({{
        success: true,
        message: `${backend_import} ready for protocol execution`,
        path: pathname,
      }});
    }} catch (err: unknown) {{
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({{ success: false, error: message }}, {{ status: 500 }});
    }}
  }},
}};
"""
    files.append(GeneratedFile(
        relative_path="src/backend/adapters/httpsAdapter.ts",
        content=adapter_code,
        description="Protocol Adapter exposing Backend Facade via Web Standard Fetch API."
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
    wrangler_content = f"""name = "{app_name.lower()}-api"
main = "dist/api/worker/index.js"
compatibility_date = "2024-09-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build:api"

[vars]
API_ENV = "cloudflare"
BUILD_TARGET = "api"
"""
    files.append(GeneratedFile(
        relative_path="wrangler.toml",
        content=wrangler_content,
        description="Cloudflare Worker deployment manifest."
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
    # 4. Serverless Handler (Vercel Serverless Function entry point)
    serverless_code = f"""/**
 * @file serverless.ts
 * @description Vercel Serverless Function entry point for {app_name}.
 * Strictly adheres to Skipo governance (< 200 lines).
 */

import {{ Request, Response }} from 'express';

let cachedApp: any = null;

export default async function handler(req: Request, res: Response) {{
  try {{
    if (!cachedApp) {{
      const {{ createDepmApp }} = await import('./appFactory');
      cachedApp = await createDepmApp();
    }}
    return cachedApp(req, res);
  }} catch (err: unknown) {{
    console.error('[Serverless] Handler Error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {{
      res.status(500).json({{ error: `Serverless Initialization Error: ${{msg}}` }});
    }}
  }}
}}
"""
    files.append(GeneratedFile(
        relative_path="src/backend/server/serverless.ts",
        content=serverless_code,
        description="Vercel Serverless Function entry point wrapping Express app factory."
    ))

    # 5. vercel.json Contract
    vercel_config = {
        "$schema": "https://openapi.vercel.sh/vercel.json",
        "framework": "vite",
        "buildCommand": "npm run build",
        "outputDirectory": "dist",
        "functions": {
            "api/index.js": {
                "includeFiles": "node_modules/sql.js/dist/sql-wasm.wasm"
            }
        },
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

    required_scripts = {
        "build:fullstack": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs && esbuild src/backend/server/serverless.ts --bundle --platform=node --format=esm --packages=external --minify --banner:js=\"// @generated\" --outfile=api/index.js",
        "build:api": "esbuild src/backend/adapters/httpsAdapter.ts --bundle --platform=neutral --format=esm --outfile=dist/api/worker/index.js",
        "build:all": "npm run build:fullstack && npm run build:api",
        "validate:api": "tsc -p tsconfig.api.json --noEmit"
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
        description="Dual Vercel full-stack and Cloudflare API build commands."
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
