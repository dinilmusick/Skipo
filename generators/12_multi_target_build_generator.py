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
        purpose="Protocol Adapter exposing Backend Facade via Web Standard Fetch API."
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
        purpose="Build manifest defining includes/excludes for FULLSTACK target."
    ))
    files.append(GeneratedFile(
        relative_path="config/build/manifests/api.json",
        content=json.dumps(api_manifest, indent=2) + "\n",
        purpose="Build manifest defining includes/excludes for API target."
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
        purpose="Cloudflare Worker deployment manifest."
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
    return result

if __name__ == "__main__":
    from common import parse_generator_args
    args = parse_generator_args("Generate Multi-Target Build suite")
    res = generate_multi_target_suite(Path(args.target_dir), vars(args))
    print_generator_report(res)
