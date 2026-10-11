#!/usr/bin/env python3
"""
create_service.py - Scaffolds an APP_ARCHITECTURE_SPEC Section 5 & 6 compliant service suite.
Features an AGGRESSIVE VALIDATION & AUTO-DELETE LOOP:
- Scaffolds the full 7-file service directory and auto-registers in <AppName>Backend.ts.
- Immediately executes validators (Aspect 10 App Arch Spec, Aspect 04 Code Limits, Aspect 06 Anti-Stub).
- IF ANY VALIDATION FAILS: Immediately deletes the generated service directory and unregisters from the facade,
  preventing stale broken code accumulation and forcing clean generation.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import argparse
import os
import re
import shutil
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
SKIPO_ROOT = HERE.parent

def detect_app_name(target_root: Path) -> str:
    """Finds <AppName>Backend.ts to extract app name, or defaults to parent folder name."""
    backend_dir = target_root / "src" / "backend"
    if backend_dir.is_dir():
        for f in backend_dir.glob("*Backend.ts"):
            name = f.stem[:-len("Backend")]
            if name:
                return name
    return target_root.name.replace("-", " ").title().replace(" ", "") or "App"

def generate_service_files(service_dir: Path, name: str, app_name: str, runtime: str = "server", deployment: str = "local") -> List[Path]:
    """Generates all 7 canonical service files."""
    camel = name[:1].lower() + name[1:]
    pascal = name[:1].upper() + name[1:]
    created_files: List[Path] = []

    service_dir.mkdir(parents=True, exist_ok=True)
    (service_dir / "client").mkdir(exist_ok=True)
    (service_dir / "server").mkdir(exist_ok=True)
    (service_dir / "remote").mkdir(exist_ok=True)
    (service_dir / "repositories").mkdir(exist_ok=True)
    (service_dir / "types").mkdir(exist_ok=True)
    (service_dir / "tests").mkdir(exist_ok=True)

    # 1. types/<Name>Types.ts
    types_content = f"""// ══════════════════════════════════════════════════════════════════════════════
// 1. DATA TYPES & SCHEMAS
// ══════════════════════════════════════════════════════════════════════════════

export interface {pascal}Payload {{
  readonly identifier: string;
  readonly metadata?: Record<string, unknown>;
}}

export interface {pascal}Result {{
  readonly success: boolean;
  readonly identifier: string;
  readonly processedTimestamp: number;
  readonly record?: Record<string, unknown>;
}}
"""
    types_path = service_dir / "types" / f"{pascal}Types.ts"
    types_path.write_text(types_content, encoding="utf-8")
    created_files.append(types_path)

    # 2. client/<Name>Client.ts
    client_content = f"""// ══════════════════════════════════════════════════════════════════════════════
// 1. CLIENT IMPLEMENTATION
// ══════════════════════════════════════════════════════════════════════════════
import type {{ {pascal}Payload, {pascal}Result }} from '../types/{pascal}Types';

export class {pascal}Client {{
  public async execute(payload: {pascal}Payload): Promise<{pascal}Result> {{
    return {{
      success: true,
      identifier: payload.identifier,
      processedTimestamp: Date.now()
    }};
  }}
}}

export const {camel}Client = new {pascal}Client();
"""
    client_path = service_dir / "client" / f"{pascal}Client.ts"
    client_path.write_text(client_content, encoding="utf-8")
    created_files.append(client_path)

    # 3. repositories/<Name>Repository.ts
    repo_content = f"""// ══════════════════════════════════════════════════════════════════════════════
// 1. PERSISTENCE BOUNDARY
// ══════════════════════════════════════════════════════════════════════════════
import type {{ {pascal}Payload }} from '../types/{pascal}Types';

export class {pascal}Repository {{
  private memoryStore: Map<string, Record<string, unknown>> = new Map();

  public async persist(payload: {pascal}Payload): Promise<Record<string, unknown>> {{
    const record = {{
      id: payload.identifier,
      metadata: payload.metadata || {{}},
      storedAt: Date.now()
    }};
    this.memoryStore.set(payload.identifier, record);
    return record;
  }}

  public async findById(id: string): Promise<Record<string, unknown> | null> {{
    return this.memoryStore.get(id) || null;
  }}
}}

export const {camel}Repository = new {pascal}Repository();
"""
    repo_path = service_dir / "repositories" / f"{pascal}Repository.ts"
    repo_path.write_text(repo_content, encoding="utf-8")
    created_files.append(repo_path)

    # 4. server/<Name>Server.ts
    server_content = f"""// ══════════════════════════════════════════════════════════════════════════════
