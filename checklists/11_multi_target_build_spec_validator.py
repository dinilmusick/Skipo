#!/usr/bin/env python3
"""
Aspect 11: MULTI_TARGET_BUILD_SPEC Governance Validator
Verifies:
- Clean 4-Plane Root: Exactly src/{frontend, backend, libraries, frontend-state}
  (Strict ban on src/runtime/ and legacy root folders like src/components, src/core, etc.)
- Protocol Adapter Entrypoint: src/backend/adapters/httpsAdapter.ts exists and exports fetch handler
- Context-Neutral Flat Orchestrations: src/backend/orchestrations/ exists with NO client/ or server/ subfolders
- Service Implementations: Each service has client/ and server/ slots
- Build Manifests: config/build/manifests/fullstack.json and api.json exist
- Deployment Config: wrangler.toml exists with main pointing to dist/api/worker/index.js
- Dual Build Scripts: package.json has build:fullstack, build:api, build:all, validate:api
- Dual TSConfig: tsconfig.api.json exists
"""

from pathlib import Path
import json
import re
import sys
import time
from typing import List, Dict, Any, Set

try:
    from .common import (
        Violation, ChecklistResult, scan_files, read_text_safe,
        print_checklist_report, parse_standard_args
    )
except ImportError:
    from common import (
        Violation, ChecklistResult, scan_files, read_text_safe,
        print_checklist_report, parse_standard_args
    )

ASPECT_ID = "aspect_11_multi_target_build_spec"
ASPECT_TITLE = "MULTI_TARGET_BUILD_SPEC & Protocol Adapters Governance"

CANONICAL_PLANES = {"frontend", "backend", "libraries", "frontend-state"}
FORBIDDEN_SRC_DIRS = {"runtime", "components", "context", "core", "services", "types", "utils"}

