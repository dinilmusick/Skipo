#!/usr/bin/env python3
"""Generate provider packaging around one Web-standard Fetch application."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


SCAFFOLD_APP_SOURCE = """import { externalInterfaces } from "./backend/__SKIPO_BACKEND_ENTRY__.js";
import { proxyLuthAuthRequest } from "./backend/auth/luthSession.js";

/**
 * Canonical Web-standard application entrypoint.
 * All provider adapters delegate to this handler; add application routes here.
 */
export interface SkipoEnv {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  [key: string]: unknown;
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

export async function fetch(
  request: Request,
  env: SkipoEnv = {},
  _ctx?: unknown,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const authProxy = await proxyLuthAuthRequest(request);
  if (authProxy) return authProxy;
  const mcp = await externalInterfaces.mcp(request);
  if (mcp) return mcp;
  const http = await externalInterfaces.http(request);
  if (http) return http;
  if (url.pathname === "/health" || url.pathname === "/api/health") {
    return Response.json({ status: "ok", runtime: "fetch" }, { headers: cors });
  }
  if (env.ASSETS && !url.pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
  }
  return Response.json({ error: "Not Found" }, { status: 404, headers: cors });
}

export default { fetch };
"""

APP_SOURCE = SCAFFOLD_APP_SOURCE

ADAPTER_APP_SOURCE = """import { fetchHandler } from "./backend/adapters/httpsAdapter.js";

export async function fetch(request: Request, env: Record<string, unknown> = {}, _ctx?: unknown): Promise<Response> {
  return fetchHandler(request, env as any);
}

export default { fetch };
"""

CLOUDFLARE_SOURCE = """import { fetch } from "../app.js";

/** Cloudflare Worker adapter; application behavior remains in ../app.ts. */
export default {
  fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    return fetch(request, env, ctx);
  },
};
"""

VERCEL_SOURCE = """import { fetch } from "../app.js";

/** Vercel Edge adapter; application behavior remains in ../app.ts. */
export const config = { runtime: "edge" };
export default function handler(request: Request): Promise<Response> {
  return fetch(request);
}
"""

NODE_SOURCE = """import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fetch } from "../app.js";

const root = process.cwd();
const assets = {
  async fetch(request: Request): Promise<Response> {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const requested = resolve(root, "dist/client", `.${pathname}`);
    const base = resolve(root, "dist/client");
    if (requested !== base && !requested.startsWith(base + sep)) {
      return new Response("Not Found", { status: 404 });
    }
    const candidates = [requested, resolve(base, "index.html")];
    for (const candidate of candidates) {
      try {
        const body = await readFile(candidate);
        const types: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json",
          ".svg": "image/svg+xml",
          ".png": "image/png",
        };
        return new Response(body, {
          headers: { "content-type": types[extname(candidate)] || "application/octet-stream" },
        });
      } catch { /* Try the SPA index fallback. */ }
    }
    return new Response("Not Found", { status: 404 });
  },
};