// 1. IMPORTS & EXTERNAL DEPENDENCIES
// ══════════════════════════════════════════════════════════════════════════════
import type {{ {pascal}Payload, {pascal}Result }} from '../types/{pascal}Types';
import {{ {camel}Repository }} from '../repositories/{pascal}Repository';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * SERVICE SERVER: {pascal}Server
 * ──────────────────────────────────────────────────────────────────────────────
 * Purpose: Server-side execution logic for {camel} operations.
 *
 * Flow Chart:
 *   [Payload Request] ───► [Repository Persist] ───► [Construct Result]
 * ──────────────────────────────────────────────────────────────────────────────
 */
export class {pascal}Server {{
  public static async run(payload: {pascal}Payload): Promise<{pascal}Result> {{
    const record = await {camel}Repository.persist(payload);
    return {{
      success: true,
      identifier: payload.identifier,
      processedTimestamp: Date.now(),
      record
    }};
  }}
}}
"""
    server_path = service_dir / "server" / f"{pascal}Server.ts"
    server_path.write_text(server_content, encoding="utf-8")
    created_files.append(server_path)

    # 5. remote/<Name>Remote.ts
    remote_content = f"""// ══════════════════════════════════════════════════════════════════════════════
// 1. REMOTE GATEWAY PROXY
// ══════════════════════════════════════════════════════════════════════════════
import type {{ {pascal}Payload, {pascal}Result }} from '../types/{pascal}Types';

export class {pascal}Remote {{
  public static async dispatch(payload: {pascal}Payload): Promise<{pascal}Result> {{
    return {{
      success: true,
      identifier: payload.identifier,
      processedTimestamp: Date.now()
    }};
  }}
}}
"""
    remote_path = service_dir / "remote" / f"{pascal}Remote.ts"
    remote_path.write_text(remote_content, encoding="utf-8")
    created_files.append(remote_path)

    # 6. Facade: <name>.ts
    facade_content = f"""// ══════════════════════════════════════════════════════════════════════════════
// 1. SERVICE FACADE (APP_ARCHITECTURE_SPEC)
// ══════════════════════════════════════════════════════════════════════════════
import type {{ {pascal}Payload, {pascal}Result }} from './types/{pascal}Types';
import {{ {pascal}Server }} from './server/{pascal}Server';
import {{ {pascal}Remote }} from './remote/{pascal}Remote';

export const runtime: 'client' | 'server' = '{runtime}';
export const deployment: 'local' | 'remote' = '{deployment}';

export const service = {{
  name: '{camel}',
  runtime,
  deployment,
  execute: async (payload: {pascal}Payload): Promise<{pascal}Result> => {{
    if (deployment === 'local') {{
      return {pascal}Server.run(payload);
    }}
    return {pascal}Remote.dispatch(payload);
  }},
}};
"""
    facade_path = service_dir / f"{camel}.ts"
    facade_path.write_text(facade_content, encoding="utf-8")
    created_files.append(facade_path)

    # 7. tests/<name>.test.ts
    test_content = f"""// ══════════════════════════════════════════════════════════════════════════════
// 1. COMPANION OPERATIONAL TEST
// ══════════════════════════════════════════════════════════════════════════════
import {{ describe, it, expect }} from 'vitest';
import {{ service }} from '../{camel}';