def validate_multi_target_build_spec(root_dir: Path) -> ChecklistResult:
    start_time = time.time()
    violations: List[Violation] = []
    files_scanned = 0

    src_dir = root_dir / "src"
    if not src_dir.exists() or not src_dir.is_dir():
        violations.append(Violation(
            rule_id="missing-src-directory",
            severity="error",
            message="Canonical 'src/' directory is missing.",
            file_path="src/",
            suggestion="Create 'src/' with frontend, backend, libraries, and frontend-state."
        ))
        return ChecklistResult(
            aspect_id=ASPECT_ID,
            aspect_title=ASPECT_TITLE,
            passed=False,
            violations=violations,
            files_scanned=1,
            duration_ms=(time.time() - start_time) * 1000,
            score=0.0
        )

    # 1. Plane Isolation & Ban on Forbidden Dirs in src/
    subdirs = {d.name for d in src_dir.iterdir() if d.is_dir()}
    for bad_dir in FORBIDDEN_SRC_DIRS:
        if bad_dir in subdirs:
            violations.append(Violation(
                rule_id=f"forbidden-src-directory-{bad_dir}",
                severity="error",
                message=f"Forbidden legacy/redundant directory 'src/{bad_dir}' detected.",
                file_path=f"src/{bad_dir}",
                suggestion=f"Remove or migrate 'src/{bad_dir}' into canonical planes ('frontend', 'backend', or 'libraries')."
            ))

    # 2. Protocol Adapter Invariant (src/backend/adapters/httpsAdapter.ts)
    backend_dir = src_dir / "backend"
    adapter_file = backend_dir / "adapters" / "httpsAdapter.ts"
    if not adapter_file.exists():
        violations.append(Violation(
            rule_id="missing-https-adapter",
            severity="error",
            message="Protocol Adapter 'src/backend/adapters/httpsAdapter.ts' is missing.",
            file_path="src/backend/adapters/",
            suggestion="Create 'src/backend/adapters/httpsAdapter.ts' to expose the Backend facade to Cloudflare Workers / Fetch API."
        ))
    else:
        files_scanned += 1
        content = read_text_safe(adapter_file)
        if "fetch(" not in content and "fetch :" not in content and "fetch:" not in content:
            violations.append(Violation(
                rule_id="adapter-missing-fetch-handler",
                severity="error",
                message="'httpsAdapter.ts' does not export a standard 'fetch' handler.",
                file_path=str(adapter_file.relative_to(root_dir)),
                suggestion="Export an object with 'async fetch(request: Request): Promise<Response>'."
            ))

    # 3. Context-Neutral Flat Orchestrations
    orch_dir = backend_dir / "orchestrations"
    if orch_dir.exists() and orch_dir.is_dir():
        orch_subdirs = {d.name for d in orch_dir.iterdir() if d.is_dir()}
        if "client" in orch_subdirs or "server" in orch_subdirs:
            violations.append(Violation(
                rule_id="orchestrations-split-anti-pattern",
                severity="error",
                message="Orchestrations must be context-neutral and FLAT. Found 'client/' or 'server/' subfolder.",
                file_path=str(orch_dir.relative_to(root_dir)),
                suggestion="Remove client/server subdirectories in orchestrations; orchestrations sequence services identically in browser and worker."
            ))

    # 4. Service client/ and server/ slots
    services_dir = backend_dir / "services"
    if services_dir.exists() and services_dir.is_dir():
        for s_dir in services_dir.iterdir():
            if s_dir.is_dir() and not s_dir.name.startswith("."):
                has_client = (s_dir / "client").exists()
                has_server = (s_dir / "server").exists()
                if not has_client or not has_server:
                    violations.append(Violation(
                        rule_id="service-missing-runtime-slots",
                        severity="warning",
                        message=f"Service '{s_dir.name}' should have both 'client/' and 'server/' implementation slots.",
                        file_path=str(s_dir.relative_to(root_dir)),
                        suggestion="Ensure service provides client/ (browser) and server/ (worker/node) folders."
                    ))

    # 5. Build Manifests
    manifest_fullstack = root_dir / "config" / "build" / "manifests" / "fullstack.json"
    manifest_api = root_dir / "config" / "build" / "manifests" / "api.json"
    if not manifest_fullstack.exists():
        violations.append(Violation(
            rule_id="missing-manifest-fullstack",
            severity="error",
            message="Target manifest 'config/build/manifests/fullstack.json' is missing.",
            file_path="config/build/manifests/",
            suggestion="Create 'fullstack.json' specifying build targets and inclusions."
        ))
    else:
        files_scanned += 1

    if not manifest_api.exists():
        violations.append(Violation(
            rule_id="missing-manifest-api",
            severity="error",
            message="Target manifest 'config/build/manifests/api.json' is missing.",
            file_path="config/build/manifests/",
            suggestion="Create 'api.json' specifying entrypoint and exclusions."
        ))
    else:
        files_scanned += 1

    # 6. Wrangler Configuration
    wrangler_file = root_dir / "wrangler.toml"
    if not wrangler_file.exists():
        violations.append(Violation(
            rule_id="missing-wrangler-toml",
            severity="error",
            message="Cloudflare Worker deployment manifest 'wrangler.toml' is missing.",
            file_path="wrangler.toml",
            suggestion="Create 'wrangler.toml' configured with main = 'dist/api/worker/index.js'."
        ))
    else:
        files_scanned += 1
        w_text = read_text_safe(wrangler_file)
        if "[build]" not in w_text or "build:api" not in w_text:
            violations.append(Violation(
                rule_id="wrangler-missing-build-command",
                severity="error",
                message="wrangler.toml is missing [build] command = 'npm run build:api'. Direct wrangler deploy will fail if dist/api/worker/index.js is not yet built.",
                file_path="wrangler.toml",
                suggestion="Add '[build]\\ncommand = \"npm run build:api\"' to wrangler.toml."
            ))
        if "[assets]" not in w_text:
            violations.append(Violation(
                rule_id="wrangler-missing-assets-configuration",
                severity="warning",
                message="wrangler.toml is missing '[assets]' configuration. Without assets, Cloudflare Workers will only serve API JSON and will not serve the frontend UI.",
                file_path="wrangler.toml",
                suggestion="Add '[assets]\\ndirectory = \"dist/client\"\\nbinding = \"ASSETS\"\\nnot_found_handling = \"single-page-application\"' to wrangler.toml."
            ))

    # 7. tsconfig.api.json
    tsconfig_api = root_dir / "tsconfig.api.json"
    if not tsconfig_api.exists():
        violations.append(Violation(
            rule_id="missing-tsconfig-api",
            severity="error",
            message="API Target TypeScript config 'tsconfig.api.json' is missing.",
            file_path="tsconfig.api.json",
            suggestion="Create 'tsconfig.api.json' excluding frontend and client implementations."
        ))
    else:
        files_scanned += 1

    # 8. Dual Build Scripts in package.json
    pkg_file = root_dir / "package.json"
    is_vite = False
    if pkg_file.exists():
        files_scanned += 1
        try:
            pkg_data = json.loads(read_text_safe(pkg_file))
            scripts = pkg_data.get("scripts", {})
            required_scripts = ["build", "build:fullstack", "build:api", "build:all", "validate:api"]
            for req in required_scripts:
                if req not in scripts:
                    violations.append(Violation(
                        rule_id=f"missing-script-{req}",
                        severity="error",
                        message=f"package.json missing required multi-target script '{req}'.",
                        file_path="package.json",
                        suggestion=f"Add script '{req}' to package.json."
                    ))

            if scripts.get("build") != "npm run build:all":
                violations.append(Violation(
                    rule_id="build-script-not-build-all",
                    severity="error",
                    message="package.json 'build' script must be 'npm run build:all' to ensure all deployment targets (Vercel fullstack + Cloudflare worker) are built.",
                    file_path="package.json",
                    suggestion="Set '\"build\": \"npm run build:all\"' in package.json."
                ))

            # 9. Framework Anti-Hallucination (Ban 'next' in Vite-based apps)
            deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
            is_vite = "vite" in deps or (root_dir / "vite.config.ts").exists() or (root_dir / "vite.config.js").exists()
            if is_vite and "next" in deps:
                violations.append(Violation(
                    rule_id="vite-app-forbidden-next-dependency",
                    severity="error",
                    message="Vite app declares 'next' in package.json, causing Vercel to misdetect framework as Next.js and fail on missing '.next'.",
                    file_path="package.json",
                    suggestion="Remove 'next' from dependencies and devDependencies in package.json."
                ))
        except Exception as e:
            violations.append(Violation(
                rule_id="invalid-package-json",
                severity="error",
                message=f"Failed to parse package.json: {e}",
                file_path="package.json"
            ))

    # 10. Lockfile Purity (Ban conflicting multiple lockfiles)
    has_npm = (root_dir / "package-lock.json").exists()
    has_bun = (root_dir / "bun.lock").exists() or (root_dir / "bun.lockb").exists()
    has_pnpm = (root_dir / "pnpm-lock.yaml").exists()
    has_yarn = (root_dir / "yarn.lock").exists()
    lockfiles_found = sum([has_npm, has_bun, has_pnpm, has_yarn])
    if lockfiles_found > 1:
        conflicts = [n for n, exists in [("package-lock.json", has_npm), ("bun.lock", has_bun), ("pnpm-lock.yaml", has_pnpm), ("yarn.lock", has_yarn)] if exists]
        violations.append(Violation(
            rule_id="conflicting-lockfiles-detected",
            severity="error",
            message=f"Multiple conflicting lockfiles detected ({', '.join(conflicts)}). Causes Cloudflare/CI frozen-lockfile version failures.",
            file_path="bun.lock" if has_bun else conflicts[0],
            suggestion="Delete secondary lockfiles and standardize on a single lockfile matching your primary package manager."
        ))

    # 11. Vercel Fullstack Routing Contract
    vercel_file = root_dir / "vercel.json"
    if vercel_file.exists():
        files_scanned += 1
        try:
            v_data = json.loads(read_text_safe(vercel_file))
            rewrites = v_data.get("rewrites", [])
            has_api_rewrite = any("/api" in r.get("source", "") for r in rewrites)
            if not has_api_rewrite and is_vite:
                violations.append(Violation(
                    rule_id="vercel-missing-api-rewrite",
                    severity="warning",
                    message="vercel.json in fullstack Vite app should declare an /api/(.*) rewrite to /api.",
                    file_path="vercel.json",
                    suggestion="Add { 'source': '/api/(.*)', 'destination': '/api' } to vercel.json rewrites."
                ))
        except Exception:
            pass


    errors = [v for v in violations if v.severity == "error"]
    passed = len(errors) == 0
    score = max(0.0, 100.0 - (len(errors) * 15.0 + len([v for v in violations if v.severity == "warning"]) * 5.0))

    return ChecklistResult(
        aspect_id=ASPECT_ID,
        aspect_title=ASPECT_TITLE,
        passed=passed,
        violations=violations,
        files_scanned=files_scanned,
        duration_ms=(time.time() - start_time) * 1000,
        score=score
    )

def main():
    args = parse_standard_args("Aspect 11: MULTI_TARGET_BUILD_SPEC Validator")
    root_path = Path(args.path).resolve()
    result = validate_multi_target_build_spec(root_path)

    if args.json:
        import json
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print_checklist_report(result, verbose=args.verbose)

    sys.exit(0 if result.passed else 1)

if __name__ == "__main__":
    main()
