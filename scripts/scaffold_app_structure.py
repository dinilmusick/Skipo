#!/usr/bin/env python3
"""
scaffold_app_structure.py - Scaffolds the extreme-minimal Skipo application composition structure.
Consumes @kloks/* and @floks/* via package.json (node_modules/) with ZERO package source duplication.
"""

from pathlib import Path
from typing import List, Tuple
import argparse
import json
import subprocess
import sys

HERE = Path(__file__).resolve().parent
SKIPO_ROOT = HERE.parent

def scaffold_structure(target_root: Path, app_name: str) -> List[Path]:
    """Generates the minimal Skipo composition tree consuming @kloks/* and @floks/* packages."""
    pascal = app_name[:1].upper() + app_name[1:]
    camel = app_name[:1].lower() + app_name[1:]
    created: List[Path] = []

    planes = [
        ("src/frontend", "Application UI composition entrypoint importing @floks/* packages."),
        ("src/backend", "Application backend facade importing @kloks/* services and orchestrators."),
        ("src/libraries", "Application-specific custom code ONLY (never copy @kloks/* or @floks/* source)."),
    ]

    for rel_path, desc in planes:
        dir_path = target_root / rel_path
        dir_path.mkdir(parents=True, exist_ok=True)
        readme_file = dir_path / "README.md"
        if not readme_file.exists():
            readme_file.write_text(f"# {dir_path.name}\n\n{desc}\n", encoding="utf-8")
            created.append(readme_file)

    # 1. package.json declaring unified @ultrst-armada/kloks, @ultrst-armada/floks
    pkg_json_file = target_root / "package.json"
    if not pkg_json_file.exists():
        pkg_data = {
            "name": app_name.lower(),
            "version": "1.0.0",
            "private": True,
            "type": "module",
            "dependencies": {
                "@ultrst-armada/krnl": "^1.0.0",
                "@ultrst-armada/kloks": "^1.0.0",
                "@ultrst-armada/floks": "^1.1.0",
                "react": "^19.0.1",
                "react-dom": "^19.0.1"
            },
            "pnpm": {
                "overrides": {
                    "@ultrst-armada/kloks": "file:../Kloks",
                    "@ultrst-armada/floks": "file:../Floks"
                }
            }
        }
        pkg_json_file.write_text(json.dumps(pkg_data, indent=2) + "\n", encoding="utf-8")
        created.append(pkg_json_file)

    # 2. src/backend/<AppName>Backend.ts
    backend_file = target_root / "src" / "backend" / f"{pascal}Backend.ts"
    if not backend_file.exists():
        backend_content = f"""/**
 * @file {pascal}Backend.ts
 * @description Primary application backend entrypoint composing @ultrst-armada/kloks services & orchestrators.
 */

import {{
  ServiceAFacade,
  ServiceBFacade,
}} from '@ultrst-armada/kloks/services';
import {{
  OrchestratorAFacade,
}} from '@ultrst-armada/kloks/orchestrations';
import {{
  AudioHardwareServiceFacade,
  MidiServiceFacade,
  AudioMidiOrchestratorFacade,
}} from '@ultrst-armada/kloks/audio-midi';
import {{
  AuthServiceFacade,
  StorageServiceFacade,
  WorkspaceServiceFacade,
  ExecutableBackendFacade,
  WorkerExecutionBoundary,
}} from '@ultrst-armada/kloks/backend';

export const {camel}BackendFacade = new ExecutableBackendFacade('{pascal}Backend');
export const {camel}Worker = new WorkerExecutionBoundary('{pascal}Worker', {camel}BackendFacade);

export const {pascal}Backend = {{
  services: {{
    serviceA: ServiceAFacade,
    serviceB: ServiceBFacade,
    audioHardware: AudioHardwareServiceFacade,
    midi: MidiServiceFacade,
    auth: AuthServiceFacade,
    storage: StorageServiceFacade,
    workspace: WorkspaceServiceFacade,
  }},
  orchestrations: {{
    orchestratorA: OrchestratorAFacade,
    audioMidi: AudioMidiOrchestratorFacade,
  }},
  worker: {camel}Worker,
  WorkerExecutionBoundary: {camel}Worker,
}};

export default {pascal}Backend;
"""
        backend_file.write_text(backend_content, encoding="utf-8")
        created.append(backend_file)

    # 3. Canonical frontend route + component facade
    frontend_components = target_root / "src" / "frontend" / "components"
    frontend_pages = target_root / "src" / "frontend" / "pages" / "home" / "orchestrations"
    frontend_components.mkdir(parents=True, exist_ok=True)
    frontend_pages.mkdir(parents=True, exist_ok=True)

    components_file = frontend_components / "components.ts"
    if not components_file.exists():
        components_file.write_text(
            "export * from '@ultrst-armada/floks/ui';\n"
            "export * from '@ultrst-armada/floks/canvas-ui';\n",
            encoding="utf-8",
        )
        created.append(components_file)

    app_tsx = target_root / "src" / "frontend" / "App.tsx"
    if not app_tsx.exists():
        app_tsx.write_text(
            "import { HomePage } from './pages/home/page.js';\n\n"
            "export function App() {\n"
            "  return <HomePage />;\n"
            "}\n\n"
            "export default App;\n",
            encoding="utf-8",
        )
        created.append(app_tsx)

    page_file = target_root / "src" / "frontend" / "pages" / "home" / "page.tsx"
    if not page_file.exists():
        page_file.write_text(
            "import { FrnlPage } from '../../components/components.js';\n\n"
            "export function HomePage() {\n"
            f"  return <FrnlPage appName=\"{pascal}\">Home</FrnlPage>;\n"
            "}\n\n"
            "export default HomePage;\n",
            encoding="utf-8",
        )
        created.append(page_file)

    orchestration_keep = frontend_pages / ".gitkeep"
    if not orchestration_keep.exists():
        orchestration_keep.write_text("", encoding="utf-8")
        created.append(orchestration_keep)

    # 4. src/libraries/index.ts (Skipo-specific custom code only)
    lib_index = target_root / "src" / "libraries" / "index.ts"
    if not lib_index.exists():
        lib_index.write_text("// Application-specific custom libraries only (never duplicate @ultrst-armada/kloks or @ultrst-armada/floks)\nexport {};\n", encoding="utf-8")
        created.append(lib_index)

    return created

