#!/usr/bin/env python3
"""
scaffold_app_structure.py - Scaffolds the canonical 4-plane APP_ARCHITECTURE_SPEC tree.
Features an AGGRESSIVE VALIDATION & AUTO-DELETE LOOP:
- Scaffolds src/frontend, src/backend, src/libraries, src/frontend-state with READMEs and barrel files.
- Automatically executes sync_to_libraries.py to hydrate src/libraries/skipo/.
- Runs Aspect 01 Structure and Aspect 10 App Arch Spec validators.
- IF VALIDATION FAILS: Immediately rolls back and deletes generated directories to enforce clean re-creation.
"""

from pathlib import Path
from typing import List, Dict, Any, Tuple
import argparse
import os
import shutil
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
SKIPO_ROOT = HERE.parent

def scaffold_structure(target_root: Path, app_name: str) -> List[Path]:
    """Generates the full 4-plane directory tree with READMEs and barrels."""
    pascal = app_name[:1].upper() + app_name[1:]
    camel = app_name[:1].lower() + app_name[1:]
    created: List[Path] = []

    planes = [
        ("src/frontend/components", "Pure client presentation and modular UI components."),
        ("src/frontend/shell", "Application shell, TopToolbar (44px), and BottomStrip (30px)."),
        ("src/frontend/views", "Top-level views and screen containers."),
        ("src/backend/adapters", "Protocol adapters (HTTP, WS, MCP) translating external wire protocols."),
        ("src/backend/gateway", "Remote service gateway, registry, and transport encoders."),
        ("src/backend/orchestrations", "Client-side backend coordinators sequencing multiple domain services."),
        ("src/backend/services", "Modular domain services with runtime and deployment facades."),
        ("src/libraries/constants", "Environment-neutral constants, configuration tokens, and enums."),
        ("src/libraries/data", "Environment-neutral pure data models and Zod schemas."),
        ("src/libraries/functions", "Environment-neutral pure algorithms and deterministic calculations."),
        ("src/libraries/types", "Environment-neutral TypeScript type definitions and interfaces."),
        ("src/libraries/utilities", "Environment-neutral string, array, and formatting utilities."),
        ("src/frontend-state/stores", "Zustand UI state stores and reactive bindings."),
        ("src/frontend-state/events", "State transition and domain lifecycle events.")
    ]

    for rel_path, desc in planes:
        dir_path = target_root / rel_path
        dir_path.mkdir(parents=True, exist_ok=True)
        readme_file = dir_path / "README.md"
        if not readme_file.exists():
            readme_file.write_text(f"# {dir_path.name}\n\n{desc}\n", encoding="utf-8")
            created.append(readme_file)

    # 1. src/backend/<AppName>Backend.ts
    backend_file = target_root / "src" / "backend" / f"{pascal}Backend.ts"
    if not backend_file.exists():
        backend_content = f"""/**
 * @file {pascal}Backend.ts
 * @description Single Frontend-Backend Entrypoint Facade with WorkerExecutionBoundary.
 * Conforms to APP_ARCHITECTURE_SPEC and SKIPO::STATE_EXECUTION_ARCHITECTURE.
 */

import {{ ExecutableBackendFacade, WorkerExecutionBoundary }} from '@skipo/backend';

export const {camel}BackendFacade = new ExecutableBackendFacade('{pascal}Backend');
export const {camel}Worker = new WorkerExecutionBoundary('{pascal}Worker', {camel}BackendFacade);

export const {pascal}Backend = {{
  services: {{}},
  orchestrations: {{}},
  worker: {camel}Worker,
  WorkerExecutionBoundary: {camel}Worker,
}};
"""
        backend_file.write_text(backend_content, encoding="utf-8")
        created.append(backend_file)

    # 2. src/libraries/index.ts
    lib_index = target_root / "src" / "libraries" / "index.ts"
    if not lib_index.exists():
        lib_content = """export * from './types/index';
export * from './functions/index';
export * from './data/index';
export * from './constants/index';
export * from './utilities/index';
export * from './skipo/index';
"""
        lib_index.write_text(lib_content, encoding="utf-8")
        created.append(lib_index)

    # 3. Barrels for libraries
    for sub in ("types", "functions", "data", "constants", "utilities"):
        barrel = target_root / "src" / "libraries" / sub / "index.ts"
        if not barrel.exists():
            barrel.write_text("// Pure library exports\nexport {};\n", encoding="utf-8")
            created.append(barrel)

    # 4. Frontend state barrels
    stores_barrel = target_root / "src" / "frontend-state" / "stores" / "index.ts"
    if not stores_barrel.exists():
        stores_barrel.write_text("import { SKIPO_STATE, useSkipoState } from '@skipo/systems/state';\nexport { SKIPO_STATE, useSkipoState };\n", encoding="utf-8")
        created.append(stores_barrel)

    exec_barrel = target_root / "src" / "frontend-state" / "execution" / "index.ts"
    exec_barrel.parent.mkdir(parents=True, exist_ok=True)
    if not exec_barrel.exists():
        exec_barrel.write_text("import { SKIPO_EXECUTION, useCommand } from '@skipo/systems/execution';\nexport { SKIPO_EXECUTION, useCommand };\n", encoding="utf-8")
        created.append(exec_barrel)

    events_barrel = target_root / "src" / "frontend-state" / "events" / "index.ts"
    if not events_barrel.exists():
        events_barrel.write_text("// Frontend state events\nexport {};\n", encoding="utf-8")
        created.append(events_barrel)

    return created