const port = Number(process.env.PORT || 3000);
const server = createServer(async (incoming, outgoing) => {
  try {
    const protocol = incoming.headers["x-forwarded-proto"] || "http";
    const host = incoming.headers.host || "localhost";
    const chunks: Uint8Array[] = [];
    for await (const chunk of incoming) chunks.push(
      typeof chunk === "string" ? Buffer.from(chunk) : chunk,
    );
    const body = incoming.method === "GET" || incoming.method === "HEAD"
      ? undefined
      : Buffer.concat(chunks);
    const request = new Request(`${protocol}://${host}${incoming.url || "/"}`, {
      method: incoming.method,
      headers: incoming.headers as HeadersInit,
      body,
    });
    const response = await fetch(request, { ...process.env, ASSETS: assets });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end(error instanceof Error ? error.message : "Internal Server Error");
  }
});
server.listen(port, () => console.log(`Skipo Fetch app listening on ${port}`));
"""

BUILD_SCRIPT = r'''#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, cpSync, readdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
function run(bin, args) {
  const result = spawnSync(bin, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
function has(name) { return existsSync(resolve(root, name)); }

console.log("[skipo] Building the single Fetch application and provider packages");
if (has("next.config.js") || has("next.config.mjs") || has("next.config.ts")) {
  run("npx", ["next", "build"]);
  mkdirSync(resolve(root, "dist/client/_next"), { recursive: true });
  if (has(".next/static")) cpSync(resolve(root, ".next/static"), resolve(root, "dist/client/_next/static"), { recursive: true });
  if (has("public")) cpSync(resolve(root, "public"), resolve(root, "dist/client"), { recursive: true });
  const appOutput = resolve(root, ".next/server/app");
  if (existsSync(appOutput)) {
    function copyHtmlPages(source, destination) {
      for (const entry of readdirSync(source, { withFileTypes: true })) {
        const from = resolve(source, entry.name);
        const to = resolve(destination, entry.name);
        if (entry.isDirectory()) copyHtmlPages(from, to);
        else if (entry.isFile() && entry.name.endsWith(".html")) {
          mkdirSync(resolve(to, ".."), { recursive: true });
          copyFileSync(from, to);
        }
      }
    }
    copyHtmlPages(appOutput, resolve(root, "dist/client"));
  }
} else if (has("vite.config.ts") || has("vite.config.js") || has("index.html")) {
  run("npx", ["vite", "build", "--outDir", "dist/client"]);
}
for (const path of [
  "dist/client",
  "dist/providers/cloudflare",
  "dist/providers/vercel",
  "dist/providers/node",
  "api",
]) mkdirSync(resolve(root, path), { recursive: true });

run("npx", [
  "esbuild", "src/providers/cloudflare.ts", "--bundle", "--format=esm",
  "--platform=browser", "--target=es2022",
  "--outfile=dist/providers/cloudflare/worker.js",
]);
run("npx", [
  "esbuild", "src/providers/vercel.ts", "--bundle", "--format=esm",
  "--platform=browser", "--target=es2022",
  "--outfile=api/[...path].js",
]);
run("npx", [
  "esbuild", "src/providers/vercel.ts", "--bundle", "--format=esm",
  "--platform=browser", "--target=es2022",
  "--outfile=mcp.js",
]);
run("npx", [
  "esbuild", "src/providers/node.ts", "--bundle", "--format=esm",
  "--platform=node", "--target=node20", "--packages=external",
  "--outfile=dist/providers/node/server.js",
]);
console.log("[skipo] Provider packaging complete: Cloudflare, Vercel Edge, Node");
'''

def generate_provider_packaging(target: Path, app_name: str = "SkipoApp") -> list[Path]:
    """Create missing Fetch app/provider files and merge the canonical build contract."""
    target = target.resolve()
    created: list[Path] = []
    files = {
        "src/app.ts": APP_SOURCE,
        "src/providers/cloudflare.ts": CLOUDFLARE_SOURCE,
        "src/providers/vercel.ts": VERCEL_SOURCE,
        "src/providers/node.ts": NODE_SOURCE,
        "scripts/skipo-build.mjs": BUILD_SCRIPT,
    }
    for relative, source in files.items():
        if relative == "src/app.ts":
            adapter = target / "src/backend/adapters/httpsAdapter.ts"
            if adapter.is_file():
                source = ADAPTER_APP_SOURCE
            else:
                candidates = ("AppBackend", f"{app_name[:1].upper() + app_name[1:]}Backend")
                backend_entry = next((name for name in candidates if (target / "src/backend" / f"{name}.ts").is_file()), candidates[-1])
                source = APP_SOURCE.replace("__SKIPO_BACKEND_ENTRY__", backend_entry)
        path = target / relative
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(source, encoding="utf-8")
            created.append(path)

    manifest = {
        "schemaVersion": 1,
        "application": {"entry": "src/app.ts", "protocol": "fetch"},
        "providers": {
            "cloudflare": {"entry": "src/providers/cloudflare.ts", "output": "dist/providers/cloudflare/worker.js"},
            "vercel": {"entry": "src/providers/vercel.ts", "output": "api/[...path].js", "additionalOutputs": ["mcp.js"], "runtime": "edge"},
            "node": {"entry": "src/providers/node.ts", "output": "dist/providers/node/server.js"},
        },
        "build": {"command": "npm run build"},
    }
    path = target / "skipo.providers.json"
    if not path.exists():
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        created.append(path)

    package_path = target / "package.json"
    if package_path.exists():
        package: dict[str, Any] = json.loads(package_path.read_text(encoding="utf-8"))
    else:
        package = {"name": app_name.lower(), "private": True, "type": "module"}
    scripts = package.setdefault("scripts", {})
    scripts["build"] = "node scripts/skipo-build.mjs"
    scripts.pop("build:fullstack", None)
    scripts.pop("build:api", None)
    scripts.setdefault("dev", "vite")
    scripts["start"] = "node dist/providers/node/server.js"
    dev = package.setdefault("devDependencies", {})
    dev.setdefault("esbuild", "^0.25.0")
    if "vite" not in package.get("dependencies", {}) and "vite" not in dev and not any(
        (target / name).exists() for name in ("next.config.js", "next.config.mjs", "next.config.ts")
    ):
        dev["vite"] = "^6.2.3"
    package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

    wrangler = target / "wrangler.toml"
    wrangler.write_text(
            f'name = "{app_name.lower()}-worker"\n'
            'main = "dist/providers/cloudflare/worker.js"\n'
            'compatibility_date = "2026-01-01"\n\n'
            '[assets]\n'
            'directory = "./dist/client"\n'
            'binding = "ASSETS"\n'
            'run_worker_first = true\n'
            'not_found_handling = "single-page-application"\n\n'
            '[build]\ncommand = "npm run build"\n',
            encoding="utf-8",
        )
    if wrangler not in created:
        created.append(wrangler)
    vercel = target / "vercel.json"
    vercel.write_text(json.dumps({
            "$schema": "https://openapi.vercel.sh/vercel.json",
            "buildCommand": "npm run build",
            "outputDirectory": "dist/client",
        }, indent=2) + "\n", encoding="utf-8")
    if vercel not in created:
        created.append(vercel)

    # Remove obsolete split-target manifests; provider packages are now derived from one app.
    for relative in (
        "config/build/manifests/fullstack.json",
        "config/build/manifests/api.json",
        "tsconfig.api.json",
        "src/backend/adapters/universalEntry.ts",
        "src/backend/adapters/nodeBridge.ts",
        "scripts/skipo-build.cjs",
    ):
        obsolete = target / relative
        if obsolete.is_file():
            obsolete.unlink()
    return created