def run_validators(target_root: Path) -> Tuple[bool, str]:
    errors: List[str] = []
    val_01 = SKIPO_ROOT / "checklists" / "01_structure_governance.py"
    if val_01.exists():
        res = subprocess.run(["python3", str(val_01), str(target_root)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 01 VIOLATION]\n{res.stdout or res.stderr}")

    val_15 = SKIPO_ROOT / "checklists" / "15_contract_boundary_enforcement.py"
    if val_15.exists():
        res = subprocess.run(["python3", str(val_15), str(target_root)], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[ASPECT 15 VIOLATION]\n{res.stdout or res.stderr}")

    # If tsconfig.json and node_modules exist, run TypeScript typecheck
    tsconfig = target_root / "tsconfig.json"
    if tsconfig.exists() and (target_root / "node_modules").exists():
        res = subprocess.run(["pnpm", "exec", "tsc", "--noEmit"], cwd=str(target_root), capture_output=True, text=True)
        if res.returncode != 0:
            errors.append(f"[TYPECHECK VIOLATION]\n{res.stdout or res.stderr}")

    return len(errors) == 0, "\n\n".join(errors)

def main():
    parser = argparse.ArgumentParser(description="Scaffold minimal Skipo app composition structure")
    parser.add_argument("target", nargs="?", default="", help="Target root directory")
    parser.add_argument("--name", "-n", default="", help="Application name")
    parser.add_argument("--no-delete-on-fail", action="store_true", help="Do not delete on validation failure")
    args = parser.parse_args()

    target_root = Path(args.target).resolve() if args.target else Path.cwd().resolve()
    app_name = args.name or target_root.name.replace("-", " ").title().replace(" ", "") or "SkipoApp"

    print("=" * 80)
    print(f"  SKIPO MINIMAL PACKAGE-COMPOSITION SCAFFOLD")
    print(f"  Target Root:  {target_root}")
    print(f"  App Name:     {app_name}")
    print("=" * 80)

    created = scaffold_structure(target_root, app_name)
    print(f"  ✔ Created {len(created)} minimal composition files consuming @kloks/* and @floks/*")

    passed, error_output = run_validators(target_root)
    if passed:
        print("  🎉 VALIDATION PASSED: 100% compliant with Skipo Package Composition Architecture!")
        print("=" * 80 + "\n")
        sys.exit(0)
    else:
        print(error_output)
        if not args.no_delete_on_fail:
            for f in created:
                if f.exists():
                    f.unlink()
        sys.exit(1)

if __name__ == "__main__":
    main()