describe('{pascal} Service Suite', () => {{
  it('executes {camel} operational flow successfully', async () => {{
    const result = await service.execute({{ identifier: 'test_item_01' }});
    expect(result.success).toBe(true);
    expect(result.identifier).toBe('test_item_01');
    expect(result.processedTimestamp).toBeGreaterThan(0);
  }});
}});
"""
    test_path = service_dir / "tests" / f"{camel}.test.ts"
    test_path.write_text(test_content, encoding="utf-8")
    created_files.append(test_path)

    return created_files

def register_in_backend_facade(target_root: Path, app_name: str, service_name: str) -> Optional[Path]:
    """Registers service in <AppName>Backend.ts."""
    backend_file = target_root / "src" / "backend" / f"{app_name}Backend.ts"
    if not backend_file.exists():
        return None

    camel = service_name[:1].lower() + service_name[1:]
    content = backend_file.read_text(encoding="utf-8")

    import_stmt = f"import {{ service as {camel}Service }} from './services/{camel}/{camel}';"
    if import_stmt not in content:
        content = f"{import_stmt}\n" + content

    services_pattern = r"(services:\s*\{)([^}]*)(\})"
    match = re.search(services_pattern, content)
    if match:
        existing_services = match.group(2).strip()
        if f"{camel}:" not in existing_services:
            delimiter = ",\n    " if existing_services else "\n    "
            updated_services = f"{match.group(1)}{match.group(2)}{delimiter}{camel}: {camel}Service\n  {match.group(3)}"
            content = content[:match.start()] + updated_services + content[match.end():]

    backend_file.write_text(content, encoding="utf-8")
    return backend_file

def unregister_from_backend_facade(target_root: Path, app_name: str, service_name: str) -> None:
    """Removes service from <AppName>Backend.ts during rollback."""
    backend_file = target_root / "src" / "backend" / f"{app_name}Backend.ts"
    if not backend_file.exists():
        return

    camel = service_name[:1].lower() + service_name[1:]
    content = backend_file.read_text(encoding="utf-8")

    import_stmt = f"import {{ service as {camel}Service }} from './services/{camel}/{camel}';\n"
    content = content.replace(import_stmt, "")

    service_entry = re.compile(rf"\s*{camel}:\s*{camel}Service,?")
    content = service_entry.sub("", content)

    backend_file.write_text(content, encoding="utf-8")

def run_validators(service_dir: Path, target_root: Path) -> Tuple[bool, str]:
    """Runs validators against the generated service directory."""
    errors: List[str] = []

    # 1. Aspect 04: Code limits and purity
    val_04 = SKIPO_ROOT / "checklists" / "04_code_limits_purity.py"
    if val_04.exists():
        res = subprocess.run(["python3", str(val_04), str(service_dir)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 04 VIOLATION]\n{res.stdout or res.stderr}")

    # 2. Aspect 06: Anti-stub asset depth
    val_06 = SKIPO_ROOT / "checklists" / "06_anti_stub_asset_depth.py"
    if val_06.exists():
        res = subprocess.run(["python3", str(val_06), str(service_dir)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 06 VIOLATION]\n{res.stdout or res.stderr}")

    # 3. Aspect 10: App architecture spec
    val_10 = SKIPO_ROOT / "checklists" / "10_app_architecture_spec_validator.py"
    if val_10.exists() and (target_root / "src" / "backend").is_dir():
        res = subprocess.run(["python3", str(val_10), str(target_root)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 10 VIOLATION]\n{res.stdout or res.stderr}")

    return len(errors) == 0, "\n\n".join(errors)

def main():
    parser = argparse.ArgumentParser(description="Create an APP_ARCHITECTURE_SPEC compliant service suite")
    parser.add_argument("name", help="Service name (e.g. billing, documents, vault)")
    parser.add_argument("--target", default="", help="Target root directory containing src/")
    parser.add_argument("--app-name", default="", help="Application name (auto-detected if omitted)")
    parser.add_argument("--runtime", choices=["client", "server"], default="server")
    parser.add_argument("--deployment", choices=["local", "remote"], default="local")
    parser.add_argument("--no-delete-on-fail", action="store_true", help="Do not delete generated files on validator failure")
    args = parser.parse_args()

    target_root = Path(args.target).resolve() if args.target else Path.cwd().resolve()
    if (target_root / "Skipo").is_dir():
        pass
    elif target_root == SKIPO_ROOT and (SKIPO_ROOT.parent / "src").is_dir():
        target_root = SKIPO_ROOT.parent

    app_name = args.app_name or detect_app_name(target_root)
    service_name = args.name.lower().replace("service", "")
    service_dir = target_root / "src" / "backend" / "services" / service_name

    print("=" * 80)
    print(f"  SKIPO AGGRESSIVE SERVICE SCAFFOLDING LOOP")
    print(f"  Service Name:    {service_name}")
    print(f"  Target Path:     {service_dir}")
    print(f"  App Facade:      {app_name}Backend.ts")
    print("=" * 80)

    # 1. Generate files
    created_files = generate_service_files(service_dir, service_name, app_name, args.runtime, args.deployment)
    for f in created_files:
        print(f"  ✔ Generated: {f.relative_to(target_root)}")

    # 2. Register in facade
    facade_path = register_in_backend_facade(target_root, app_name, service_name)
    if facade_path:
        print(f"  ✔ Registered in facade: {facade_path.relative_to(target_root)}")

    # 3. AGGRESSIVE VALIDATION LOOP
    print("\n  🔍 Running verification gate on generated service...")
    passed, error_output = run_validators(service_dir, target_root)

    if passed:
        print("  🎉 VALIDATION PASSED: 100% compliance with Skipo APP_ARCHITECTURE_SPEC!")
        print("=" * 80 + "\n")
        sys.exit(0)
    else:
        print("\n" + "!" * 80)
        print("  🚨 VALIDATOR VIOLATION DETECTED DURING SCAFFOLDING LOOP")
        print("!" * 80)
        print(error_output)

        if not args.no_delete_on_fail:
            print("\n  🗑️ AGGRESSIVE AUTO-DELETE ACTIVATED: Purging non-compliant generated files...")
            if service_dir.exists():
                shutil.rmtree(service_dir)
                print(f"  ❌ Deleted directory: {service_dir.relative_to(target_root)}")
            unregister_from_backend_facade(target_root, app_name, service_name)
            print(f"  ❌ Unregistered from {app_name}Backend.ts")
            print("  💡 Agent Instruction: Fix the reported validator constraints before re-generating.")
        print("=" * 80 + "\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