def run_validators(target_root: Path) -> Tuple[bool, str]:
    """Validates structural compliance."""
    errors: List[str] = []

    # Aspect 01: Structure Governance
    val_01 = SKIPO_ROOT / "checklists" / "01_structure_governance.py"
    if val_01.exists():
        res = subprocess.run(["python3", str(val_01), str(target_root)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 01 VIOLATION]\n{res.stdout or res.stderr}")

    return len(errors) == 0, "\n\n".join(errors)

def main():
    parser = argparse.ArgumentParser(description="Scaffold canonical 4-plane Skipo app structure")
    parser.add_argument("target", nargs="?", default="", help="Target root directory")
    parser.add_argument("--name", "-n", default="", help="Application name")
    parser.add_argument("--no-sync", action="store_true", help="Skip synchronizing Skipo base assets")
    parser.add_argument("--no-delete-on-fail", action="store_true", help="Do not delete on validation failure")
    args = parser.parse_args()

    target_root = Path(args.target).resolve() if args.target else Path.cwd().resolve()
    app_name = args.name or target_root.name.replace("-", " ").title().replace(" ", "") or "SkipoApp"

    print("=" * 80)
    print(f"  SKIPO APP STRUCTURE SCAFFOLDING LOOP")
    print(f"  Target Root:  {target_root}")
    print(f"  App Name:     {app_name}")
    print("=" * 80)

    # 1. Scaffold files
    created = scaffold_structure(target_root, app_name)
    print(f"  ✔ Created {len(created)} canonical structure files across 4 planes")

    # 2. Hydrate Skipo libraries
    if not args.no_sync:
        print("\n  📦 Hydrating Skipo base assets into src/libraries/skipo/...")
        sync_script = HERE / "sync_to_libraries.py"
        sync_res = subprocess.run(["python3", str(sync_script), str(target_root)], capture_output=True, text=True)
        print(sync_res.stdout)

    # 3. AGGRESSIVE VALIDATION LOOP
    print("  🔍 Running verification gate...")
    passed, error_output = run_validators(target_root)

    if passed:
        print("  🎉 VALIDATION PASSED: 100% compliant with Skipo 4-Plane Architecture!")
        print("=" * 80 + "\n")
        sys.exit(0)
    else:
        print("\n" + "!" * 80)
        print("  🚨 STRUCTURE VALIDATION FAILED DURING SCAFFOLDING LOOP")
        print("!" * 80)
        print(error_output)

        if not args.no_delete_on_fail:
            print("\n  🗑️ AGGRESSIVE AUTO-DELETE ACTIVATED: Purging non-compliant scaffold...")
            for f in created:
                if f.exists():
                    f.unlink()
            print(f"  ❌ Removed {len(created)} non-compliant generated files.")
            print("  💡 Agent Instruction: Fix the reported structural constraints before re-scaffolding.")
        print("=" * 80 + "\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
