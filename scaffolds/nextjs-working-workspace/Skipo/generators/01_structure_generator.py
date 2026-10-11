#!/usr/bin/env python3
"""
Aspect 01: Project Architecture & Plane Structure Generator
Generates:
- Complete decoupled plane directory trees (src/frontend & src/backend, packages/*, or entities/*)
- Anchored .gitignore adhering strictly to Skipo invariants (/dist/, /.next/, /out/, etc.)
- Folder-level README.md and SKILL.md declaring architectural invariants
"""

from pathlib import Path
from typing import List, Dict, Any
import json
import sys
import time

try:
    from .common import (
        GeneratedFile, GeneratorResult, section_header,
        generate_ascii_flowchart, emit_directory, parse_generator_args,
        print_generator_report
    )
except ImportError:
    from common import (
        GeneratedFile, GeneratorResult, section_header,
        generate_ascii_flowchart, emit_directory, parse_generator_args,
        print_generator_report
    )

GENERATOR_ID = "01_structure_generator"
GENERATOR_TITLE = "Plane Architecture & Structural Governance Generator"

GITIGNORE_CONTENT = """# Skipo Anchored .gitignore Invariant
/dist/
/.next/
/out/
/build/
/.turbo/
/node_modules/
/.coverage/
/.cache/
*.log
.DS_Store
"""

def generate_structure(target_dir: Path, params: Dict[str, Any]) -> GeneratorResult:
    start_time = time.time()
    files: List[GeneratedFile] = []
    
    app_name = params.get("name") or target_dir.name or "SkipoApp"
    env = params.get("env", "standard")
    custom = params.get("custom", {})
    plane_type = custom.get("plane_type", params.get("type", "frontend-backend"))

    # 1. Anchored .gitignore
    files.append(GeneratedFile(
        relative_path=".gitignore",
        content=GITIGNORE_CONTENT,
        description="Anchored root .gitignore with strict leading slash boundaries"
    ))

    # 2. Architecture Documentation README.md
    flowchart = generate_ascii_flowchart(f"{app_name} Plane Architecture", [
        "Client Request / User Interaction",
        "Frontend Plane (src/frontend)",
        "Backend Plane (src/backend)",
        "Authentic Storage / SDK Driver"
    ])
    
    readme_content = f"""# {app_name} Architecture Manifest

{flowchart}

## Architectural Invariants (Enforced by Skipo Checklists)
- **Plane Isolation (L1)**: Zero monolithic flat `src/`. All frontend assets reside in `src/frontend`, all backend services reside in `src/backend`.
- **Anti-Stub (L2)**: Minimum 2 statements per function. Zero empty bodies or mock arrays.
- **Real Drivers (L3)**: Authentic SDK connectivity only.
- **Token Theme (L4)**: 100% theme tokens (`var(--skipo-*)`). Zero hardcoded hex/rgb colors.

Generated with Skipo Deterministic Generators.
"""
    files.append(GeneratedFile(
        relative_path="README.md",
        content=readme_content,
        description="Root architecture manifest and invariant specification"
    ))

    # 3. Sub-App SKILL.md router
    skill_content = f"""---
name: {app_name.lower()}-router
description: Architectural router and invariant specifications for {app_name}.
---

# {app_name.upper()} RUNTIME SPECIFICATIONS

## Domain Layout
- `src/frontend`: UI components, shells, design tokens, client state.
- `src/backend`: API routes, authentic drivers, database adapters, control plane auth.

## Verification Gate
Before declaring any task complete:
```bash
python3 checklists/full_system_validator.py .
```
"""
    files.append(GeneratedFile(
        relative_path="SKILL.md",
        content=skill_content,
        description="Sub-app router and skill definition"
    ))

    # 4. Frontend Plane Directory Readme & Index
    frontend_readme = f"""# Frontend Plane: {app_name}

Contains all client-side UI, presentation logic, and interactive views.
- `components/`: Pure, single-responsibility components (<= 200 lines).
- `shell/`: AppShell, TopToolbar (44px), BottomStrip (30px), FloatingDetailsPanel.
- `lib/`: Reactive state hooks and UI helpers.
"""
    files.append(GeneratedFile(
        relative_path="src/frontend/README.md",
        content=frontend_readme,
        description="Frontend plane documentation"
    ))

    frontend_index = f"""{section_header("Frontend Plane Barrel")}
// ══════════════════════════════════════════════════════════════════════════════

export * from './components';
export * from './shell';
"""
    files.append(GeneratedFile(
        relative_path="src/frontend/index.ts",
        content=frontend_index,
        description="Frontend plane entrypoint barrel"
    ))

    # 5. Backend Plane Directory Readme & Index
    backend_readme = f"""# Backend Plane: {app_name}

Contains all data-plane and control-plane services, authentic SDK drivers, and secure routes.
- `api/`: 8-gate secure route handlers.
- `entities/`: Quad-unit entity atoms (schema, types, store, EmptyState).
- `drivers/`: Authentic SDK drivers (S3/B2, SQLite, Postgres, Fetch).
"""
    files.append(GeneratedFile(
        relative_path="src/backend/README.md",
        content=backend_readme,
        description="Backend plane documentation"
    ))

    backend_index = f"""{section_header("Backend Plane Barrel")}
// ══════════════════════════════════════════════════════════════════════════════

export * from './entities';
export * from './drivers';
"""
    files.append(GeneratedFile(
        relative_path="src/backend/index.ts",
        content=backend_index,
        description="Backend plane entrypoint barrel"
    ))

    # 6. Placeholder barrel files for sub-directories so imports resolve
    files.append(GeneratedFile(
        relative_path="src/frontend/components/index.ts",
        content=f"{section_header('Components Barrel')}\nexport {{}};\n",
        description="Components barrel"
    ))
    files.append(GeneratedFile(
        relative_path="src/frontend/shell/index.ts",
        content=f"{section_header('Shell Barrel')}\nexport {{}};\n",
        description="Shell barrel"
    ))
    files.append(GeneratedFile(
        relative_path="src/backend/entities/index.ts",
        content=f"{section_header('Entities Barrel')}\nexport {{}};\n",
        description="Entities barrel"
    ))
    files.append(GeneratedFile(
        relative_path="src/backend/drivers/index.ts",
        content=f"{section_header('Drivers Barrel')}\nexport {{}};\n",
        description="Drivers barrel"
    ))

    # Write files
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

def main():
    args = parse_generator_args("Skipo Plane Architecture & Structural Governance Generator")
    target_path = Path(args["target_path"] or ".").resolve()
    result = generate_structure(target_path, args)

    if args["json"]:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print_generator_report(result)

    sys.exit(0 if result.success else 1)

if __name__ == "__main__":
    main()
